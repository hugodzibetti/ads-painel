import sqlite3
import tempfile
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.db import (
    get_connection,
    fetch_unprocessed_messages,
    fetch_unprocessed_count,
    mark_processed,
    insert_activities,
    fetch_activities,
    update_activity_status,
    check_duplicate_activity,
    fetch_active_activities,
    fetch_messages,
    fetch_messages_count,
    insert_message,
    message_similar_exists,
    insert_llm_usage,
    fetch_usage_summary,
    fetch_activity_status_counts,
    fetch_activity_type_counts,
    fetch_message_stats,
)
from lib.text import normalize_title


def create_test_db():
    """Create in-memory test database."""
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


def test_fetch_unprocessed_count():
    """Test counting unprocessed messages."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg2', 'alunos', 'Maria', 'test2', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg3', 'alunos', 'Pedro', 'test3', datetime.now(timezone.utc).isoformat(), 1)
    )
    conn.commit()
    conn.close()

    count = fetch_unprocessed_count()
    assert count == 2, f"Expected 2 unprocessed messages, got {count}"

    os.unlink(db_path)


def test_insert_and_fetch_activities():
    """Test inserting and fetching activities."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    activities = [
        {
            'type': 'prova',
            'title': 'Prova de Redes',
            'due_date': '2026-07-10',
            'source_message_id': msg_id,
            'confidence': 'alta',
        }
    ]

    inserted_ids = insert_activities(activities)
    assert len(inserted_ids) == 1

    fetched = fetch_activities(status='pendente')
    assert len(fetched) == 1
    assert fetched[0]['title'] == 'Prova de Redes'
    assert fetched[0]['type'] == 'prova'
    assert fetched[0]['confidence'] == 'alta'

    os.unlink(db_path)


def test_update_activity_status():
    """Test updating activity status."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]

    act_id = conn.execute(
        "INSERT INTO activities (type, title, due_date, source_message_id, status, confidence) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('prova', 'Prova de Redes', '2026-07-10', msg_id, 'pendente', 'alta')
    ).fetchone()[0]
    conn.commit()
    conn.close()

    update_activity_status(act_id, 'concluido')

    activities = fetch_activities(status='concluido')
    assert len(activities) == 1
    assert activities[0]['status'] == 'concluido'

    os.unlink(db_path)


def test_check_duplicate_activity():
    """Test duplicate activity detection."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]

    conn.execute(
        "INSERT INTO activities (type, title, due_date, source_message_id, status, confidence) VALUES (?, ?, ?, ?, ?, ?)",
        ('prova', 'Prova de Redes', '2026-07-10', msg_id, 'pendente', 'alta')
    )
    conn.commit()
    conn.close()

    is_duplicate = check_duplicate_activity('prova', 'prova de redes', '2026-07-10')
    assert is_duplicate == True

    is_duplicate = check_duplicate_activity('prova', 'Prova de Banco de Dados', '2026-07-10')
    assert is_duplicate == False

    os.unlink(db_path)


def test_check_duplicate_activity_ignores_accents():
    """Duplicate detection must match regardless of accents in the stored title."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]

    conn.execute(
        "INSERT INTO activities (type, title, due_date, source_message_id, status, confidence) VALUES (?, ?, ?, ?, ?, ?)",
        ('prova', 'Cálculo I', '2026-07-10', msg_id, 'pendente', 'alta')
    )
    conn.commit()
    conn.close()

    is_duplicate = check_duplicate_activity('prova', normalize_title('Calculo I'), '2026-07-10')
    assert is_duplicate == True

    is_duplicate = check_duplicate_activity('prova', normalize_title('CALCULO I'), '2026-07-10')
    assert is_duplicate == True

    os.unlink(db_path)


def test_fetch_active_activities_excludes_descartado_and_orders_by_due_date():
    """fetch_active_activities must skip descartado and order pendente+concluido by due_date."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    insert_activities([
        {'type': 'prova', 'title': 'Prova B', 'due_date': '2026-07-20', 'source_message_id': msg_id, 'status': 'pendente'},
        {'type': 'trabalho', 'title': 'Trabalho A', 'due_date': '2026-07-05', 'source_message_id': msg_id, 'status': 'concluido'},
        {'type': 'evento', 'title': 'Evento Descartado', 'due_date': '2026-07-01', 'source_message_id': msg_id, 'status': 'descartado'},
    ])

    active = fetch_active_activities()

    assert [a['title'] for a in active] == ['Trabalho A', 'Prova B']
    assert all(a['status'] != 'descartado' for a in active)
    assert active[0]['type'] == 'trabalho'
    assert active[0]['due_date'] == '2026-07-05'

    os.unlink(db_path)


