import argparse
import sys
import zipfile
import tempfile
from pathlib import Path
from faster_whisper import WhisperModel

from lib.whatsapp_export import parse_export, synthetic_message_id
from lib.db import insert_message, message_similar_exists
from lib.media_resolve import classify_media
from lib.vision import init_vision_client, caption_image
from lib.media_resolve import resolve_pdf, resolve_image, resolve_audio, resolve_video, pick_whisper_device
from lib.extraction import run_extraction


def find_export_txt(export_dir):
    """Locate the single .txt chat log inside an extracted WhatsApp export directory."""
    txt_files = list(Path(export_dir).glob('*.txt'))
    if not txt_files:
        raise FileNotFoundError(f'Nenhum .txt encontrado em {export_dir}')
    return txt_files[0]


def extract_if_zip(path):
    """Extract a .zip export to a temp directory outside the repo, or pass through a directory."""
    path = Path(path)
    if path.suffix.lower() != '.zip':
        return path
    dest = Path(tempfile.mkdtemp(prefix='ads-painel-import-'))
    with zipfile.ZipFile(path) as zf:
        zf.extractall(dest)
    return dest


def process_group(export_dir, group_label, resolve_fns):
    """Parse one group's export directory and insert resolved messages into the DB."""
    export_dir = Path(export_dir)
    txt_path = find_export_txt(export_dir)
    text = txt_path.read_text(encoding='utf-8')
    messages = parse_export(text, group_label)

    inserted = 0
    skipped_dup = 0

    for msg in messages:
        body = _resolve_body(msg, export_dir, resolve_fns)

        if message_similar_exists(msg['group_label'], msg['author'], msg['timestamp'], body):
            skipped_dup += 1
            continue

        wa_id = synthetic_message_id(msg['group_label'], msg['timestamp'], msg['author'], body)
        insert_message(wa_id, msg['group_label'], msg['author'], body, msg['timestamp'])
        inserted += 1

    return {'inserted': inserted, 'skipped_dup': skipped_dup, 'total': len(messages)}


def _resolve_body(msg, export_dir, resolve_fns):
    if msg['media_hidden']:
        return '[mídia não disponível]'
    if not msg['media_ref']:
        return msg['raw_body']

    media_type = classify_media(msg['media_ref'])
    if media_type == 'sticker':
        return '[figurinha]'

    media_path = export_dir / msg['media_ref']
    if media_type in resolve_fns and media_path.exists():
        return resolve_fns[media_type](media_path)

    return f'[arquivo: {msg["media_ref"]}]'


def build_resolve_fns(vision_client, vision_model, whisper_model):
    """Wire the real per-media-type resolvers used outside of tests."""
    def caption_bytes(image_bytes, filename):
        return caption_image(vision_client, vision_model, image_bytes, filename)

    return {
        'pdf': lambda path: resolve_pdf(path, caption_bytes),
        'image': lambda path: resolve_image(path, caption_bytes),
        'audio': lambda path: resolve_audio(path, whisper_model),
        'video': lambda path: resolve_video(path, whisper_model),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description='Import retroativo dos exports do WhatsApp (alunos e profs)')
    parser.add_argument('alunos_export', help='Caminho do .zip ou diretório extraído do grupo alunos')
    parser.add_argument('profs_export', help='Caminho do .zip ou diretório extraído do grupo profs')
    args = parser.parse_args(argv)

    vision_client, vision_model = init_vision_client()
    device, compute_type = pick_whisper_device()
    whisper_model = WhisperModel('large-v3', device=device, compute_type=compute_type)
    resolve_fns = build_resolve_fns(vision_client, vision_model, whisper_model)

    for path, group_label in [(args.alunos_export, 'alunos'), (args.profs_export, 'profs')]:
        export_dir = extract_if_zip(Path(path))
        result = process_group(export_dir, group_label, resolve_fns)
        print(f"[{group_label}] {result['inserted']} inseridas, {result['skipped_dup']} duplicadas ignoradas, {result['total']} no total")

    print("\nExtraindo atividades...")
    while True:
        summary = run_extraction(max_batches=10)
        print(
            f"  lote: {summary['messages_processed']} processadas, "
            f"{summary['activities_extracted']} atividades, "
            f"{summary['total_tokens_used']} tokens, "
            f"{summary['messages_remaining']} restantes"
        )
        if summary['errors']:
            print(f"  erros: {summary['errors']}")
        if summary['messages_remaining'] == 0 or summary['messages_processed'] == 0:
            break


if __name__ == '__main__':
    main()
