# Import Retroativo dos Exports do WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone CLI script that imports the two full WhatsApp export `.zip` files (text + media) into the existing `messages`/`activities` schema, processing each media type as cheaply as possible, then draining the resulting backlog through the existing `run_extraction()` pipeline unchanged.

**Architecture:** New, isolated modules under `app/lib/` (`whatsapp_export.py` for parsing, `media_resolve.py` for per-media-type content resolution, `vision.py` for the Haiku captioning client) feed a new orchestrator script `app/scripts/import_export.py`. Nothing in `bot/` or the live extraction pipeline (`app/lib/extraction.py`, `app/lib/prompts.py`) is modified — the script only calls `run_extraction()` as a black box, exactly like the "Atualizar" button does.

**Tech Stack:** Python (existing `app/` venv), `pymupdf` (PDF text extraction + page rendering, no external binary), `faster-whisper` (local speech-to-text, CTranslate2 backend, no torch needed), `ffmpeg` CLI (video → audio extraction, system dependency), OpenAI SDK (already a dependency) pointed at a second, vision-capable endpoint for images.

## Global Constraints

- Real export `.zip`/`.txt`/media files are **never** copied into the repository or committed. Tests use only synthetic, fabricated data (fake names/numbers), never real export content.
- New env vars are additive and optional, with safe defaults, and never touch the live text-extraction pipeline's existing `OPENCODE_BASE_URL`/`OPENCODE_MODEL`: `OPENCODE_VISION_BASE_URL` (default `https://opencode.ai/zen/v1`), `OPENCODE_VISION_MODEL` (default `claude-haiku-4-5`). Both reuse the existing `OPENCODE_API_KEY`.
- Every test that would otherwise call a real LLM, vision model, or `faster-whisper` model must mock it — zero real API cost and no GPU/model-download dependency in the test suite.
- New dependencies go in `app/requirements.txt`: `pymupdf`, `faster-whisper`.
- Follow existing code style exactly: short one-line docstrings (see `app/lib/db.py`, `app/lib/extraction.py`), no multi-paragraph comments, no test framework beyond plain `pytest` functions (no fixtures — match the `tempfile.mkstemp()` + `os.environ['DB_PATH']` pattern already used in `app/tests/test_db.py` and `app/tests/test_extraction_integration.py`).
- Run tests with: `cd app && source venv/bin/activate && python -m pytest tests/ -v`

---

### Task 1: Parse WhatsApp export text into structured messages

**Files:**
- Create: `app/lib/whatsapp_export.py`
- Test: `app/tests/test_whatsapp_export.py`

**Interfaces:**
- Produces: `parse_export(text: str, group_label: str) -> list[dict]`, each dict has keys `group_label`, `author`, `timestamp` (ISO-UTC string), `raw_body`, `media_ref` (str filename or `None`), `media_hidden` (bool). Also `synthetic_message_id(group_label: str, timestamp: str, author: str, body: str) -> str`.

- [ ] **Step 1: Write the failing tests**

```python
# app/tests/test_whatsapp_export.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.whatsapp_export import parse_export, synthetic_message_id


def test_parse_simple_message():
    text = "01/07/2026 10:15 - Maria: Prova de redes dia 10/07!!"
    messages = parse_export(text, "alunos")
    assert len(messages) == 1
    msg = messages[0]
    assert msg["group_label"] == "alunos"
    assert msg["author"] == "Maria"
    assert msg["raw_body"] == "Prova de redes dia 10/07!!"
    assert msg["media_ref"] is None
    assert msg["media_hidden"] is False
    assert msg["timestamp"].startswith("2026-07-01T13:15")  # 10:15 BRT -> 13:15 UTC


def test_parse_multiline_message():
    text = (
        "01/07/2026 10:15 - Maria: Primeira linha\n"
        "segunda linha continua aqui\n"
        "01/07/2026 10:16 - João: outra mensagem"
    )
    messages = parse_export(text, "alunos")
    assert len(messages) == 2
    assert messages[0]["raw_body"] == "Primeira linha\nsegunda linha continua aqui"
    assert messages[1]["author"] == "João"


def test_parse_system_line_discarded():
    text = (
        "01/07/2026 09:00 - +55 11 90000-0000 criou o grupo \"ADS\"\n"
        "01/07/2026 10:15 - Maria: mensagem real"
    )
    messages = parse_export(text, "alunos")
    assert len(messages) == 1
    assert messages[0]["author"] == "Maria"


def test_parse_media_oculta():
    text = "01/07/2026 10:15 - Maria: <Mídia oculta>"
    messages = parse_export(text, "alunos")
    assert messages[0]["media_ref"] is None
    assert messages[0]["media_hidden"] is True


def test_parse_arquivo_anexado():
    text = "01/07/2026 10:15 - Maria: ‎EDITAL-PROVA.pdf (arquivo anexado)"
    messages = parse_export(text, "profs")
    assert messages[0]["media_ref"] == "EDITAL-PROVA.pdf"
    assert messages[0]["media_hidden"] is False


def test_synthetic_message_id_deterministic():
    id1 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo")
    id2 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo")
    assert id1 == id2
    assert id1.startswith("import:")


def test_synthetic_message_id_differs_by_body():
    id1 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo A")
    id2 = synthetic_message_id("alunos", "2026-07-01T13:15:00+00:00", "Maria", "corpo B")
    assert id1 != id2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && python -m pytest tests/test_whatsapp_export.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'lib.whatsapp_export'`

