import json
import os
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.extraction import run_extraction
from lib.db import fetch_activities, fetch_unprocessed_count


def create_test_db():
    """Create empty test database file."""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)
    return db_path


def init_test_schema(db_path):
    """Initialize test database schema."""
    schema_path = Path(__file__).parent.parent.parent / 'shared' / 'schema.sql'
    schema = schema_path.read_text()

    conn = sqlite3.connect(db_path)
    conn.executescript(schema)
    conn.commit()
    conn.close()


def insert_message(db_path, wa_message_id, body):
    """Insert an unprocessed message directly and return its id."""
    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        (wa_message_id, 'alunos', 'João', body, datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()
    return msg_id


def is_processed(db_path, msg_id):
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT processed FROM messages WHERE id = ?", (msg_id,)).fetchone()
    conn.close()
    return row[0]


def make_llm_response(content, prompt_tokens=10, completion_tokens=5):
    """Build a mock object shaped like an OpenAI chat completion response."""
    response = MagicMock()
    response.usage.prompt_tokens = prompt_tokens
    response.usage.completion_tokens = completion_tokens
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    return response


def setup_env(db_path):
    os.environ['DB_PATH'] = db_path
    os.environ['OPENCODE_API_KEY'] = 'test-key'


@patch('lib.extraction.OpenAI')
def test_run_extraction_success(mock_openai_cls):
    db_path = create_test_db()
    init_test_schema(db_path)
    setup_env(db_path)

    msg_id = insert_message(db_path, 'msg1', 'Prova de Redes dia 10/07')

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = make_llm_response(
        json.dumps({
            "items": [
                {
                    "type": "prova",
                    "title": "Prova de Redes",
                    "due_date": "2026-07-10",
                    "source_message_id": msg_id,
                    "confidence": "alta",
                }
            ]
        })
    )
    mock_openai_cls.return_value = mock_client

    result = run_extraction()

    assert result['activities_extracted'] == 1
    assert result['messages_processed'] == 1
    assert result['messages_remaining'] == 0
    assert result['errors'] == []
    assert result['total_tokens_used'] == 15

    activities = fetch_activities()
    assert len(activities) == 1
    assert activities[0]['title'] == 'Prova de Redes'
    assert activities[0]['source_message_id'] == msg_id

    assert is_processed(db_path, msg_id) == 1

    os.unlink(db_path)


@patch('lib.extraction.OpenAI')
def test_run_extraction_hallucinated_source_id(mock_openai_cls):
    db_path = create_test_db()
    init_test_schema(db_path)
    setup_env(db_path)

    msg_id = insert_message(db_path, 'msg1', 'Alguém sabe se tem prova hoje?')
    fake_id = msg_id + 9999

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = make_llm_response(
        json.dumps({
            "items": [
                {
                    "type": "prova",
                    "title": "Prova Inventada",
                    "due_date": "2026-07-10",
                    "source_message_id": fake_id,
                    "confidence": "alta",
                }
            ]
        })
    )
    mock_openai_cls.return_value = mock_client

    result = run_extraction()

    assert result['activities_extracted'] == 0
    assert result['messages_processed'] == 1
    assert result['errors'] == []

    assert fetch_activities() == []
    assert is_processed(db_path, msg_id) == 1

    os.unlink(db_path)


@patch('lib.extraction.OpenAI')
def test_run_extraction_invalid_json(mock_openai_cls):
    db_path = create_test_db()
    init_test_schema(db_path)
    setup_env(db_path)

    msg_id = insert_message(db_path, 'msg1', 'Bom dia turma')

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = make_llm_response(
        'Desculpe, não consigo processar isso.'
    )
    mock_openai_cls.return_value = mock_client

    result = run_extraction()

    assert result['activities_extracted'] == 0
    assert result['messages_processed'] == 1
    assert result['errors'] == []

    assert fetch_activities() == []
    assert is_processed(db_path, msg_id) == 1

    os.unlink(db_path)


@patch('lib.extraction.OpenAI')
def test_run_extraction_api_error_leaves_batch_unprocessed(mock_openai_cls):
    db_path = create_test_db()
    init_test_schema(db_path)
    setup_env(db_path)

    msg_id = insert_message(db_path, 'msg1', 'Prova de Redes dia 10/07')

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = ConnectionError('network unreachable')
    mock_openai_cls.return_value = mock_client

    result = run_extraction(max_batches=1)

    assert result['activities_extracted'] == 0
    assert result['messages_processed'] == 0
    assert len(result['errors']) == 1
    assert result['messages_remaining'] == 1

    assert fetch_activities() == []
    assert is_processed(db_path, msg_id) == 0

    os.unlink(db_path)
