import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Message {
  id?: number;
  wa_message_id: string;
  group_label: string;
  author: string;
  body: string | null;
  timestamp: string;
  processed?: number;
  created_at?: string;
  activity_count?: number;
}

export interface Activity {
  id?: number;
  type: string;
  title: string;
  description?: string;
  due_date: string;
  source_message_id: number;
  status?: string;
  confidence?: string;
  created_at?: string;
  group_label?: string;
  author?: string;
  message_timestamp?: string;
}

export interface LLMUsage {
  timestamp: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  messages_in_batch: number;
}

export interface UsageSummary {
  prompt_tokens: number;
  completion_tokens: number;
  run_count: number;
  last_run_at: string | null;
}

let db: Database.Database | null = null;

function getDbPath(): string {
  const dbPath = process.env.DB_PATH || './data/app.db';
  const repoRoot = resolve(__dirname, '../../..');
  if (dbPath.startsWith('./')) {
    return resolve(repoRoot, dbPath);
  }
  return dbPath;
}

export function openDb(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDbPath();
  const dir = dirname(dbPath);

  // Ensure directory exists
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Initialize schema
  const schemaPath = resolve(__dirname, '../../..', 'shared', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function insertMessage(
  waMessageId: string,
  groupLabel: string,
  author: string,
  body: string,
  timestamp: string
): void {
  const database = openDb();
  try {
    const stmt = database.prepare(`
      INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed)
      VALUES (?, ?, ?, ?, ?, 0)
    `);
    stmt.run(waMessageId, groupLabel, author, body, timestamp);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      // Message already exists, silently skip
    } else {
      throw err;
    }
  }
}

export function fetchUnprocessedMessages(batchSize: number = 30): Message[] {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT id, wa_message_id, group_label, author, body, timestamp
    FROM messages
    WHERE processed = 0
    ORDER BY timestamp ASC
    LIMIT ?
  `);
  const rows = stmt.all(batchSize) as Message[];
  return rows;
}

export function fetchUnprocessedCount(): number {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE processed = 0
  `);
  const row = stmt.get() as any;
  return row.count;
}

export function markBatchProcessed(messageIds: number[]): void {
  if (messageIds.length === 0) return;

  const database = openDb();
  const placeholders = messageIds.map(() => '?').join(',');
  const stmt = database.prepare(`
    UPDATE messages SET processed = 1 WHERE id IN (${placeholders})
  `);
  stmt.run(...messageIds);
}

export function insertActivities(activities: Activity[]): number[] {
  if (activities.length === 0) return [];

  const database = openDb();
  const insertedIds: number[] = [];

  const stmt = database.prepare(`
    INSERT INTO activities (type, title, description, due_date, source_message_id, status, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const act of activities) {
    const info = stmt.run(
      act.type,
      act.title,
      act.description || '',
      act.due_date,
      act.source_message_id,
      act.status || 'pendente',
      act.confidence || 'media',
      new Date().toISOString()
    );
    if (info.lastInsertRowid) {
      insertedIds.push(Number(info.lastInsertRowid));
    }
  }

  return insertedIds;
}

export function fetchActivities(status?: string, limit: number = 500): Activity[] {
  const database = openDb();
  let stmt;

  if (status) {
    stmt = database.prepare(`
      SELECT a.*, m.group_label, m.author, m.timestamp as message_timestamp
      FROM activities a
      LEFT JOIN messages m ON a.source_message_id = m.id
      WHERE a.status = ?
      ORDER BY a.due_date ASC
      LIMIT ?
    `);
    return stmt.all(status, limit) as Activity[];
  } else {
    stmt = database.prepare(`
      SELECT a.*, m.group_label, m.author, m.timestamp as message_timestamp
      FROM activities a
      LEFT JOIN messages m ON a.source_message_id = m.id
      ORDER BY a.due_date ASC
      LIMIT ?
    `);
    return stmt.all(limit) as Activity[];
  }
}

export function updateActivityStatus(activityId: number, status: string): void {
  const database = openDb();
  const stmt = database.prepare(`
    UPDATE activities SET status = ? WHERE id = ?
  `);
  stmt.run(status, activityId);
}

export function checkDuplicateActivity(
  type: string,
  titleNormalized: string,
  dueDate: string
): boolean {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT title FROM activities
    WHERE type = ? AND due_date = ? AND status != 'descartado'
  `);
  const rows = stmt.all(type, dueDate) as any[];

  for (const row of rows) {
    if (normalizeTitle(row.title) === titleNormalized) {
      return true;
    }
  }
  return false;
}

