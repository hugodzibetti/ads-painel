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