- [ ] **Step 3: Implement `app/lib/whatsapp_export.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_whatsapp_export.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/whatsapp_export.py app/tests/test_whatsapp_export.py
git commit -m "feat: parse WhatsApp export text into structured messages"
```

---

### Task 2: Message insertion + live-capture dedup in `app/lib/db.py`

**Files:**
- Modify: `app/lib/db.py`
- Test: `app/tests/test_db.py` (append new test functions)

**Interfaces:**
- Consumes: `get_connection()` (existing, `app/lib/db.py:16`).
- Produces: `insert_message(wa_message_id: str, group_label: str, author: str, body: str, timestamp: str) -> None`, `message_similar_exists(group_label: str, author: str, timestamp: str, body: str) -> bool`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/test_db.py` (add `insert_message` and `message_similar_exists` to the existing import block at the top, and add these functions before the `if __name__ == '__main__':` block — there isn't one in this file currently, so just append at the end of the file):

```python
def test_insert_message_creates_row():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    insert_message('import:abc123', 'alunos', 'Maria', 'texto da mensagem', datetime.now(timezone.utc).isoformat())

    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT wa_message_id, group_label, author, body, processed FROM messages").fetchone()
    conn.close()

    assert row[0] == 'import:abc123'
    assert row[1] == 'alunos'
    assert row[2] == 'Maria'
    assert row[3] == 'texto da mensagem'
    assert row[4] == 0

    os.unlink(db_path)


def test_insert_message_swallows_duplicate():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    ts = datetime.now(timezone.utc).isoformat()
    insert_message('import:dup', 'alunos', 'Maria', 'primeira', ts)
    insert_message('import:dup', 'alunos', 'Maria', 'primeira', ts)  # must not raise

    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM messages WHERE wa_message_id = 'import:dup'").fetchone()[0]
    conn.close()

    assert count == 1

    os.unlink(db_path)


def test_message_similar_exists_matches_same_minute():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('live-msg-1', 'alunos', 'Maria', 'Prova amanhã', '2026-06-30T22:49:00.000Z', 0)
    )
    conn.commit()
    conn.close()

    assert message_similar_exists('alunos', 'Maria', '2026-06-30T22:49:45+00:00', 'Prova amanhã') is True
    assert message_similar_exists('alunos', 'Maria', '2026-06-30T22:49:45+00:00', 'Corpo diferente') is False
    assert message_similar_exists('alunos', 'Maria', '2026-06-30T22:55:00+00:00', 'Prova amanhã') is False

    os.unlink(db_path)
```

Also update the import block at the top of `app/tests/test_db.py`:

```python
from lib.db import (
    get_connection,
    fetch_unprocessed_messages,
    fetch_unprocessed_count,
    mark_processed,
    insert_activities,
    fetch_activities,
    update_activity_status,
    check_duplicate_activity,
    fetch_messages,
    insert_message,
    message_similar_exists,
)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && python -m pytest tests/test_db.py -v`
Expected: FAIL with `ImportError: cannot import name 'insert_message' from 'lib.db'`

- [ ] **Step 3: Implement in `app/lib/db.py`**

Add near the top (after existing imports, `app/lib/db.py:1-8`):

```python
import logging

