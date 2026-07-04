import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
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

export interface ActivityWithDelivery extends Activity {
  is_graded: number;
  delivery_method: string | null;
  delivery_url: string | null;
  delivery_instructions: string | null;
  delivery_context: string | null;
  delivery_draft: string | null;
  delivery_stage: string;
  days_until_due: number;
  urgency_label: string;
  urgency_color: string;
}

export interface Briefing {
  id?: number;
  content: string;
  created_at: string;
  activities_count: number;
}

export interface KnowledgeBase {
  id?: number;
  content: string;
  generated_at: string;
  messages_read: number;
}

export interface OutgoingMessage {
  id?: number;
  group_label: string;
  body: string;
  activity_id: number | null;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export function runMigrations(database: Database.Database): void {
  const actCols = (database.prepare('PRAGMA table_info(activities)').all() as any[]).map((c: any) => c.name);
  const addAct = (col: string, def: string) => {
    if (!actCols.includes(col)) database.exec(`ALTER TABLE activities ADD COLUMN ${col} ${def}`);
  };
  addAct('is_graded', 'INTEGER DEFAULT 1');
  addAct('delivery_method', 'TEXT');
  addAct('delivery_url', 'TEXT');
  addAct('delivery_instructions', 'TEXT');
  addAct('delivery_context', 'TEXT');
  addAct('delivery_draft', 'TEXT');
  addAct('delivery_stage', "TEXT DEFAULT 'detecting'");

  const usageCols = (database.prepare('PRAGMA table_info(llm_usage)').all() as any[]).map((c: any) => c.name);
  if (!usageCols.includes('run_id')) database.exec('ALTER TABLE llm_usage ADD COLUMN run_id TEXT');
}

let db: Database.Database | null = null;

function getDbPath(): string {
  const dbPath = process.env.DB_PATH || './data/app.db';
  const repoRoot = resolve(__dirname, '../../');
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
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Initialize schema
  const schemaPath = resolve(__dirname, '../../', 'shared', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  runMigrations(db);

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
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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

function computeUrgency(daysUntilDue: number, dueDateStr: string): { urgency_label: string; urgency_color: string } {
  if (daysUntilDue < 0) return { urgency_label: 'VENCIDO', urgency_color: 'danger' };
  if (daysUntilDue === 0) return { urgency_label: 'HOJE', urgency_color: 'danger' };
  if (daysUntilDue === 1) return { urgency_label: 'AMANHÃ', urgency_color: 'warning' };
  if (daysUntilDue <= 7) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const d = new Date(dueDateStr + 'T12:00:00');
    return { urgency_label: days[d.getDay()], urgency_color: 'info' };
  }
  const [, month, day] = dueDateStr.split('-');
  return { urgency_label: `${day}/${month}`, urgency_color: 'neutral' };
}

export function fetchActivities(status?: string, urgency?: string, limit: number = 500): ActivityWithDelivery[] {
  const database = openDb();
  let query = `
    SELECT a.*,
           m.group_label, m.author, m.timestamp as message_timestamp,
           CAST(ROUND(julianday(DATE(a.due_date)) - julianday(DATE('now', 'localtime'))) AS INTEGER) as days_until_due
    FROM activities a
    LEFT JOIN messages m ON a.source_message_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (urgency === 'urgent') { query += ' AND ROUND(julianday(DATE(a.due_date)) - julianday(DATE(\'now\', \'localtime\'))) <= 7'; }
  if (urgency === 'future') { query += ' AND ROUND(julianday(DATE(a.due_date)) - julianday(DATE(\'now\', \'localtime\'))) > 7'; }
  query += ' ORDER BY a.due_date ASC LIMIT ?';
  params.push(limit);

  const rows = database.prepare(query).all(...params) as any[];
  return rows.map((row) => {
    const { urgency_label, urgency_color } = computeUrgency(row.days_until_due, row.due_date);
    return { ...row, urgency_label, urgency_color } as ActivityWithDelivery;
  });
}

export function updateActivityDelivery(activityId: number, fields: Partial<Pick<ActivityWithDelivery, 'is_graded' | 'delivery_method' | 'delivery_url' | 'delivery_instructions' | 'delivery_draft' | 'delivery_stage'>>): void {
  const database = openDb();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  database.prepare(`UPDATE activities SET ${setClauses} WHERE id = ?`).run(...values, activityId);
}

export function appendActivityContext(activityId: number, item: { message_id: number; author: string; body: string; timestamp: string }): void {
  const database = openDb();
  const row = database.prepare('SELECT delivery_context FROM activities WHERE id = ?').get(activityId) as any;
  const existing: any[] = row?.delivery_context ? JSON.parse(row.delivery_context) : [];
  existing.push(item);
  database.prepare('UPDATE activities SET delivery_context = ? WHERE id = ?').run(JSON.stringify(existing), activityId);
}

export function insertBriefing(content: string, activitiesCount: number): void {
  openDb().prepare('INSERT INTO briefings (content, activities_count, created_at) VALUES (?, ?, ?)').run(content, activitiesCount, new Date().toISOString());
}

export function fetchLatestBriefing(): Briefing | null {
  return (openDb().prepare('SELECT * FROM briefings ORDER BY created_at DESC LIMIT 1').get() as Briefing | undefined) ?? null;
}

export function insertKnowledgeBase(content: string, messagesRead: number): void {
  openDb().prepare('INSERT INTO knowledge_base (content, messages_read, generated_at) VALUES (?, ?, ?)').run(content, messagesRead, new Date().toISOString());
}

export function fetchLatestKnowledgeBase(): KnowledgeBase | null {
  return (openDb().prepare('SELECT * FROM knowledge_base ORDER BY generated_at DESC LIMIT 1').get() as KnowledgeBase | undefined) ?? null;
}

export function insertOutgoingMessage(groupLabel: string, body: string, activityId: number | null): void {
  openDb().prepare('INSERT INTO outgoing_messages (group_label, body, activity_id) VALUES (?, ?, ?)').run(groupLabel, body, activityId);
}

export function fetchPendingOutgoing(): OutgoingMessage[] {
  return openDb().prepare("SELECT * FROM outgoing_messages WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10").all() as OutgoingMessage[];
}

export function markOutgoingSent(id: number): void {
  openDb().prepare("UPDATE outgoing_messages SET status = 'sent', sent_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function fetchActivitiesForBriefing(): ActivityWithDelivery[] {
  const database = openDb();
  const rows = database.prepare(`
    SELECT a.*,
           m.group_label, m.author, m.timestamp as message_timestamp,
           CAST(ROUND(julianday(DATE(a.due_date)) - julianday(DATE('now', 'localtime'))) AS INTEGER) as days_until_due
    FROM activities a
    LEFT JOIN messages m ON a.source_message_id = m.id
    WHERE a.status = 'pendente' AND a.is_graded = 1
    ORDER BY a.due_date ASC
    LIMIT 200
  `).all() as any[];
  return rows.map((row) => {
    const { urgency_label, urgency_color } = computeUrgency(row.days_until_due, row.due_date);
    return { ...row, urgency_label, urgency_color } as ActivityWithDelivery;
  });
}

export function fetchActivitiesForDrafting(): ActivityWithDelivery[] {
  const database = openDb();
  const rows = database.prepare(`
    SELECT a.*,
           m.group_label, m.author, m.timestamp as message_timestamp,
           CAST(ROUND(julianday(DATE(a.due_date)) - julianday(DATE('now', 'localtime'))) AS INTEGER) as days_until_due
    FROM activities a
    LEFT JOIN messages m ON a.source_message_id = m.id
    WHERE a.status = 'pendente' AND a.is_graded = 1
    ORDER BY a.due_date ASC
    LIMIT 200
  `).all() as any[];
  return rows.map((row) => {
    const { urgency_label, urgency_color } = computeUrgency(row.days_until_due, row.due_date);
    return { ...row, urgency_label, urgency_color } as ActivityWithDelivery;
  });
}

export function fetchWeekDensity(): Record<string, number> {
  const database = openDb();
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const mondayStr = monday.toISOString().slice(0, 10);

  const rows = database.prepare(`
    SELECT due_date, COUNT(*) as count
    FROM activities
    WHERE is_graded = 1 AND status = 'pendente'
      AND due_date >= ? AND due_date <= date(?, '+6 days')
    GROUP BY due_date
  `).all(mondayStr, mondayStr) as any[];

  const labels = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const density: Record<string, number> = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 };
  for (const row of rows) {
    const d = new Date(row.due_date + 'T12:00:00');
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    density[labels[idx]] = row.count;
  }
  return density;
}

export function fetchExtractionRuns(limit: number = 20): any[] {
  return openDb().prepare(`
    SELECT run_id, MIN(timestamp) as started_at,
           SUM(prompt_tokens) as prompt_tokens,
           SUM(completion_tokens) as completion_tokens,
           SUM(messages_in_batch) as messages_in_batch,
           COUNT(*) as batch_count
    FROM llm_usage WHERE run_id IS NOT NULL
    GROUP BY run_id ORDER BY started_at DESC LIMIT ?
  `).all(limit) as any[];
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
  messagesInBatch: number,
  runId?: string
): void {
  openDb().prepare(`
    INSERT INTO llm_usage (timestamp, model, prompt_tokens, completion_tokens, messages_in_batch, run_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(new Date().toISOString(), model, promptTokens, completionTokens, messagesInBatch, runId ?? null);
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