function normalizeTitle(title: string): string {
  title = title.toLowerCase();
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function fetchMessages(limit: number = 200, offset: number = 0, searchQuery?: string): Message[] {
  const database = openDb();
  let stmt;

  if (searchQuery) {
    stmt = database.prepare(`
      SELECT m.*,
             (SELECT COUNT(*) FROM activities WHERE source_message_id = m.id) as activity_count
      FROM messages m
      WHERE author LIKE ? OR body LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(`%${searchQuery}%`, `%${searchQuery}%`, limit, offset) as Message[];
  } else {
    stmt = database.prepare(`
      SELECT m.*,
             (SELECT COUNT(*) FROM activities WHERE source_message_id = m.id) as activity_count
      FROM messages m
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Message[];
  }
}

export function fetchMessagesCount(searchQuery?: string): number {
  const database = openDb();
  let stmt;

  if (searchQuery) {
    stmt = database.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE author LIKE ? OR body LIKE ?
    `);
    const row = stmt.get(`%${searchQuery}%`, `%${searchQuery}%`) as any;
    return row.count;
  } else {
    stmt = database.prepare(`SELECT COUNT(*) as count FROM messages`);
    const row = stmt.get() as any;
    return row.count;
  }
}

export function messageExists(waMessageId: string): boolean {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT 1 FROM messages WHERE wa_message_id = ? LIMIT 1
  `);
  return stmt.get(waMessageId) !== undefined;
}

export function messageSimilarExists(
  groupLabel: string,
  author: string,
  timestamp: string,
  body: string
): boolean {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT 1 FROM messages
    WHERE group_label = ? AND author = ? AND body = ?
      AND substr(timestamp, 1, 16) = substr(?, 1, 16)
    LIMIT 1
  `);
  return stmt.get(groupLabel, author, body, timestamp) !== undefined;
}

export function insertLLMUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
  messagesInBatch: number
): void {
  const database = openDb();
  const stmt = database.prepare(`
    INSERT INTO llm_usage (timestamp, model, prompt_tokens, completion_tokens, messages_in_batch)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    new Date().toISOString(),
    model,
    promptTokens,
    completionTokens,
    messagesInBatch
  );
}

export function fetchUsageSummary(since?: string): UsageSummary {
  const database = openDb();
  let stmt;

  if (since) {
    stmt = database.prepare(`
      SELECT COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) as completion_tokens,
             COUNT(*) as run_count,
             MAX(timestamp) as last_run_at
      FROM llm_usage
      WHERE timestamp >= ?
    `);
    return stmt.get(since) as UsageSummary;
  } else {
    stmt = database.prepare(`
      SELECT COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) as completion_tokens,
             COUNT(*) as run_count,
             MAX(timestamp) as last_run_at
      FROM llm_usage
    `);
    return stmt.get() as UsageSummary;
  }
}

export function fetchActivityStatusCounts(): Record<string, number> {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT status, COUNT(*) as count FROM activities GROUP BY status
  `);
  const rows = stmt.all() as any[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}

export function fetchActivityTypeCounts(): Record<string, number> {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT type, COUNT(*) as count FROM activities GROUP BY type
  `);
  const rows = stmt.all() as any[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.type] = row.count;
  }
  return result;
}

export interface MessageStats {
  total: number;
  first_timestamp: string | null;
}

export function fetchMessageStats(): MessageStats {
  const database = openDb();
  const stmt = database.prepare(`
    SELECT COUNT(*) as total, MIN(timestamp) as first_timestamp FROM messages
  `);
  return stmt.get() as MessageStats;
}