logger = logging.getLogger(__name__)
```

Append at the end of `app/lib/db.py`:

```python
def insert_message(wa_message_id, group_label, author, body, timestamp):
    """Insert a raw message, mirroring bot/db.js::insertMessage's swallow-on-duplicate semantics."""
    conn = get_connection()
    try:
        try:
            conn.execute(
                """
                INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                (wa_message_id, group_label, author, body, timestamp)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            logger.info(f"Message {wa_message_id} already exists, skipping.")
    finally:
        conn.close()

def message_similar_exists(group_label, author, timestamp, body):
    """Check for an existing message with the same group/author/body in the same minute."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT 1 FROM messages
            WHERE group_label = ? AND author = ? AND body = ?
              AND substr(timestamp, 1, 16) = substr(?, 1, 16)
            LIMIT 1
            """,
            (group_label, author, body, timestamp)
        )
        return cursor.fetchone() is not None
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_db.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/db.py app/tests/test_db.py
git commit -m "feat: add insert_message and live-capture dedup to db layer"
```

---

### Task 3: PDF and image resolution (`app/lib/media_resolve.py`, part 1)

**Files:**
- Create: `app/lib/media_resolve.py`
- Test: `app/tests/test_media_resolve.py`
- Modify: `app/requirements.txt` (add `pymupdf`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `classify_media(filename: str) -> str` (one of `'pdf'`, `'image'`, `'audio'`, `'video'`, `'sticker'`, `'other'`), `extract_pdf_text(path) -> str`, `render_pdf_first_page(path) -> bytes` (PNG), `resolve_pdf(path, caption_image_bytes_fn) -> str`, `resolve_image(path, caption_image_bytes_fn) -> str`. `caption_image_bytes_fn` is any callable `(image_bytes: bytes, filename: str) -> str` — Task 5 provides the real one.

- [ ] **Step 1: Add dependency**

Edit `app/requirements.txt`:

```
streamlit>=1.35
openai>=1.30
python-dotenv>=1.0
pytz>=2024.1
pymupdf>=1.24
```

Run: `cd app && source venv/bin/activate && pip install -r requirements.txt`

- [ ] **Step 2: Write the failing tests**

```python
# app/tests/test_media_resolve.py
import sys
import tempfile
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import fitz
from lib.media_resolve import (
    classify_media,
    extract_pdf_text,
    render_pdf_first_page,
    resolve_pdf,
    resolve_image,
)


def make_test_pdf(text):
    fd, path = tempfile.mkstemp(suffix='.pdf')
    os.close(fd)
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()
    return path


def test_classify_media():
    assert classify_media('EDITAL.pdf') == 'pdf'
    assert classify_media('foto.JPG') == 'image'
    assert classify_media('foto.png') == 'image'
    assert classify_media('audio.opus') == 'audio'
    assert classify_media('video.mp4') == 'video'
    assert classify_media('figurinha.webp') == 'sticker'
    assert classify_media('planilha.xlsx') == 'other'


def test_extract_pdf_text_returns_text():
    path = make_test_pdf('Prova de Redes dia 10/07')
    try:
        text = extract_pdf_text(path)
        assert 'Prova de Redes' in text
    finally:
        os.unlink(path)


def test_render_pdf_first_page_returns_png_bytes():
    path = make_test_pdf('conteudo qualquer')
    try:
        png_bytes = render_pdf_first_page(path)
        assert png_bytes[:8] == b'\x89PNG\r\n\x1a\n'
    finally:
        os.unlink(path)


def test_resolve_pdf_uses_extracted_text_when_present():
    path = make_test_pdf('Edital de prova N3')
    try:
        result = resolve_pdf(path, caption_image_bytes_fn=lambda b, f: 'NUNCA DEVE SER CHAMADO')
        assert 'Edital de prova N3' in result
    finally:
        os.unlink(path)


def test_resolve_pdf_falls_back_to_vision_when_empty():
    fd, path = tempfile.mkstemp(suffix='.pdf')
    os.close(fd)
    doc = fitz.open()
    doc.new_page()  # blank page, no text
    doc.save(path)
    doc.close()
    try:
        result = resolve_pdf(path, caption_image_bytes_fn=lambda b, f: 'legenda da imagem')
        assert result == 'legenda da imagem'
    finally:
        os.unlink(path)


def test_resolve_image_calls_caption_fn_with_bytes_and_filename():
    fd, path = tempfile.mkstemp(suffix='.jpg')
    os.write(fd, b'fake-jpeg-bytes')
    os.close(fd)

    captured = {}

    def fake_caption(image_bytes, filename):
        captured['bytes'] = image_bytes
        captured['filename'] = filename
        return 'legenda'

    try:
        result = resolve_image(path, caption_image_bytes_fn=fake_caption)
        assert result == 'legenda'
        assert captured['bytes'] == b'fake-jpeg-bytes'
        assert captured['filename'] == Path(path).name
    finally:
        os.unlink(path)
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && python -m pytest tests/test_media_resolve.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'lib.media_resolve'`

- [ ] **Step 4: Implement `app/lib/media_resolve.py`**

```python
from pathlib import Path
import fitz

_EXTENSION_MAP = {
    '.pdf': 'pdf',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.png': 'image',
    '.opus': 'audio',
    '.mp4': 'video',
    '.webp': 'sticker',
}


def classify_media(filename):
    """Classify a media filename by extension into a coarse processing category."""
    return _EXTENSION_MAP.get(Path(filename).suffix.lower(), 'other')


def extract_pdf_text(path):
    """Extract text from all pages of a PDF. Returns '' if there is no extractable text."""
    doc = fitz.open(path)
    try:
        return '\n'.join(page.get_text() for page in doc).strip()
    finally:
        doc.close()


def render_pdf_first_page(path):
    """Render the first page of a PDF to PNG bytes, for vision fallback on scanned PDFs."""
    doc = fitz.open(path)
    try:
        pixmap = doc[0].get_pixmap()
        return pixmap.tobytes('png')
    finally:
        doc.close()


def resolve_pdf(path, caption_image_bytes_fn):
    """Resolve a PDF to text: extracted text if present, else a vision caption of page 1."""
    text = extract_pdf_text(path)
    if text:
        return text
    png_bytes = render_pdf_first_page(path)
    return caption_image_bytes_fn(png_bytes, f'{Path(path).stem}-page1.png')


def resolve_image(path, caption_image_bytes_fn):
    """Resolve an image file to a short text caption via the injected vision function."""
    image_bytes = Path(path).read_bytes()
    return caption_image_bytes_fn(image_bytes, Path(path).name)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_media_resolve.py -v`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add app/lib/media_resolve.py app/tests/test_media_resolve.py app/requirements.txt
git commit -m "feat: resolve PDF and image media to text via injected captioning"
```

---

### Task 4: Audio and video resolution (`app/lib/media_resolve.py`, part 2)

**Files:**
- Modify: `app/lib/media_resolve.py`
- Modify: `app/tests/test_media_resolve.py`
- Modify: `app/requirements.txt` (add `faster-whisper`)

**Interfaces:**
- Consumes: nothing new from earlier tasks (independent additions to the same file).
- Produces: `pick_whisper_device() -> tuple[str, str]`, `resolve_audio(path, whisper_model) -> str`, `extract_audio_track(video_path, output_wav_path) -> None`, `resolve_video(path, whisper_model) -> str`. `whisper_model` is any object exposing `.transcribe(path) -> (segments, info)` where each segment has a `.text` attribute — matches `faster_whisper.WhisperModel`'s real interface, injected so tests never load a real model.

- [ ] **Step 1: Add dependency**

Edit `app/requirements.txt`:

```
streamlit>=1.35
openai>=1.30
python-dotenv>=1.0
pytz>=2024.1
pymupdf>=1.24
faster-whisper>=1.0
```

Run: `cd app && source venv/bin/activate && pip install -r requirements.txt`

- [ ] **Step 2: Write the failing tests**

Append to `app/tests/test_media_resolve.py` (add these imports to the top import line: `from unittest.mock import MagicMock, patch` and extend the `from lib.media_resolve import (...)` block with `pick_whisper_device, resolve_audio, extract_audio_track, resolve_video`):

```python
def make_fake_segment(text):
    seg = MagicMock()
    seg.text = text
    return seg


def test_resolve_audio_joins_segment_text():
    fake_model = MagicMock()
    fake_model.transcribe.return_value = ([make_fake_segment(' Prova amanhã '), make_fake_segment('às oito')], None)

    result = resolve_audio('/fake/path/audio.opus', fake_model)

    assert result == 'Prova amanhã  às oito'
    fake_model.transcribe.assert_called_once_with('/fake/path/audio.opus')


def test_extract_audio_track_raises_clear_error_without_ffmpeg():
    with patch('lib.media_resolve.shutil.which', return_value=None):
        try:
            extract_audio_track('/fake/video.mp4', '/fake/out.wav')
            assert False, "should have raised"
        except RuntimeError as e:
            assert 'ffmpeg' in str(e)


def test_resolve_video_extracts_audio_then_transcribes():
    fake_model = MagicMock()
    fake_model.transcribe.return_value = ([make_fake_segment('conteudo do video')], None)

    with patch('lib.media_resolve.extract_audio_track') as mock_extract:
        result = resolve_video('/fake/video.mp4', fake_model)

    assert result == 'conteudo do video'
    mock_extract.assert_called_once()
    fake_model.transcribe.assert_called_once()


def test_pick_whisper_device_falls_back_to_cpu_without_cuda():
    with patch.dict('sys.modules', {'ctranslate2': None}):
        device, compute_type = pick_whisper_device()
    assert device == 'cpu'
    assert compute_type == 'int8'
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && python -m pytest tests/test_media_resolve.py -v`
Expected: FAIL with `ImportError: cannot import name 'resolve_audio' from 'lib.media_resolve'`

- [ ] **Step 4: Implement additions to `app/lib/media_resolve.py`**

Add near the top imports:

```python
import shutil
import subprocess
import tempfile
```

Append at the end of the file:

```python
def pick_whisper_device():
    """Pick the fastest available faster-whisper device/compute_type without requiring torch."""
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return 'cuda', 'float16'
    except Exception:
        pass
    return 'cpu', 'int8'


def resolve_audio(path, whisper_model):
    """Transcribe an audio file locally via an injected faster-whisper model instance."""
    segments, _info = whisper_model.transcribe(str(path))
    return ' '.join(segment.text for segment in segments).strip()


def extract_audio_track(video_path, output_wav_path):
    """Extract the audio track of a video to a 16kHz mono WAV via ffmpeg."""
    if shutil.which('ffmpeg') is None:
        raise RuntimeError(
            'ffmpeg não encontrado no PATH — instale com "apt install ffmpeg" antes de importar vídeos.'
        )
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(video_path), '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', str(output_wav_path)],
        check=True, capture_output=True,
    )


def resolve_video(path, whisper_model):
    """Resolve a video file to text by transcribing its audio track; visual frames are ignored."""
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / 'audio.wav'
        extract_audio_track(path, wav_path)
        return resolve_audio(wav_path, whisper_model)
```

Note: `test_resolve_audio_joins_segment_text` asserts `result == 'Prova amanhã  às oito'` (two spaces) because the fake segments carry their own leading/trailing spaces and `resolve_audio` only strips the final joined string, not each segment — matches real `faster-whisper` output which includes segment-boundary spacing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_media_resolve.py -v`
Expected: PASS (10 tests total in this file)

- [ ] **Step 6: Commit**

```bash
git add app/lib/media_resolve.py app/tests/test_media_resolve.py app/requirements.txt
git commit -m "feat: resolve audio and video media via local faster-whisper transcription"
```

---

### Task 5: Vision client for image/PDF captioning (`app/lib/vision.py`)

**Files:**
- Create: `app/lib/vision.py`
- Test: `app/tests/test_vision.py`
- Modify: `.env.example` (repo root — add the two new optional vars)

**Interfaces:**
- Consumes: nothing (standalone, mirrors `init_openai_client()` in `app/lib/extraction.py:19-28`).
- Produces: `init_vision_client() -> (OpenAI, str)`, `caption_image(client, model, image_bytes: bytes, filename: str) -> str`. This module's `caption_image` bound to a real client is what Task 7 passes as the `caption_image_bytes_fn` consumed by Task 3's `resolve_pdf`/`resolve_image`.

- [ ] **Step 1: Write the failing tests**

```python
# app/tests/test_vision.py
import sys
import os
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.vision import init_vision_client, caption_image


def test_init_vision_client_raises_without_api_key():
    os.environ.pop('OPENCODE_API_KEY', None)
    try:
        init_vision_client()
        assert False, "should have raised"
    except ValueError as e:
        assert 'OPENCODE_API_KEY' in str(e)


def test_init_vision_client_uses_defaults():
    os.environ['OPENCODE_API_KEY'] = 'test-key'
    os.environ.pop('OPENCODE_VISION_BASE_URL', None)
    os.environ.pop('OPENCODE_VISION_MODEL', None)

    client, model = init_vision_client()

    assert model == 'claude-haiku-4-5'
    assert str(client.base_url).rstrip('/') == 'https://opencode.ai/zen/v1'


def test_caption_image_sends_base64_and_returns_content():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '  Edital de prova N3, entrega dia 10/07  '
    mock_client.chat.completions.create.return_value = mock_response

    result = caption_image(mock_client, 'claude-haiku-4-5', b'fake-image-bytes', 'foto.jpg')

    assert result == 'Edital de prova N3, entrega dia 10/07'
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs['model'] == 'claude-haiku-4-5'
    content = call_kwargs['messages'][0]['content']
    image_url = next(part['image_url']['url'] for part in content if part['type'] == 'image_url')
    assert image_url.startswith('data:image/jpeg;base64,')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && python -m pytest tests/test_vision.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'lib.vision'`

- [ ] **Step 3: Implement `app/lib/vision.py`**

```python
import base64
import os
from pathlib import Path
from openai import OpenAI

_MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
}


def init_vision_client():
    """Initialize a separate OpenAI-compatible client for image captioning (not the live text pipeline's client)."""
    api_key = os.getenv('OPENCODE_API_KEY')
    base_url = os.getenv('OPENCODE_VISION_BASE_URL', 'https://opencode.ai/zen/v1')
    model = os.getenv('OPENCODE_VISION_MODEL', 'claude-haiku-4-5')

    if not api_key:
        raise ValueError("OPENCODE_API_KEY is not set")

    return OpenAI(api_key=api_key, base_url=base_url), model


def caption_image(client, model, image_bytes, filename):
    """Ask a vision-capable model for a short caption focused on academic deadlines."""
    mime = _MIME_BY_EXT.get(Path(filename).suffix.lower(), 'image/jpeg')
    b64 = base64.b64encode(image_bytes).decode('ascii')
    response = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Descreva objetivamente esta imagem em até 2 frases, focando em datas, "
                        "prazos e avisos acadêmicos, se houver. Se for irrelevante (ex: meme, foto "
                        "pessoal), diga apenas 'imagem sem conteúdo acadêmico relevante'."
                    ),
                },
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        max_tokens=150,
    )
    return response.choices[0].message.content.strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_vision.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Update `.env.example`**