def test_fetch_active_activities_respects_limit():
    """fetch_active_activities must cap results at the given limit."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    insert_activities([
        {'type': 'prova', 'title': 'Prova 1', 'due_date': '2026-07-01', 'source_message_id': msg_id},
        {'type': 'prova', 'title': 'Prova 2', 'due_date': '2026-07-02', 'source_message_id': msg_id},
        {'type': 'prova', 'title': 'Prova 3', 'due_date': '2026-07-03', 'source_message_id': msg_id},
    ])

    active = fetch_active_activities(limit=2)

    assert len(active) == 2
    assert [a['title'] for a in active] == ['Prova 1', 'Prova 2']

    os.unlink(db_path)


def test_mark_processed():
    """Test marking messages as processed."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg1_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]

    msg2_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg2', 'alunos', 'Maria', 'test2', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    mark_processed([msg1_id, msg2_id])

    count = fetch_unprocessed_count()
    assert count == 0

    os.unlink(db_path)


def test_fetch_messages_with_search():
    """Test fetching messages with search."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg1', 'alunos', 'João', 'prova de redes', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg2', 'alunos', 'Maria', 'trabalho de banco', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.commit()
    conn.close()

    results = fetch_messages(search_query='prova')
    assert len(results) == 1
    assert 'prova' in results[0]['body']

    all_msgs = fetch_messages()
    assert len(all_msgs) == 2

    os.unlink(db_path)


def test_fetch_messages_count():
    """Test counting messages with and without a search filter."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg1', 'alunos', 'João', 'prova de redes', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg2', 'alunos', 'Maria', 'trabalho de banco', datetime.now(timezone.utc).isoformat(), 0)
    )
    conn.commit()
    conn.close()

    assert fetch_messages_count() == 2
    assert fetch_messages_count(search_query='prova') == 1
    assert fetch_messages_count(search_query='Maria') == 1
    assert fetch_messages_count(search_query='inexistente') == 0

    os.unlink(db_path)


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


def test_insert_llm_usage_and_fetch_summary():
    """Test recording LLM usage rows and aggregating them for the Status page."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    insert_llm_usage('deepseek-v4-flash', 1000, 200, 10)
    insert_llm_usage('deepseek-v4-flash', 500, 100, 5)

    summary = fetch_usage_summary()
    assert summary['prompt_tokens'] == 1500
    assert summary['completion_tokens'] == 300
    assert summary['run_count'] == 2
    assert summary['last_run_at'] is not None

    os.unlink(db_path)


def test_fetch_usage_summary_since_excludes_older_rows():
    """Test that the `since` cutoff on fetch_usage_summary excludes rows before it."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO llm_usage (timestamp, model, prompt_tokens, completion_tokens, messages_in_batch) VALUES (?, ?, ?, ?, ?)",
        ('2020-01-01T00:00:00+00:00', 'deepseek-v4-flash', 1000, 200, 10)
    )
    conn.commit()
    conn.close()

    insert_llm_usage('deepseek-v4-flash', 50, 10, 1)

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    summary = fetch_usage_summary(since=since)
    assert summary['prompt_tokens'] == 50
    assert summary['run_count'] == 1

    os.unlink(db_path)


