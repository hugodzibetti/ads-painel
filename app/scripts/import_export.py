import argparse
import shutil
import signal
import socket
import wave
import zipfile
import tempfile
from pathlib import Path
from faster_whisper import WhisperModel

socket.setdefaulttimeout(90)

_RESOLVER_TIMEOUT_SECONDS = 45


class _ResolverTimeout(TimeoutError):
    pass


def _run_with_timeout(fn, arg, timeout_seconds):
    """Run fn(arg) with a hard wall-clock timeout via SIGALRM.

    A background-thread + thread.join(timeout=...) approach was tried first, but some
    blocking SSL reads observed in production held the GIL for their entire syscall,
    so the main thread never got scheduled again to notice its join() had timed out.
    SIGALRM interrupts the blocking syscall itself at the OS level, independent of the
    GIL — it only works because this is always called from the main thread.
    """
    def _on_alarm(signum, frame):
        raise _ResolverTimeout(f'travou por mais de {timeout_seconds}s')

    previous_handler = signal.signal(signal.SIGALRM, _on_alarm)
    signal.alarm(timeout_seconds)
    try:
        return fn(arg)
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous_handler)

from lib.whatsapp_export import parse_export, synthetic_message_id
from lib.db import insert_message, message_similar_exists, message_exists
from lib.media_resolve import classify_media
from lib.vision import init_vision_client, caption_image
from lib.media_resolve import resolve_pdf, resolve_image, resolve_audio, resolve_video, pick_whisper_device
from lib.extraction import run_extraction


def find_export_txt(export_dir):
    """Locate the single .txt chat log inside an extracted WhatsApp export directory."""
    txt_files = sorted(Path(export_dir).glob('*.txt'))
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
        wa_id = synthetic_message_id(msg['group_label'], msg['timestamp'], msg['author'], msg['raw_body'])
        if message_exists(wa_id):
            skipped_dup += 1
            continue

        body = _resolve_body(msg, export_dir, resolve_fns)

        if message_similar_exists(msg['group_label'], msg['author'], msg['timestamp'], body):
            skipped_dup += 1
            continue

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
        try:
            return _run_with_timeout(resolve_fns[media_type], media_path, _RESOLVER_TIMEOUT_SECONDS)
        except Exception as e:
            print(f"  aviso: falha ao processar {msg['media_ref']} ({e}); usando placeholder e seguindo em frente.")
            return f'[arquivo: {msg["media_ref"]}]'

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


def _whisper_gpu_usable(whisper_model):
    """Run a trivial transcription to confirm the GPU runtime libraries actually load, not just that a GPU exists."""
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / 'silence.wav'
        with wave.open(str(wav_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            wav_file.writeframes(b'\x00\x00' * 1600)
        try:
            segments, _info = whisper_model.transcribe(str(wav_path))
            next(iter(segments), None)
            return True
        except Exception as e:
            print(f"GPU indisponível para faster-whisper ({e}); caindo para CPU.")
            return False


def main(argv=None):
    parser = argparse.ArgumentParser(description='Import retroativo dos exports do WhatsApp (alunos e profs)')
    parser.add_argument('alunos_export', help='Caminho do .zip ou diretório extraído do grupo alunos')
    parser.add_argument('profs_export', help='Caminho do .zip ou diretório extraído do grupo profs')
    args = parser.parse_args(argv)

    vision_client, vision_model = init_vision_client()
    device, compute_type = pick_whisper_device()
    whisper_model = WhisperModel('large-v3', device=device, compute_type=compute_type)
    if device == 'cuda' and not _whisper_gpu_usable(whisper_model):
        whisper_model = WhisperModel('large-v3', device='cpu', compute_type='int8')
    resolve_fns = build_resolve_fns(vision_client, vision_model, whisper_model)

    for path, group_label in [(args.alunos_export, 'alunos'), (args.profs_export, 'profs')]:
        original_path = Path(path)
        export_dir = extract_if_zip(original_path)
        try:
            result = process_group(export_dir, group_label, resolve_fns)
            print(f"[{group_label}] {result['inserted']} inseridas, {result['skipped_dup']} duplicadas ignoradas, {result['total']} no total")
        finally:
            if original_path.suffix.lower() == '.zip':
                shutil.rmtree(export_dir, ignore_errors=True)

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