Read the current file first, then add these two lines after the existing `OPENCODE_MODEL=` line (keep everything else unchanged):

```
# Só usado pelo script de import retroativo (app/scripts/import_export.py) para legendar
# imagens/PDFs escaneados. Endpoint e modelo separados do pipeline de texto ao vivo.
OPENCODE_VISION_BASE_URL=https://opencode.ai/zen/v1
OPENCODE_VISION_MODEL=claude-haiku-4-5
```

- [ ] **Step 6: Commit**

```bash
git add app/lib/vision.py app/tests/test_vision.py .env.example
git commit -m "feat: add vision client for image/PDF captioning in retroactive import"
```

---

### Task 6: Orchestration core — parse a group's export directory into inserted messages

**Files:**
- Create: `app/scripts/__init__.py` (empty, makes `scripts` importable the same way `lib` already is)
- Create: `app/scripts/import_export.py`
- Test: `app/tests/test_import_export.py`

**Interfaces:**
- Consumes: `parse_export`, `synthetic_message_id` (Task 1); `insert_message`, `message_similar_exists` (Task 2); `classify_media` (Task 3/4).
- Produces: `find_export_txt(export_dir) -> Path`, `extract_if_zip(path) -> Path`, `process_group(export_dir: Path, group_label: str, resolve_fns: dict) -> dict` with keys `inserted`, `skipped_dup`, `total`. `resolve_fns` maps `'pdf'`/`'image'`/`'audio'`/`'video'` to callables `(path) -> str`; Task 7 wires the real ones.

