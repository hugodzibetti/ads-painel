import zipfile
import tempfile
from pathlib import Path

from lib.whatsapp_export import parse_export, synthetic_message_id
from lib.db import insert_message, message_similar_exists
from lib.media_resolve import classify_media


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