def test_fetch_usage_summary_empty():
    """Test that an empty llm_usage table returns zeroed totals, not None/errors."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    summary = fetch_usage_summary()
    assert summary['prompt_tokens'] == 0
    assert summary['completion_tokens'] == 0
    assert summary['run_count'] == 0
    assert summary['last_run_at'] is None

    os.unlink(db_path)


def test_fetch_activity_status_and_type_counts():
    """Test grouping activity counts by status and by type."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    insert_activities([
        {'type': 'prova', 'title': 'Prova 1', 'due_date': '2026-07-10', 'source_message_id': msg_id},
        {'type': 'prova', 'title': 'Prova 2', 'due_date': '2026-07-11', 'source_message_id': msg_id},
        {'type': 'trabalho', 'title': 'Trabalho 1', 'due_date': '2026-07-12', 'source_message_id': msg_id},
    ])
    inserted = fetch_activities(status='pendente')
    update_activity_status(inserted[0]['id'], 'concluido')

    status_counts = fetch_activity_status_counts()
    assert status_counts.get('pendente') == 2
    assert status_counts.get('concluido') == 1

    type_counts = fetch_activity_type_counts()
    assert type_counts.get('prova') == 2
    assert type_counts.get('trabalho') == 1

    os.unlink(db_path)


def test_fetch_message_stats():
    """Test total count and earliest timestamp for the Status page's message summary."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    stats = fetch_message_stats()
    assert stats['total'] == 0
    assert stats['first_timestamp'] is None

    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg1', 'alunos', 'João', 'test', '2026-01-01T00:00:00+00:00', 0)
    )
    conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?)",
        ('msg2', 'alunos', 'Maria', 'test2', '2026-02-01T00:00:00+00:00', 0)
    )
    conn.commit()
    conn.close()

    stats = fetch_message_stats()
    assert stats['total'] == 2
    assert stats['first_timestamp'] == '2026-01-01T00:00:00+00:00'

    os.unlink(db_path)


if __name__ == '__main__':
    test_fetch_unprocessed_count()
    print("✓ test_fetch_unprocessed_count")

    test_insert_and_fetch_activities()
    print("✓ test_insert_and_fetch_activities")

    test_update_activity_status()
    print("✓ test_update_activity_status")

    test_check_duplicate_activity()
    print("✓ test_check_duplicate_activity")

    test_check_duplicate_activity_ignores_accents()
    print("✓ test_check_duplicate_activity_ignores_accents")

    test_fetch_active_activities_excludes_descartado_and_orders_by_due_date()
    print("✓ test_fetch_active_activities_excludes_descartado_and_orders_by_due_date")

    test_fetch_active_activities_respects_limit()
    print("✓ test_fetch_active_activities_respects_limit")

    test_mark_processed()
    print("✓ test_mark_processed")

    test_fetch_messages_with_search()
    print("✓ test_fetch_messages_with_search")

    test_fetch_messages_count()
    print("✓ test_fetch_messages_count")

    test_insert_message_creates_row()
    print("✓ test_insert_message_creates_row")

    test_insert_message_swallows_duplicate()
    print("✓ test_insert_message_swallows_duplicate")

    test_message_similar_exists_matches_same_minute()
    print("✓ test_message_similar_exists_matches_same_minute")

    test_insert_llm_usage_and_fetch_summary()
    print("✓ test_insert_llm_usage_and_fetch_summary")

    test_fetch_usage_summary_since_excludes_older_rows()
    print("✓ test_fetch_usage_summary_since_excludes_older_rows")

    test_fetch_usage_summary_empty()
    print("✓ test_fetch_usage_summary_empty")

    test_fetch_activity_status_and_type_counts()
    print("✓ test_fetch_activity_status_and_type_counts")

    test_fetch_message_stats()
    print("✓ test_fetch_message_stats")

    print("\nAll tests passed!")