- [ ] **Step 1: Write the failing tests**

```python
# app/tests/test_import_export.py
import sys
import os
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.import_export import find_export_txt, extract_if_zip, process_group


def create_test_db():
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)
    return db_path


def init_test_schema(db_path):
    schema_path = Path(__file__).parent.parent.parent / 'shared' / 'schema.sql'
    conn = sqlite3.connect(db_path)
    conn.executescript(schema_path.read_text())
    conn.commit()
    conn.close()


def test_find_export_txt_locates_single_txt(tmp_path=None):
    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'Conversa do WhatsApp com ADS.txt').write_text('conteudo')
    (export_dir / 'STK-001.webp').write_bytes(b'fake')

    result = find_export_txt(export_dir)

    assert result.name == 'Conversa do WhatsApp com ADS.txt'


def test_extract_if_zip_extracts_and_returns_dir():
    src_dir = Path(tempfile.mkdtemp())
    (src_dir / 'conversa.txt').write_text('conteudo')

    zip_fd, zip_path = tempfile.mkstemp(suffix='.zip')
    os.close(zip_fd)
    with zipfile.ZipFile(zip_path, 'w') as zf:
        zf.write(src_dir / 'conversa.txt', arcname='conversa.txt')

    try:
        result_dir = extract_if_zip(Path(zip_path))
        assert (result_dir / 'conversa.txt').exists()
    finally:
        os.unlink(zip_path)


def test_extract_if_zip_passes_through_plain_directory():
    src_dir = Path(tempfile.mkdtemp())
    result_dir = extract_if_zip(src_dir)
    assert result_dir == src_dir


def test_process_group_inserts_text_message():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: Prova de redes dia 10/07"
    )

    result = process_group(export_dir, 'alunos', resolve_fns={})

    assert result == {'inserted': 1, 'skipped_dup': 0, 'total': 1}
    conn = sqlite3.connect(db_path)
    body = conn.execute("SELECT body FROM messages").fetchone()[0]
    conn.close()
    assert body == 'Prova de redes dia 10/07'

    os.unlink(db_path)


def test_process_group_hidden_media_becomes_placeholder():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text("01/07/2026 10:15 - Maria: <Mídia oculta>")

    process_group(export_dir, 'alunos', resolve_fns={})

    conn = sqlite3.connect(db_path)
    body = conn.execute("SELECT body FROM messages").fetchone()[0]
    conn.close()
    assert body == '[mídia não disponível]'

    os.unlink(db_path)


def test_process_group_sticker_becomes_placeholder_without_calling_resolver():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: ‎STK-0001.webp (arquivo anexado)"
    )
    (export_dir / 'STK-0001.webp').write_bytes(b'fake-sticker')

    def resolver_that_must_not_be_called(path):
        raise AssertionError("sticker resolver should never be called")

    process_group(export_dir, 'alunos', resolve_fns={'sticker': resolver_that_must_not_be_called})

    conn = sqlite3.connect(db_path)
    body = conn.execute("SELECT body FROM messages").fetchone()[0]
    conn.close()
    assert body == '[figurinha]'

    os.unlink(db_path)


def test_process_group_pdf_uses_resolver():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: ‎EDITAL.pdf (arquivo anexado)"
    )
    (export_dir / 'EDITAL.pdf').write_bytes(b'fake-pdf')

    result = process_group(
        export_dir, 'profs',
        resolve_fns={'pdf': lambda path: 'Edital de prova N3 extraído'}
    )

    assert result['inserted'] == 1
    conn = sqlite3.connect(db_path)
    body = conn.execute("SELECT body FROM messages").fetchone()[0]
    conn.close()
    assert body == 'Edital de prova N3 extraído'

    os.unlink(db_path)


def test_process_group_missing_media_file_falls_back_to_placeholder():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: ‎NAO-EXISTE.pdf (arquivo anexado)"
    )
    # note: NAO-EXISTE.pdf is intentionally not created on disk

    process_group(export_dir, 'alunos', resolve_fns={'pdf': lambda path: 'nunca chamado'})

    conn = sqlite3.connect(db_path)
    body = conn.execute("SELECT body FROM messages").fetchone()[0]
    conn.close()
    assert body == '[arquivo: NAO-EXISTE.pdf]'

    os.unlink(db_path)


def test_process_group_skips_message_similar_to_live_capture():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('live-1', 'alunos', 'Maria', 'Prova de redes dia 10/07', '2026-07-01T13:15:00.000Z', 0)
    )
    conn.commit()
    conn.close()

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: Prova de redes dia 10/07"
    )

    result = process_group(export_dir, 'alunos', resolve_fns={})

    assert result == {'inserted': 0, 'skipped_dup': 1, 'total': 1}

    os.unlink(db_path)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && python -m pytest tests/test_import_export.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts'`

