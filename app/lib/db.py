import sqlite3
import os
import logging
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from lib.text import normalize_title

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).resolve().parents[2] / '.env')

def get_db_path():
    """Resolve DB_PATH against repo root."""
    db_path = os.getenv('DB_PATH', './data/app.db')
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / db_path

def get_connection():
    """Open a new DB connection with schema initialized."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path), timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")

    schema_path = Path(__file__).resolve().parents[2] / 'shared' / 'schema.sql'
    schema = schema_path.read_text()
    conn.executescript(schema)
    conn.commit()

    return conn

def fetch_unprocessed_messages(batch_size=30):
    """Fetch unprocessed messages ordered by timestamp."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT id, wa_message_id, group_label, author, body, timestamp
            FROM messages
            WHERE processed = 0
            ORDER BY timestamp ASC
            LIMIT ?
            """,
            (batch_size,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def fetch_unprocessed_count():
    """Count unprocessed messages."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT COUNT(*) as count FROM messages WHERE processed = 0")
        row = cursor.fetchone()
        return row['count']
    finally:
        conn.close()

def mark_processed(message_ids):
    """Mark messages as processed."""
    if not message_ids:
        return

    conn = get_connection()
    try:
        placeholders = ','.join('?' * len(message_ids))
        conn.execute(f"UPDATE messages SET processed = 1 WHERE id IN ({placeholders})", message_ids)
        conn.commit()
    finally:
        conn.close()

def insert_activities(activities):
    """Insert activities into DB. Returns list of inserted IDs."""
    if not activities:
        return []

    conn = get_connection()
    try:
        inserted_ids = []
        for act in activities:
            cursor = conn.execute(
                """
                INSERT INTO activities (type, title, description, due_date, source_message_id, status, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    act['type'],
                    act['title'],
                    act.get('description', ''),
                    act['due_date'],
                    act['source_message_id'],
                    act.get('status', 'pendente'),
                    act.get('confidence', 'media'),
                    datetime.now(timezone.utc).isoformat()
                )
            )
            inserted_ids.append(cursor.lastrowid)

        conn.commit()
        return inserted_ids
    finally:
        conn.close()

def fetch_activities(status=None, limit=500):
    """Fetch activities with optional status filter."""
    conn = get_connection()
    try:
        if status:
            cursor = conn.execute(
                """
                SELECT a.*, m.group_label, m.author, m.timestamp as message_timestamp
                FROM activities a
                LEFT JOIN messages m ON a.source_message_id = m.id
                WHERE a.status = ?
                ORDER BY a.due_date ASC
                LIMIT ?
                """,
                (status, limit)
            )
        else:
            cursor = conn.execute(
                """
                SELECT a.*, m.group_label, m.author, m.timestamp as message_timestamp
                FROM activities a
                LEFT JOIN messages m ON a.source_message_id = m.id
                ORDER BY a.due_date ASC
                LIMIT ?
                """,
                (limit,)
            )

        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def update_activity_status(activity_id, status):
    """Update activity status."""
    conn = get_connection()
    try:
        conn.execute("UPDATE activities SET status = ? WHERE id = ?", (status, activity_id))
        conn.commit()
    finally:
        conn.close()

def check_duplicate_activity(type_, title_normalized, due_date):
    """Check if a similar activity already exists.

    title_normalized must already be normalized via lib.text.normalize_title();
    candidate titles from the DB are normalized here for the comparison since
    stored titles keep their original accents/casing.
    """
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT title FROM activities
            WHERE type = ? AND due_date = ? AND status != 'descartado'
            """,
            (type_, due_date)
        )
        rows = cursor.fetchall()
        return any(normalize_title(row['title']) == title_normalized for row in rows)
    finally:
        conn.close()

def fetch_messages(limit=200, offset=0, search_query=None):
    """Fetch messages with optional search."""
    conn = get_connection()
    try:
        if search_query:
            query = """
                SELECT m.*,
                       (SELECT COUNT(*) FROM activities WHERE source_message_id = m.id) as activity_count
                FROM messages m
                WHERE author LIKE ? OR body LIKE ?
                ORDER BY m.timestamp DESC
                LIMIT ? OFFSET ?
            """
            params = (f'%{search_query}%', f'%{search_query}%', limit, offset)
        else:
            query = """
                SELECT m.*,
                       (SELECT COUNT(*) FROM activities WHERE source_message_id = m.id) as activity_count
                FROM messages m
                ORDER BY m.timestamp DESC
                LIMIT ? OFFSET ?
            """
            params = (limit, offset)

        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def fetch_messages_count(search_query=None):
    """Count messages with optional search, mirroring fetch_messages' WHERE clause."""
    conn = get_connection()
    try:
        if search_query:
            query = "SELECT COUNT(*) as count FROM messages WHERE author LIKE ? OR body LIKE ?"
            params = (f'%{search_query}%', f'%{search_query}%')
        else:
            query = "SELECT COUNT(*) as count FROM messages"
            params = ()

        cursor = conn.execute(query, params)
        row = cursor.fetchone()
        return row['count']
    finally:
        conn.close()

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

def message_exists(wa_message_id):
    """Check whether a message with this wa_message_id has already been inserted."""
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT 1 FROM messages WHERE wa_message_id = ? LIMIT 1", (wa_message_id,))
        return cursor.fetchone() is not None
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
