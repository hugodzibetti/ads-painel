import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.extraction import (
    normalize_title,
    extract_json_from_response,
    run_extraction,
)


def create_test_db():
    """Create a temporary sqlite db file initialized with the shared schema."""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)

    schema_path = Path(__file__).parent.parent.parent / 'shared' / 'schema.sql'
    schema = schema_path.read_text()

    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    conn.close()

    return db_path


def make_mock_openai_response(items):
    """Build a fake OpenAI chat.completions.create() response."""
    response = MagicMock()
    response.usage.prompt_tokens = 10
    response.usage.completion_tokens = 5
    response.choices = [MagicMock()]
    response.choices[0].message.content = json.dumps({"items": items})
    return response


def test_normalize_title():
    """Test title normalization."""
    assert normalize_title('Prova de Redes') == 'prova de redes'
    assert normalize_title('PROVA DE REDES') == 'prova de redes'

    assert normalize_title('Prova de Cálculo') == 'prova de calculo'
    assert normalize_title('Programação') == 'programacao'

    assert normalize_title('Prova') == 'prova'
    assert normalize_title('Prova de Pré-Cálculo') == 'prova de pre-calculo'


def test_extract_json_from_response_plain_json():
    """Test extracting plain JSON from response."""
    response = '{"items": [{"type": "prova", "title": "Test"}]}'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'][0]['type'] == 'prova'


def test_extract_json_from_response_with_markdown():
    """Test extracting JSON from markdown code fence."""
    response = '```json\n{"items": [{"type": "prova"}]}\n```'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'][0]['type'] == 'prova'


def test_extract_json_from_response_with_markdown_no_lang():
    """Test extracting JSON from markdown code fence without language."""
    response = '```\n{"items": [{"type": "trabalho"}]}\n```'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'][0]['type'] == 'trabalho'


def test_extract_json_from_response_with_text_before():
    """Test extracting JSON with text before it."""
    response = 'Here is the analysis:\n```json\n{"items": []}\n```'
    result = extract_json_from_response(response)
    assert result is not None
    assert result['items'] == []


def test_extract_json_from_response_invalid():
    """Test handling invalid JSON."""
    response = 'This is not JSON'
    result = extract_json_from_response(response)
    assert result is None


def test_extract_json_from_response_with_nested():
    """Test extracting complex nested JSON."""
    response = '''```json
{
  "items": [
    {
      "type": "prova",
      "title": "Prova de Redes",
      "description": "Com conteúdo especial",
      "due_date": "2026-07-10",
      "source_message_id": 123,
      "confidence": "alta"
    }
  ]
}
```'''
    result = extract_json_from_response(response)
    assert result is not None
    assert len(result['items']) == 1
    assert result['items'][0]['title'] == 'Prova de Redes'
    assert result['items'][0]['source_message_id'] == 123


def test_extract_json_multiple_items():
    """Test extracting multiple items."""
    response = '''
{
  "items": [
    {"type": "prova", "title": "Prova 1", "due_date": "2026-07-10", "source_message_id": 1},
    {"type": "trabalho", "title": "Trabalho 1", "due_date": "2026-07-20", "source_message_id": 2},
    {"type": "evento", "title": "Evento 1", "due_date": "2026-08-01", "source_message_id": 3}
  ]
}
'''
    result = extract_json_from_response(response)
    assert result is not None
    assert len(result['items']) == 3
    assert result['items'][0]['type'] == 'prova'
    assert result['items'][1]['type'] == 'trabalho'
    assert result['items'][2]['type'] == 'evento'


def test_run_extraction_marks_processed_despite_bad_timestamp():
    """
    Regression test: a message with a malformed timestamp must not stop the
    batch from reaching the API call and being marked processed=1 — otherwise
    it gets retried forever on every "Atualizar" click (see CLAUDE.md contract:
    only network/auth errors on the API call itself should leave processed=0).
    """
    db_path = create_test_db()
    os.environ['DB_PATH'] = db_path
    os.environ['OPENCODE_API_KEY'] = 'test-key'

    conn = sqlite3.connect(db_path)
    good_ts = datetime.now(timezone.utc).isoformat()
    msg1_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'Prova de redes amanhã', 'not-a-date', 0)
    ).fetchone()[0]
    msg2_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg2', 'profs', 'Prof. Silva', 'Trabalho entrega terça', good_ts, 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    mock_response = make_mock_openai_response([])
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    with patch('lib.extraction.OpenAI', return_value=mock_client):
        result = run_extraction(max_batches=1)

    assert result['errors'] == []
    assert result['messages_processed'] == 2
    assert result['messages_remaining'] == 0

    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT id, processed FROM messages WHERE id IN (?, ?)", (msg1_id, msg2_id)
    ).fetchall()
    conn.close()
    assert all(processed == 1 for _, processed in rows)

    os.unlink(db_path)


def test_run_extraction_persists_llm_usage():
    """Each successful API call must record a row in llm_usage for the Status page's cost tracking."""
    db_path = create_test_db()
    os.environ['DB_PATH'] = db_path
    os.environ['OPENCODE_API_KEY'] = 'test-key'
    os.environ['OPENCODE_MODEL'] = 'deepseek-v4-flash'

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg1', 'alunos', 'João', 'Prova de redes amanhã', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.commit()
    conn.close()

    mock_response = make_mock_openai_response([])
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    with patch('lib.extraction.OpenAI', return_value=mock_client):
        run_extraction(max_batches=1)

    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT model, prompt_tokens, completion_tokens, messages_in_batch FROM llm_usage"
    ).fetchall()
    conn.close()

    assert len(rows) == 1
    assert rows[0] == ('deepseek-v4-flash', 10, 5, 1)

    os.unlink(db_path)


if __name__ == '__main__':
    test_normalize_title()
    print("✓ test_normalize_title")

    test_extract_json_from_response_plain_json()
    print("✓ test_extract_json_from_response_plain_json")

    test_extract_json_from_response_with_markdown()
    print("✓ test_extract_json_from_response_with_markdown")

    test_extract_json_from_response_with_markdown_no_lang()
    print("✓ test_extract_json_from_response_with_markdown_no_lang")

    test_extract_json_from_response_with_text_before()
    print("✓ test_extract_json_from_response_with_text_before")

    test_extract_json_from_response_invalid()
    print("✓ test_extract_json_from_response_invalid")

    test_extract_json_from_response_with_nested()
    print("✓ test_extract_json_from_response_with_nested")

    test_extract_json_multiple_items()
    print("✓ test_extract_json_multiple_items")

    test_run_extraction_marks_processed_despite_bad_timestamp()
    print("✓ test_run_extraction_marks_processed_despite_bad_timestamp")

    test_run_extraction_persists_llm_usage()
    print("✓ test_run_extraction_persists_llm_usage")

    print("\nAll tests passed!")
