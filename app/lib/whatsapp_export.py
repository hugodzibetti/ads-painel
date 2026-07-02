import re
import hashlib
from datetime import datetime, timezone
import pytz

MESSAGE_RE = re.compile(r'^(\d{2}/\d{2}/\d{4}) (\d{2}:\d{2}) - ([^:]+): (.*)$')
DATE_PREFIX_RE = re.compile(r'^\d{2}/\d{2}/\d{4} \d{2}:\d{2} - ')
ARQUIVO_ANEXADO_RE = re.compile(r'^(.+?) \(arquivo anexado\)$')
_TZ = pytz.timezone('America/Sao_Paulo')


def parse_export(text, group_label):
    """Parse a WhatsApp .txt export into structured messages, dropping system lines."""
    messages = []
    for raw_line in text.splitlines():
        line = raw_line.replace('‎', '')
        match = MESSAGE_RE.match(line)
        if match:
            date_str, time_str, author, body = match.groups()
            local_dt = _TZ.localize(datetime.strptime(f'{date_str} {time_str}', '%d/%m/%Y %H:%M'))
            timestamp = local_dt.astimezone(timezone.utc).isoformat()
            media_ref, media_hidden = _extract_media_ref(body)
            messages.append({
                'group_label': group_label,
                'author': author.strip(),
                'timestamp': timestamp,
                'raw_body': body,
                'media_ref': media_ref,
                'media_hidden': media_hidden,
            })
        elif DATE_PREFIX_RE.match(line):
            continue
        elif messages and line.strip():
            messages[-1]['raw_body'] += '\n' + line
    return messages


def _extract_media_ref(body):
    """Classify a message body as hidden media, an attached file reference, or plain text."""
    stripped = body.strip()
    if stripped == '<Mídia oculta>':
        return None, True
    match = ARQUIVO_ANEXADO_RE.match(stripped)
    if match:
        return match.group(1), False
    return None, False


def synthetic_message_id(group_label, timestamp, author, body):
    """Deterministic id for imported messages, so re-running the import is idempotent."""
    digest = hashlib.sha256(f'{group_label}|{timestamp}|{author}|{body}'.encode('utf-8')).hexdigest()
    return f'import:{digest}'
