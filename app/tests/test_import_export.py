import sys
import os
import sqlite3
import tempfile
import time
import zipfile
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.import_export import find_export_txt, extract_if_zip, process_group, _run_with_timeout, caption_bytes_via_subprocess


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


def test_find_export_txt_locates_single_txt():
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


def test_run_with_timeout_returns_value_when_fast_enough():
    result = _run_with_timeout(lambda x: x * 2, 21, timeout_seconds=1)
    assert result == 42


def test_run_with_timeout_raises_when_function_hangs():
    def hangs(_):
        time.sleep(5)
        return 'nunca deveria chegar aqui'

    start = time.time()
    try:
        _run_with_timeout(hangs, None, timeout_seconds=1)
        assert False, "should have raised"
    except TimeoutError as e:
        assert 'travou' in str(e)
    elapsed = time.time() - start
    assert elapsed < 3, f"should give up around the 1s timeout, took {elapsed}s"


def test_caption_bytes_via_subprocess_returns_stripped_stdout():
    fake_result = MagicMock(returncode=0, stdout='  Edital de prova N3  \n', stderr='')
    with patch('scripts.import_export.subprocess.run', return_value=fake_result) as mock_run:
        result = caption_bytes_via_subprocess(b'fake-image-bytes', 'foto.jpg')

    assert result == 'Edital de prova N3'
    call_args = mock_run.call_args
    assert call_args.kwargs['timeout'] == 60
    cmd = call_args.args[0]
    assert cmd[1:3] == ['-m', 'scripts._caption_worker']
    # the temp file path passed to the worker should have been cleaned up afterwards
    tmp_path = Path(cmd[3])
    assert not tmp_path.exists()


def test_caption_bytes_via_subprocess_raises_on_worker_failure():
    fake_result = MagicMock(returncode=1, stdout='', stderr='CreditsError: sem saldo')
    with patch('scripts.import_export.subprocess.run', return_value=fake_result):
        try:
            caption_bytes_via_subprocess(b'fake-image-bytes', 'foto.jpg')
            assert False, "should have raised"
        except RuntimeError as e:
            assert 'CreditsError' in str(e)


def test_process_group_resolver_failure_falls_back_to_placeholder():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: ‎FOTO.jpg (arquivo anexado)"
    )
    (export_dir / 'FOTO.jpg').write_bytes(b'fake-jpg')

    def flaky_resolver(path):
        raise TimeoutError('conexão travou')

    result = process_group(export_dir, 'alunos', resolve_fns={'image': flaky_resolver})

    assert result['inserted'] == 1
    conn = sqlite3.connect(db_path)
    body = conn.execute("SELECT body FROM messages").fetchone()[0]
    conn.close()
    assert body == '[arquivo: FOTO.jpg]'

    os.unlink(db_path)


def test_process_group_reimport_does_not_duplicate_on_nondeterministic_caption():
    db_path = create_test_db()
    init_test_schema(db_path)
    os.environ['DB_PATH'] = db_path

    export_dir = Path(tempfile.mkdtemp())
    (export_dir / 'export.txt').write_text(
        "01/07/2026 10:15 - Maria: ‎EDITAL.pdf (arquivo anexado)"
    )
    (export_dir / 'EDITAL.pdf').write_bytes(b'fake-pdf')

    first_result = process_group(
        export_dir, 'profs',
        resolve_fns={'pdf': lambda path: 'Legenda A'}
    )
    assert first_result['inserted'] == 1

    second_result = process_group(
        export_dir, 'profs',
        resolve_fns={'pdf': lambda path: 'Legenda B'}
    )
    assert second_result['inserted'] == 0
    assert second_result['skipped_dup'] == 1

    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT body FROM messages").fetchall()
    conn.close()
    assert len(rows) == 1
    assert rows[0][0] == 'Legenda A'

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