- [ ] **Step 3: Implement**

Create `app/scripts/__init__.py` (empty file).

Create `app/scripts/import_export.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_import_export.py -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/scripts/__init__.py app/scripts/import_export.py app/tests/test_import_export.py
git commit -m "feat: orchestrate parsing and inserting one group's export"
```

---

### Task 7: CLI entry point wiring real resolvers + extraction loop, plus docs

**Files:**
- Modify: `app/scripts/import_export.py` (add `main()` and real resolver wiring)
- Modify: `app/tests/test_import_export.py` (add one integration-style test)
- Modify: `README.md` (usage section)

**Interfaces:**
- Consumes: `process_group` (Task 6); `run_extraction` from `app/lib/extraction.py:50` (unmodified); `init_vision_client`, `caption_image` (Task 5); `resolve_pdf`, `resolve_image`, `resolve_audio`, `resolve_video`, `pick_whisper_device` (Tasks 3-4).
- Produces: `build_resolve_fns(vision_client, vision_model, whisper_model) -> dict`, `main(argv=None) -> None`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/test_import_export.py` (add `from unittest.mock import patch, MagicMock` to the imports, and `import json`):

```python
def test_main_imports_both_groups_and_drains_extraction():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path
    os.environ['OPENCODE_API_KEY'] = 'test-key'

    alunos_dir = Path(tempfile.mkdtemp())
    (alunos_dir / 'export.txt').write_text("01/07/2026 10:15 - Maria: Prova de redes dia 10/07")

    profs_dir = Path(tempfile.mkdtemp())
    (profs_dir / 'export.txt').write_text("01/07/2026 11:00 - Prof David: Edital publicado")

    mock_extraction_response = MagicMock()
    mock_extraction_response.usage.prompt_tokens = 10
    mock_extraction_response.usage.completion_tokens = 5
    mock_extraction_response.choices = [MagicMock()]
    mock_extraction_response.choices[0].message.content = json.dumps({"items": []})

    mock_extraction_client = MagicMock()
    mock_extraction_client.chat.completions.create.return_value = mock_extraction_response

    with patch('lib.extraction.OpenAI', return_value=mock_extraction_client), \
         patch('scripts.import_export.init_vision_client', return_value=(MagicMock(), 'claude-haiku-4-5')), \
         patch('scripts.import_export.WhisperModel', return_value=MagicMock()):
        from scripts.import_export import main
        main([str(alunos_dir), str(profs_dir)])

    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    remaining = conn.execute("SELECT COUNT(*) FROM messages WHERE processed = 0").fetchone()[0]
    conn.close()

    assert count == 2
    assert remaining == 0

    os.unlink(db_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && python -m pytest tests/test_import_export.py::test_main_imports_both_groups_and_drains_extraction -v`
Expected: FAIL with `ImportError: cannot import name 'main' from 'scripts.import_export'`

- [ ] **Step 3: Implement `main()` in `app/scripts/import_export.py`**

Add imports at the top:

```python
import argparse
import sys
from faster_whisper import WhisperModel

from lib.vision import init_vision_client, caption_image
from lib.media_resolve import resolve_pdf, resolve_image, resolve_audio, resolve_video, pick_whisper_device
from lib.extraction import run_extraction
```

Append at the end of the file:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && python -m pytest tests/test_import_export.py -v`
Expected: PASS (10 tests total in this file)

Run full suite to confirm nothing broke: `cd app && python -m pytest tests/ -v`
Expected: all tests pass (existing + new)

- [ ] **Step 5: Document usage in `README.md`**

Read the current `README.md` first to find the right insertion point (likely near "Fases futuras" or "Fluxo de uso"), then add a section:

```markdown
### Import retroativo (histórico completo com mídia)

Para popular o banco com o histórico completo de um grupo (não só mensagens novas), exporte a conversa no WhatsApp com mídia incluída (Configurações do grupo → Exportar conversa → Incluir mídia) e rode:

\`\`\`bash
cd app && source venv/bin/activate
python scripts/import_export.py "/caminho/para/Conversa do WhatsApp com ADS.zip" "/caminho/para/Conversa do WhatsApp com 1° ADS Fasipe Sorriso.zip"
\`\`\`

Primeiro argumento é sempre o export do grupo **alunos**, segundo é sempre **profs**. O script nunca copia os `.zip`/mídia para dentro do repositório — extrai para uma pasta temporária do sistema, processa, e descarta.

Processamento por tipo de mídia (pensado pra ficar barato): texto e PDF (extração local, de graça) são processados sempre; imagens usam Claude Haiku via `OPENCODE_VISION_BASE_URL`/`OPENCODE_VISION_MODEL` (endpoint pago por token, fora do plano Go — configure essas duas variáveis no `.env` antes de rodar); áudio e vídeo são transcritos localmente via `faster-whisper` (`large-v3`, usa GPU se disponível — sem custo de API); figurinhas são ignoradas.

Requer `ffmpeg` instalado no sistema para processar vídeos (`apt install ffmpeg`).
```

- [ ] **Step 6: Commit**

```bash
git add app/scripts/import_export.py app/tests/test_import_export.py README.md
git commit -m "feat: add CLI entry point for retroactive WhatsApp export import"
```

---

## Self-Review Notes

- **Spec coverage:** privacy (Global Constraints + Task 6/7 never copy media into repo) ✓; parsing rules incl. multi-line/system lines (Task 1) ✓; all 6 media-type rows from the spec table (Task 3: pdf/image/sticker, Task 4: audio/video, Task 6: hidden-media and "other" placeholders) ✓; synthetic id + idempotency (Task 1 + Task 2 dedup test) ✓; live-capture dedup (Task 2 + Task 6 test) ✓; reuse of unmodified `run_extraction()` (Task 7) ✓; new vision-only env vars (Task 5) ✓; tests never hit real APIs/GPU (mocked throughout) ✓.
- **Placeholder scan:** no TBD/TODO; every step has runnable code and exact commands.
- **Type consistency:** `resolve_fns` dict keys (`'pdf'`, `'image'`, `'audio'`, `'video'`) are identical across Task 6 (`_resolve_body`) and Task 7 (`build_resolve_fns`); `process_group` return shape (`inserted`/`skipped_dup`/`total`) matches between its Task 6 definition and Task 7's caller.
