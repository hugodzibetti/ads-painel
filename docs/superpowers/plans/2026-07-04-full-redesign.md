# ADS Panel Full Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ADS Panel from a passive deadline tracker into an autonomous academic delivery pipeline — auto-extraction every 15 min, graded-activity classification, delivery-method detection, context monitoring, T-3 day draft generation, and a mission-control dashboard.

**Architecture:** A shared LLM client (`llm.ts`) wraps the OpenCode API and injects the knowledge base into every call. An extraction scheduler in `server.ts` fires every 15 min and chains: extract → classify → detect method → monitor context → draft (at T-3 days) → deliver. The frontend replaces the generic table with briefing, deadline density, review queue, Esta Semana, and Mais Adiante sections.

**Tech Stack:** Node.js 20, TypeScript/ESM, Express 4, better-sqlite3 (WAL), OpenAI SDK (OpenCode deepseek-v4-flash), Playwright (delivery — stubbed), @openuidev/react-lang + @openuidev/react-ui, Vitest

## Global Constraints

- `OPENCODE_MODEL` must stay `deepseek-v4-flash` — never change without pricing check
- No emojis in UI or code — icons only
- All LLM calls go through `src/server/llm.ts` after Task 2 (no direct OpenAI instantiation elsewhere)
- Timezone: `America/Sao_Paulo` in LLM prompts; UTC stored in DB
- SQLite: better-sqlite3, WAL mode, `timeout: 5000`, `busy_timeout = 5000`
- Tests: `npx vitest run` from repo root; test files at `src/**/*.test.ts`
- Playwright delivery is **stubbed** (logs what it would do, does not automate browser) — full automation is follow-up
- WhatsApp delivery uses DB outgoing-message queue polled by the bot process

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `shared/schema.sql` | Modify | Add `briefings`, `knowledge_base`, `outgoing_messages` tables + indexes |
| `src/server/db.ts` | Modify | `runMigrations()` for 7 new activity columns + `run_id` on `llm_usage`; new interfaces; new DB functions |
| `src/server/llm.ts` | Create | Shared LLM client; knowledge-base injection into every system prompt |
| `src/server/knowledge.ts` | Create | KB generator (LLM over all messages); DB seeder from `data/knowledge-base.json` on first boot |
| `src/server/deliveryDetector.ts` | Create | Graded classifier + delivery method detector (one LLM call per new activity) |
| `src/server/briefing.ts` | Create | Briefing generator; reads pending graded activities; writes to `briefings` table |
| `src/server/contextMonitor.ts` | Create | One LLM call per extraction run; appends relevant new-message context to pending activities |
| `src/server/drafter.ts` | Create | T-3 day draft generator; sets `delivery_stage = pending_review` |
| `src/server/delivery.ts` | Create | Dispatcher: stub Playwright for forms/docs, DB queue for WhatsApp, auto-done for in_person |
| `src/server/extraction.ts` | Modify | Use `llm.ts`; chain briefing + deliveryDetector + contextMonitor after each run; pass `run_id` to `insertLLMUsage` |
| `src/server/server.ts` | Modify | Scheduler; new endpoints; updated `/api/stats`; fix late import |
| `src/bot/index.ts` | Modify | Poll `outgoing_messages` table every 30s and send queued WhatsApp messages |
| `src/frontend/toolProvider.ts` | Modify | Add `get_briefing`, `get_extractions`; update `get_activities`; add `update_activity_delivery`, `deliver_activity` |
| `src/frontend/pages/Dashboard.tsx` | Rewrite | Briefing, density row, review queue, Esta Semana table, Mais Adiante accordion |
| `src/frontend/pages/Status.tsx` | Modify | Tab nav via Select: Visão Geral / Extrações / Atividades |
| `src/frontend/pages/Messages.tsx` | Modify | Card wrapper, activity-count tag, remove ID noise |

---

## Task 1: DB Foundation

**Files:**
- Modify: `shared/schema.sql`
- Modify: `src/server/db.ts`
- Test: `src/server/db.test.ts`

**Interfaces:**
- Produces: `ActivityWithDelivery`, `Briefing`, `KnowledgeBase`, `OutgoingMessage` interfaces; `runMigrations(db)`; `fetchActivities()` updated to return urgency fields; `fetchLatestBriefing()`, `insertBriefing()`, `fetchLatestKnowledgeBase()`, `insertKnowledgeBase()`, `updateActivityDelivery()`, `appendActivityContext()`, `insertOutgoingMessage()`, `fetchPendingOutgoing()`, `markOutgoingSent()`, `fetchWeekDensity()`, `fetchExtractionRuns()`, `fetchActivitiesForBriefing()`

- [ ] **Step 1: Add new tables to `shared/schema.sql`**

Append after the last `CREATE INDEX` line in `shared/schema.sql`:

```sql

CREATE TABLE IF NOT EXISTS briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activities_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  messages_read INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outgoing_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_label TEXT NOT NULL,
  body TEXT NOT NULL,
  activity_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY (activity_id) REFERENCES activities(id)
);

CREATE INDEX IF NOT EXISTS idx_briefings_created_at ON briefings(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_generated_at ON knowledge_base(generated_at);
CREATE INDEX IF NOT EXISTS idx_outgoing_messages_status ON outgoing_messages(status);
```

- [ ] **Step 2: Write failing tests for new DB functions**

Add to `src/server/db.test.ts` (below existing tests):

```typescript
describe('runMigrations — activity delivery columns', () => {
  it('adds delivery columns to activities and is idempotent', async () => {
    const { openDb, runMigrations } = await freshDb();
    const db = openDb();
    runMigrations(db);
    runMigrations(db); // second call must not throw
    const cols = (db.prepare('PRAGMA table_info(activities)').all() as any[]).map((c: any) => c.name);
    expect(cols).toContain('is_graded');
    expect(cols).toContain('delivery_method');
    expect(cols).toContain('delivery_url');
    expect(cols).toContain('delivery_instructions');
    expect(cols).toContain('delivery_context');
    expect(cols).toContain('delivery_draft');
    expect(cols).toContain('delivery_stage');
  });

  it('adds run_id column to llm_usage', async () => {
    const { openDb, runMigrations } = await freshDb();
    const db = openDb();
    runMigrations(db);
    const cols = (db.prepare('PRAGMA table_info(llm_usage)').all() as any[]).map((c: any) => c.name);
    expect(cols).toContain('run_id');
  });
});

describe('briefings table', () => {
  it('inserts and retrieves latest briefing', async () => {
    const { openDb, insertBriefing, fetchLatestBriefing } = await freshDb();
    openDb();
    expect(fetchLatestBriefing()).toBeNull();
    insertBriefing('Prova amanhã.', 2);
    const b = fetchLatestBriefing();
    expect(b?.content).toBe('Prova amanhã.');
    expect(b?.activities_count).toBe(2);
  });
});

describe('knowledge_base table', () => {
  it('inserts and retrieves latest knowledge base', async () => {
    const { openDb, insertKnowledgeBase, fetchLatestKnowledgeBase } = await freshDb();
    openDb();
    expect(fetchLatestKnowledgeBase()).toBeNull();
    insertKnowledgeBase('{"professors":[]}', 100);
    const kb = fetchLatestKnowledgeBase();
    expect(kb?.content).toBe('{"professors":[]}');
    expect(kb?.messages_read).toBe(100);
  });
});

describe('updateActivityDelivery / appendActivityContext', () => {
  it('updates delivery fields on an activity', async () => {
    const { openDb, insertMessage, insertActivities, updateActivityDelivery, fetchActivities } = await freshDb();
    openDb();
    insertMessage('wa1', 'profs', 'Prof', 'entrega', '2026-07-10T10:00:00Z');
    insertActivities([{ type: 'trabalho', title: 'TDD', due_date: '2026-07-20', source_message_id: 1, status: 'pendente', confidence: 'alta' }]);
    updateActivityDelivery(1, { delivery_method: 'google_forms', delivery_stage: 'gathering' });
    const acts = fetchActivities() as any[];
    expect(acts[0].delivery_method).toBe('google_forms');
    expect(acts[0].delivery_stage).toBe('gathering');
  });

  it('appends context JSON to delivery_context', async () => {
    const { openDb, insertMessage, insertActivities, appendActivityContext, fetchActivities } = await freshDb();
    openDb();
    insertMessage('wa1', 'profs', 'Prof', 'entrega', '2026-07-10T10:00:00Z');
    insertActivities([{ type: 'trabalho', title: 'TDD', due_date: '2026-07-20', source_message_id: 1, status: 'pendente', confidence: 'alta' }]);
    appendActivityContext(1, { message_id: 5, author: 'Aluno', body: 'Formato ABNT?', timestamp: '2026-07-11T10:00:00Z' });
    const acts = fetchActivities() as any[];
    const ctx = JSON.parse(acts[0].delivery_context || '[]');
    expect(ctx).toHaveLength(1);
    expect(ctx[0].author).toBe('Aluno');
  });
});

describe('outgoing_messages queue', () => {
  it('inserts and fetches pending outgoing messages', async () => {
    const { openDb, insertOutgoingMessage, fetchPendingOutgoing, markOutgoingSent } = await freshDb();
    openDb();
    insertOutgoingMessage('alunos', 'Trabalho entregue!', null);
    const pending = fetchPendingOutgoing();
    expect(pending).toHaveLength(1);
    expect(pending[0].body).toBe('Trabalho entregue!');
    markOutgoingSent(pending[0].id!);
    expect(fetchPendingOutgoing()).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/server/db.test.ts
```

Expected: FAIL — `runMigrations`, `insertBriefing`, etc. not found.

- [ ] **Step 4: Implement `runMigrations` and new DB functions in `src/server/db.ts`**

Add new interfaces after the existing `UsageSummary` interface:

```typescript
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
```

Add `runMigrations` function (call it from `openDb()` after `db.exec(schema)`):

```typescript
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
```

Update `openDb()` to call `runMigrations(db)` right after `db.exec(schema)`:

```typescript
  db.exec(schema);
  runMigrations(db);  // <-- add this line
```

Replace existing `fetchActivities` with a version that adds urgency fields and delivery columns:

```typescript
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
           CAST(ROUND(julianday(a.due_date) - julianday('now', 'localtime')) AS INTEGER) as days_until_due
    FROM activities a
    LEFT JOIN messages m ON a.source_message_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (urgency === 'urgent') { query += ' AND ROUND(julianday(a.due_date) - julianday(\'now\', \'localtime\')) <= 7'; }
  if (urgency === 'future') { query += ' AND ROUND(julianday(a.due_date) - julianday(\'now\', \'localtime\')) > 7'; }
  query += ' ORDER BY a.due_date ASC LIMIT ?';
  params.push(limit);

  const rows = database.prepare(query).all(...params) as any[];
  return rows.map((row) => {
    const { urgency_label, urgency_color } = computeUrgency(row.days_until_due, row.due_date);
    return { ...row, urgency_label, urgency_color } as ActivityWithDelivery;
  });
}
```

Add new DB functions after `fetchActivities`:

```typescript
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
  return fetchActivities('pendente', undefined, 200).filter((a) => a.is_graded === 1);
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
```

Also update `insertLLMUsage` signature to accept optional `run_id`:

```typescript
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
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run src/server/db.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/schema.sql src/server/db.ts src/server/db.test.ts
git commit -m "feat: add delivery columns, briefings/knowledge_base/outgoing tables, urgency computation"
```

---

## Task 2: Shared LLM Client + Knowledge Base Boot Seed

**Files:**
- Create: `src/server/llm.ts`
- Create: `src/server/knowledge.ts`

**Interfaces:**
- Consumes: `fetchLatestKnowledgeBase()`, `insertKnowledgeBase()` from `./db.js`
- Produces: `chat(systemPrompt, userContent, opts?) → { content, promptTokens, completionTokens }`; `getModel() → string`; `seedKnowledgeBaseIfEmpty() → Promise<void>`; `generateKnowledgeBase() → Promise<void>`

- [ ] **Step 1: Create `src/server/llm.ts`**

```typescript
import OpenAI from 'openai';
import { fetchLatestKnowledgeBase } from './db.js';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENCODE_API_KEY || '',
      baseURL: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1',
    });
  }
  return _client;
}

export function getModel(): string {
  return process.env.OPENCODE_MODEL || 'deepseek-v4-flash';
}

export async function chat(
  systemPrompt: string,
  userContent: string,
  opts: { temperature?: number; max_tokens?: number; injectKnowledgeBase?: boolean } = {}
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const { temperature = 0.3, max_tokens, injectKnowledgeBase = true } = opts;

  let fullSystem = systemPrompt;
  if (injectKnowledgeBase) {
    const kb = fetchLatestKnowledgeBase();
    if (kb?.content) {
      fullSystem = `## Contexto do grupo e universidade\n${kb.content}\n\n---\n\n${systemPrompt}`;
    }
  }

  const response = await getClient().chat.completions.create({
    model: getModel(),
    messages: [
      { role: 'system', content: fullSystem },
      { role: 'user', content: userContent },
    ],
    temperature,
    ...(max_tokens ? { max_tokens } : {}),
  });

  return {
    content: response.choices[0]?.message?.content || '',
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
  };
}
```

- [ ] **Step 2: Create `src/server/knowledge.ts`**

```typescript
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchLatestKnowledgeBase, insertKnowledgeBase, fetchMessages } from './db.js';
import { chat, getModel } from './llm.js';
import { insertLLMUsage } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function seedKnowledgeBaseIfEmpty(): Promise<void> {
  const existing = fetchLatestKnowledgeBase();
  if (existing) return;

  const jsonPath = resolve(__dirname, '../../data/knowledge-base.json');
  if (!existsSync(jsonPath)) {
    console.log('[Knowledge] No knowledge base found — run POST /api/knowledge/generate');
    return;
  }

  const content = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(content);
  insertKnowledgeBase(JSON.stringify(parsed), 0);
  console.log('[Knowledge] Seeded knowledge base from data/knowledge-base.json');
}

export async function generateKnowledgeBase(): Promise<void> {
  const messages = fetchMessages(5000, 0);
  const formatted = messages
    .filter((m) => m.body && m.body.length > 5 && m.body.length < 500)
    .map((m) => `[${m.group_label}] (${(m.timestamp || '').slice(0, 10)}) ${m.author}: ${m.body}`)
    .join('\n');

  const systemPrompt = `Você é um analista acadêmico. Analise as mensagens do WhatsApp do grupo de ADS (Análise e Desenvolvimento de Sistemas) da FASIPE Sinop e produza um documento estruturado em JSON com as seguintes informações sobre o grupo:
- professors: array de objetos com name, subjects, delivery_patterns, announcement_style
- subjects: array de objetos com name, professor, typical_activities, delivery_method
- group_norms: objeto com profs e alunos descrevendo o padrão de uso de cada grupo
- delivery_patterns: objeto mapeando método (google_forms, whatsapp, in_person, google_docs) para array de contextos/padrões observados
Responda APENAS com o JSON, sem explicações.`;

  const userPrompt = `Mensagens (${messages.length} total):\n\n${formatted}`;

  const result = await chat(systemPrompt, userPrompt, {
    temperature: 0.1,
    max_tokens: 16000,
    injectKnowledgeBase: false,
  });

  if (!result.content) {
    throw new Error('Knowledge generation returned empty content');
  }

  insertKnowledgeBase(result.content, messages.length);
  insertLLMUsage(getModel(), result.promptTokens, result.completionTokens, messages.length);
  console.log(`[Knowledge] Generated knowledge base from ${messages.length} messages`);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/llm.ts src/server/knowledge.ts
git commit -m "feat: shared LLM client with knowledge-base injection; knowledge generator with JSON seed fallback"
```

---

## Task 3: Delivery Detector

**Files:**
- Create: `src/server/deliveryDetector.ts`
- Test: `src/server/deliveryDetector.test.ts`

**Interfaces:**
- Consumes: `chat()` from `./llm.js`; `Activity`, `Message` from `./db.js`
- Produces: `classifyAndDetect(activity, sourceMessages) → Promise<DetectionResult>`

- [ ] **Step 1: Write failing test**

Create `src/server/deliveryDetector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DetectionResult } from './deliveryDetector.js';

vi.mock('./llm.js', () => ({
  chat: vi.fn(),
  getModel: vi.fn(() => 'test-model'),
}));

import { chat } from './llm.js';
const mockChat = vi.mocked(chat);

describe('classifyAndDetect', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('classifies a graded activity and detects google_forms method', async () => {
    mockChat.mockResolvedValueOnce({
      content: '{"is_graded":true,"delivery_method":"google_forms","delivery_url":"https://forms.gle/abc","delivery_instructions":null}',
      promptTokens: 100,
      completionTokens: 50,
    });

    const { classifyAndDetect } = await import('./deliveryDetector.js');
    const result: DetectionResult = await classifyAndDetect(
      { id: 1, type: 'trabalho', title: 'LP Form', due_date: '2026-07-20', source_message_id: 5, status: 'pendente', confidence: 'alta' },
      [{ id: 5, wa_message_id: 'w1', group_label: 'profs', author: 'Mônica', body: 'Forms: https://forms.gle/abc até sexta', timestamp: '2026-07-10T10:00:00Z' }]
    );

    expect(result.is_graded).toBe(true);
    expect(result.delivery_method).toBe('google_forms');
    expect(result.delivery_url).toBe('https://forms.gle/abc');
  });

  it('classifies non-graded activity as ignored', async () => {
    mockChat.mockResolvedValueOnce({
      content: '{"is_graded":false,"delivery_method":"unknown","delivery_url":null,"delivery_instructions":null}',
      promptTokens: 50,
      completionTokens: 20,
    });

    const { classifyAndDetect } = await import('./deliveryDetector.js');
    const result = await classifyAndDetect(
      { id: 2, type: 'atividade', title: 'Tem notebook?', due_date: '2026-07-11', source_message_id: 6, status: 'pendente', confidence: 'baixa' },
      [{ id: 6, wa_message_id: 'w2', group_label: 'alunos', author: 'Aluno', body: 'Tem notebook amanhã?', timestamp: '2026-07-10T11:00:00Z' }]
    );
    expect(result.is_graded).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/server/deliveryDetector.test.ts
```

- [ ] **Step 3: Create `src/server/deliveryDetector.ts`**

```typescript
import { chat } from './llm.js';
import type { Activity, Message } from './db.js';

export interface DetectionResult {
  is_graded: boolean;
  delivery_method: string;
  delivery_url: string | null;
  delivery_instructions: string | null;
}

const SYSTEM_PROMPT = `Você é um classificador de atividades acadêmicas. Analise a atividade e as mensagens de origem e retorne um JSON com:
- is_graded (boolean): true se a atividade vale nota (trabalhos, provas, formulários com nota, relatórios de laboratório, atividades com "vale nota"/"N1"/"N2"/"pontos"). false para enquetes, preferências, RSVPs, confirmações de presença, informações gerais.
- delivery_method (string): "google_forms" se há link forms.gle, "google_docs" se há link docs.google.com ou "enviar doc", "whatsapp" se "enviar no grupo"/"mandar no zap", "in_person" se "presencial"/"sala"/"imprimir"/"na aula", "unknown" se nenhum sinal claro.
- delivery_url (string|null): URL encontrada se google_forms ou google_docs.
- delivery_instructions (string|null): instrução de entrega se extraível.
Quando incerto sobre is_graded, prefira true. Responda APENAS com JSON.`;

function extractJson(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
  try { return JSON.parse(match ? match[1] : text); } catch { return null; }
}

export async function classifyAndDetect(activity: Activity, sourceMessages: Message[]): Promise<DetectionResult> {
  const msgContext = sourceMessages.map((m) => `[${m.group_label}] ${m.author}: ${m.body}`).join('\n');
  const userContent = `Atividade: ${JSON.stringify({ type: activity.type, title: activity.title, description: activity.description })}\n\nMensagens de origem:\n${msgContext}`;

  const { content } = await chat(SYSTEM_PROMPT, userContent, { temperature: 0.1 });
  const parsed = extractJson(content);

  if (!parsed) {
    return { is_graded: true, delivery_method: 'unknown', delivery_url: null, delivery_instructions: null };
  }

  return {
    is_graded: parsed.is_graded !== false,
    delivery_method: ['google_forms', 'google_docs', 'whatsapp', 'in_person', 'unknown'].includes(parsed.delivery_method)
      ? parsed.delivery_method : 'unknown',
    delivery_url: parsed.delivery_url || null,
    delivery_instructions: parsed.delivery_instructions || null,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/server/deliveryDetector.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/deliveryDetector.ts src/server/deliveryDetector.test.ts
git commit -m "feat: graded classifier + delivery method detector (LLM)"
```

---

## Task 4: Briefing Generator + `/api/briefing` Endpoint

**Files:**
- Create: `src/server/briefing.ts`
- Test: `src/server/briefing.test.ts`

**Interfaces:**
- Consumes: `chat()` from `./llm.js`; `fetchActivitiesForBriefing()`, `insertBriefing()` from `./db.js`
- Produces: `generateBriefing() → Promise<void>`

- [ ] **Step 1: Write failing test**

Create `src/server/briefing.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./llm.js', () => ({
  chat: vi.fn(),
}));
vi.mock('./db.js', () => ({
  fetchActivitiesForBriefing: vi.fn(() => [
    { id: 1, title: 'Prova ES', type: 'prova', due_date: '2026-07-10', delivery_stage: 'gathering', days_until_due: 1 },
  ]),
  insertBriefing: vi.fn(),
}));

import { chat } from './llm.js';
import { insertBriefing } from './db.js';
const mockChat = vi.mocked(chat);
const mockInsert = vi.mocked(insertBriefing);

describe('generateBriefing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls LLM and stores result in briefings table', async () => {
    mockChat.mockResolvedValueOnce({ content: 'Prova de ES amanhã.', promptTokens: 50, completionTokens: 10 });
    const { generateBriefing } = await import('./briefing.js');
    await generateBriefing();
    expect(mockInsert).toHaveBeenCalledWith('Prova de ES amanhã.', 1);
  });

  it('skips LLM call when no pending graded activities', async () => {
    vi.mocked(require('./db.js').fetchActivitiesForBriefing).mockReturnValueOnce([]);
    const { generateBriefing } = await import('./briefing.js');
    await generateBriefing();
    expect(mockChat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/server/briefing.test.ts
```

- [ ] **Step 3: Create `src/server/briefing.ts`**

```typescript
import { chat } from './llm.js';
import { fetchActivitiesForBriefing, insertBriefing } from './db.js';

const SYSTEM_PROMPT = `Você é um assistente de estudante universitário. Gere um parágrafo curto (2-3 frases) em português resumindo o estado atual das atividades pendentes: urgência, conflitos de prazo, atividades prontas para revisão. Seja direto e objetivo. Mencione nomes de matérias e prazos concretos quando disponíveis.`;

export async function generateBriefing(): Promise<void> {
  const activities = fetchActivitiesForBriefing();
  if (activities.length === 0) return;

  const summary = activities.map((a) =>
    `[${a.type}] "${a.title}" — prazo: ${a.due_date} (${a.days_until_due} dias) — etapa: ${a.delivery_stage}`
  ).join('\n');

  const { content } = await chat(SYSTEM_PROMPT, `Atividades pendentes:\n${summary}`, { temperature: 0.4 });
  if (content) {
    insertBriefing(content, activities.length);
    console.log('[Briefing] Generated briefing for', activities.length, 'activities');
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/server/briefing.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/briefing.ts src/server/briefing.test.ts
git commit -m "feat: briefing generator reads pending graded activities, writes to briefings table"
```

---

## Task 5: Context Monitor

**Files:**
- Create: `src/server/contextMonitor.ts`

**Interfaces:**
- Consumes: `chat()` from `./llm.js`; `fetchActivitiesForBriefing()`, `appendActivityContext()` from `./db.js`; `Message` from `./db.js`
- Produces: `scanNewMessages(messages: Message[]) → Promise<void>`

- [ ] **Step 1: Create `src/server/contextMonitor.ts`**

```typescript
import { chat } from './llm.js';
import { fetchActivitiesForBriefing, appendActivityContext } from './db.js';
import type { Message } from './db.js';

const SYSTEM_PROMPT = `Você analisa mensagens de WhatsApp para identificar quais são relevantes para atividades acadêmicas pendentes.
Para cada atividade abaixo, verifique se alguma das mensagens fornece informação nova: esclarecimento do professor, mudança de prazo, formato esperado, link de entrega, dúvidas respondidas, etc.
Retorne JSON: array de objetos {"activity_id": N, "message_id": N, "summary": "resumo do que é relevante"}.
Se nenhuma mensagem for relevante para uma atividade, não a inclua. Retorne [] se nada for relevante.`;

function extractJson(text: string): any[] {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
  try { return JSON.parse(match ? match[1] : text) || []; } catch { return []; }
}

export async function scanNewMessages(messages: Message[]): Promise<void> {
  const activities = fetchActivitiesForBriefing();
  if (activities.length === 0 || messages.length === 0) return;

  const actList = activities.map((a) => `ID ${a.id}: [${a.type}] "${a.title}" prazo ${a.due_date}`).join('\n');
  const msgList = messages
    .filter((m) => m.body && m.body.length > 5)
    .map((m) => `MSG_ID ${m.id}: [${m.group_label}] ${m.author}: ${(m.body || '').slice(0, 200)}`)
    .join('\n');

  if (!msgList) return;

  const { content } = await chat(
    SYSTEM_PROMPT,
    `Atividades pendentes:\n${actList}\n\nNovas mensagens:\n${msgList}`,
    { temperature: 0.2 }
  );

  const items = extractJson(content);
  for (const item of items) {
    const msg = messages.find((m) => m.id === item.message_id);
    if (!msg || !item.activity_id || !item.summary) continue;
    appendActivityContext(item.activity_id, {
      message_id: item.message_id,
      author: msg.author,
      body: msg.body || '',
      timestamp: msg.timestamp,
    });
  }

  if (items.length > 0) {
    console.log(`[ContextMonitor] Appended context to ${items.length} activity/message pairs`);
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/server/contextMonitor.ts
git commit -m "feat: context monitor scans new messages for pending activity mentions"
```

---

## Task 6: Submission Drafter

**Files:**
- Create: `src/server/drafter.ts`

**Interfaces:**
- Consumes: `chat()` from `./llm.js`; `fetchActivities()`, `updateActivityDelivery()` from `./db.js`
- Produces: `checkAndDraftSubmissions() → Promise<void>`; `regenerateDraft(activityId, guidance) → Promise<string>`

- [ ] **Step 1: Create `src/server/drafter.ts`**

```typescript
import { chat } from './llm.js';
import { fetchActivities, updateActivityDelivery } from './db.js';
import type { ActivityWithDelivery } from './db.js';

const DRAFT_SYSTEM = `Você prepara submissões acadêmicas. Com base na descrição da atividade, contexto coletado do WhatsApp e método de entrega, gere o conteúdo da submissão.
- google_forms: gere respostas para cada campo do formulário se identificável, ou um texto de resposta geral.
- google_docs: gere o conteúdo do documento completo.
- whatsapp: gere a mensagem curta a ser enviada no grupo correto.
- in_person: confirme que será entregue presencialmente.
Escreva em português. Seja preciso e objetivo. Responda APENAS com o conteúdo da submissão, sem explicações.`;

function daysUntilDate(dateStr: string): number {
  const now = new Date();
  const due = new Date(dateStr + 'T12:00:00');
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

export async function checkAndDraftSubmissions(): Promise<void> {
  const activities = fetchActivities('pendente') as ActivityWithDelivery[];
  const toProcess = activities.filter(
    (a) => a.is_graded === 1 && a.delivery_stage === 'gathering' && daysUntilDate(a.due_date) <= 3
  );

  for (const activity of toProcess) {
    const draft = await buildDraft(activity, '');
    if (draft) {
      updateActivityDelivery(activity.id!, { delivery_draft: draft, delivery_stage: 'pending_review' });
      console.log(`[Drafter] Draft created for activity ${activity.id} "${activity.title}"`);
    }
  }
}

export async function regenerateDraft(activityId: number, guidance: string): Promise<string> {
  const activities = fetchActivities() as ActivityWithDelivery[];
  const activity = activities.find((a) => a.id === activityId);
  if (!activity) throw new Error(`Activity ${activityId} not found`);
  const draft = await buildDraft(activity, guidance);
  if (draft) {
    updateActivityDelivery(activityId, { delivery_draft: draft, delivery_stage: 'pending_review' });
  }
  return draft;
}

async function buildDraft(activity: ActivityWithDelivery, guidance: string): Promise<string> {
  const ctx = activity.delivery_context ? JSON.parse(activity.delivery_context) : [];
  const ctxText = ctx.map((c: any) => `${c.author}: ${c.body}`).join('\n');

  const userContent = [
    `Atividade: [${activity.type}] "${activity.title}"`,
    `Descrição: ${activity.description || 'não especificada'}`,
    `Prazo: ${activity.due_date}`,
    `Método de entrega: ${activity.delivery_method || 'desconhecido'}`,
    activity.delivery_url ? `URL: ${activity.delivery_url}` : '',
    activity.delivery_instructions ? `Instruções: ${activity.delivery_instructions}` : '',
    ctxText ? `\nContexto adicional do WhatsApp:\n${ctxText}` : '',
    guidance ? `\nOrientação extra do aluno: ${guidance}` : '',
  ].filter(Boolean).join('\n');

  const { content } = await chat(DRAFT_SYSTEM, userContent, { temperature: 0.4 });
  return content;
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/server/drafter.ts
git commit -m "feat: T-3 day draft generator sets delivery_stage=pending_review"
```

---

## Task 7: Delivery Dispatcher + Bot Send Queue

**Files:**
- Create: `src/server/delivery.ts`
- Modify: `src/bot/index.ts`

**Interfaces:**
- Consumes: `updateActivityDelivery()`, `insertOutgoingMessage()` from `./db.js`; `ActivityWithDelivery` from `./db.js`
- Produces: `dispatchDelivery(activity) → Promise<void>`; `autoCompleteOverdue() → void`

- [ ] **Step 1: Create `src/server/delivery.ts`**

```typescript
import { updateActivityDelivery, insertOutgoingMessage, fetchActivities } from './db.js';
import type { ActivityWithDelivery } from './db.js';

export async function dispatchDelivery(activity: ActivityWithDelivery): Promise<void> {
  console.log(`[Delivery] Dispatching activity ${activity.id} "${activity.title}" via ${activity.delivery_method}`);
  updateActivityDelivery(activity.id!, { delivery_stage: 'delivering' });

  try {
    switch (activity.delivery_method) {
      case 'google_forms':
      case 'google_docs':
        await playwrightStub(activity);
        break;
      case 'whatsapp':
        await dispatchWhatsApp(activity);
        break;
      case 'in_person':
        console.log(`[Delivery] in_person: marking done (auto — physical delivery)`);
        updateActivityDelivery(activity.id!, { delivery_stage: 'done' });
        return;
      default:
        throw new Error(`Unknown delivery method: ${activity.delivery_method}`);
    }
    updateActivityDelivery(activity.id!, { delivery_stage: 'done' });
    console.log(`[Delivery] Done: activity ${activity.id}`);
  } catch (err: any) {
    console.error(`[Delivery] Failed for activity ${activity.id}:`, err.message);
    updateActivityDelivery(activity.id!, { delivery_stage: 'failed' });
  }
}

async function playwrightStub(activity: ActivityWithDelivery): Promise<void> {
  // Stub: log what would happen. Replace with real Playwright automation.
  console.log(`[Delivery:Playwright] STUB — would open ${activity.delivery_url}`);
  console.log(`[Delivery:Playwright] STUB — draft to submit:\n${activity.delivery_draft}`);
  // Real implementation: launch browser, navigate to URL, LLM reads form fields, fills and submits.
  // See spec section 2.7 for full requirements.
}

async function dispatchWhatsApp(activity: ActivityWithDelivery): Promise<void> {
  if (!activity.delivery_draft) throw new Error('No draft to send');
  const group = activity.delivery_instructions?.includes('profs') ? 'profs' : 'alunos';
  insertOutgoingMessage(group, activity.delivery_draft, activity.id ?? null);
  console.log(`[Delivery:WhatsApp] Queued message to ${group} group`);
}

export function autoCompleteOverdue(): void {
  const all = fetchActivities('pendente') as ActivityWithDelivery[];
  const today = new Date().toISOString().slice(0, 10);
  for (const a of all) {
    if (a.due_date >= today) continue;
    if (a.delivery_method === 'in_person' || a.delivery_stage === 'ignored') {
      updateActivityDelivery(a.id!, { delivery_stage: 'done' });
      console.log(`[AutoComplete] Marked overdue in_person activity ${a.id} as done`);
    } else if (!['done', 'failed', 'ignored'].includes(a.delivery_stage)) {
      console.warn(`[AutoComplete] Overdue activity ${a.id} "${a.title}" — stage: ${a.delivery_stage} — check pipeline`);
    }
  }
}
```

- [ ] **Step 2: Add outgoing-message polling to `src/bot/index.ts`**

After the `client.on('ready', ...)` block and before `client.initialize()`, add:

```typescript
function startOutgoingPoller(): void {
  const { fetchPendingOutgoing, markOutgoingSent } = require('../server/db.js');
  setInterval(async () => {
    try {
      const pending = fetchPendingOutgoing();
      for (const msg of pending) {
        const groupId = Object.entries(groupIdToLabel).find(([, label]) => label === msg.group_label)?.[0];
        if (!groupId) {
          console.warn(`[Bot] No group ID for label "${msg.group_label}"`);
          continue;
        }
        await client.sendMessage(groupId, msg.body);
        markOutgoingSent(msg.id);
        console.log(`[Bot] Sent outgoing message ${msg.id} to ${msg.group_label}`);
      }
    } catch (err: any) {
      console.error('[Bot] Outgoing poller error:', err.message);
    }
  }, 30000);
}
```

Call `startOutgoingPoller()` inside the `client.on('ready', ...)` handler after the "Listening for messages" log line.

Also add the ESM-compatible import at the top of `src/bot/index.ts`:

```typescript
import { fetchPendingOutgoing, markOutgoingSent } from '../server/db.js';
```

And replace the `require()` calls in `startOutgoingPoller` with the imported functions (since the file uses ESM):

```typescript
function startOutgoingPoller(): void {
  setInterval(async () => {
    try {
      const pending = fetchPendingOutgoing();
      for (const msg of pending) {
        const groupId = Object.entries(groupIdToLabel).find(([, label]) => label === msg.group_label)?.[0];
        if (!groupId) { console.warn(`[Bot] No group ID for label "${msg.group_label}"`); continue; }
        await client.sendMessage(groupId, msg.body);
        markOutgoingSent(msg.id);
        console.log(`[Bot] Sent outgoing message ${msg.id} to ${msg.group_label}`);
      }
    } catch (err: any) {
      console.error('[Bot] Outgoing poller error:', err.message);
    }
  }, 30000);
}
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/server/delivery.ts src/bot/index.ts
git commit -m "feat: delivery dispatcher (stubbed Playwright + WhatsApp queue); bot polls outgoing_messages"
```

---

## Task 8: Extraction Pipeline Wiring + Scheduler + All Server Endpoints

**Files:**
- Modify: `src/server/extraction.ts`
- Modify: `src/server/server.ts`

**Interfaces:**
- Consumes: all modules from Tasks 2–7
- Produces: updated `runExtraction()` returning `run_id`; scheduler in server; `/api/briefing`, `/api/extractions`, `/api/activities/:id/delivery` (PATCH), `/api/activities/:id/deliver` (POST), `POST /api/knowledge/generate`; updated `/api/stats` with density + minutes_ago

- [ ] **Step 1: Rewrite `src/server/extraction.ts` to use `llm.ts` and chain post-run tasks**

Replace the entire file:

```typescript
import { randomUUID } from 'crypto';
import {
  fetchUnprocessedMessages,
  fetchUnprocessedCount,
  markBatchProcessed,
  insertActivities,
  checkDuplicateActivity,
  insertLLMUsage,
  fetchMessages,
  Message,
  Activity,
} from './db.js';
import { getSystemPrompt, buildUserPrompt } from './prompts.js';
import { chat, getModel } from './llm.js';
import { classifyAndDetect } from './deliveryDetector.js';
import { updateActivityDelivery } from './db.js';
import { generateBriefing } from './briefing.js';
import { scanNewMessages } from './contextMonitor.js';
import { checkAndDraftSubmissions } from './drafter.js';

function normalizeTitle(title: string): string {
  return title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractJsonFromResponse(text: string): any {
  let match = text.match(/```(?:json)?\s*(.*?)\s*```/s);
  if (match) text = match[1].trim();
  try { return JSON.parse(text); } catch {
    match = text.match(/\{.*\}/s);
    if (match) try { return JSON.parse(match[0]); } catch { return null; }
  }
  return null;
}

export interface ExtractionResult {
  run_id: string;
  total_tokens_used: number;
  activities_extracted: number;
  messages_processed: number;
  messages_remaining: number;
  errors: string[];
}

export async function runExtraction(batchSize = 30, maxBatches = 10): Promise<ExtractionResult> {
  if (!process.env.OPENCODE_API_KEY) {
    return { run_id: '', total_tokens_used: 0, activities_extracted: 0, messages_processed: 0, messages_remaining: 0, errors: ['OPENCODE_API_KEY not set'] };
  }

  const runId = randomUUID();
  const model = getModel();
  let totalTokens = 0, totalActivities = 0, totalProcessed = 0;
  const errors: string[] = [];
  const allNewActivityIds: number[] = [];
  const allProcessedMessages: Message[] = [];

  for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
    const messages = fetchUnprocessedMessages(batchSize);
    if (messages.length === 0) break;
    const messageIds = messages.map((m) => m.id!);

    try {
      const { content, promptTokens, completionTokens } = await chat(
        getSystemPrompt(),
        buildUserPrompt(messages),
        { temperature: 0.3 }
      );

      totalTokens += promptTokens + completionTokens;
      insertLLMUsage(model, promptTokens, completionTokens, messageIds.length, runId);

      const data = extractJsonFromResponse(content);
      if (!data || !Array.isArray(data.items)) {
        console.warn(`[Extraction] Batch ${batchNum + 1}: invalid JSON, marking processed`);
        markBatchProcessed(messageIds);
        totalProcessed += messageIds.length;
        allProcessedMessages.push(...messages);
        continue;
      }

      const validItems: Activity[] = [];
      for (const item of data.items) {
        if (!item.type || !item.title || !item.due_date || item.source_message_id === undefined) continue;
        if (!messageIds.includes(item.source_message_id)) continue;
        if (!['prova', 'trabalho', 'evento', 'atividade'].includes(item.type)) continue;
        if (!['alta', 'media', 'baixa'].includes(item.confidence)) item.confidence = 'media';
        if (!item.due_date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
        validItems.push(item);
      }

      const dedupedItems: Activity[] = [];
      for (const item of validItems) {
        if (!checkDuplicateActivity(item.type, normalizeTitle(item.title), item.due_date)) {
          dedupedItems.push(item);
        }
      }

      if (dedupedItems.length > 0) {
        const newIds = insertActivities(dedupedItems);
        totalActivities += dedupedItems.length;
        allNewActivityIds.push(...newIds);
      }

      markBatchProcessed(messageIds);
      totalProcessed += messageIds.length;
      allProcessedMessages.push(...messages);
    } catch (err: any) {
      errors.push(`Batch ${batchNum + 1}: ${err.message}`);
    }
  }

  // Post-run pipeline
  if (allNewActivityIds.length > 0) {
    for (const activityId of allNewActivityIds) {
      try {
        const { fetchActivities } = await import('./db.js');
        const activities = fetchActivities() as any[];
        const activity = activities.find((a) => a.id === activityId);
        if (!activity) continue;
        const sourceMsg = allProcessedMessages.find((m) => m.id === activity.source_message_id);
        const result = await classifyAndDetect(activity, sourceMsg ? [sourceMsg] : []);
        const nextStage = !result.is_graded ? 'ignored' : result.delivery_method === 'unknown' ? 'needs_method' : 'gathering';
        updateActivityDelivery(activityId, {
          is_graded: result.is_graded ? 1 : 0,
          delivery_method: result.delivery_method,
          delivery_url: result.delivery_url ?? undefined,
          delivery_instructions: result.delivery_instructions ?? undefined,
          delivery_stage: nextStage,
        } as any);
      } catch (err: any) {
        console.error(`[Extraction] Detector failed for activity ${activityId}:`, err.message);
      }
    }
  }

  if (allProcessedMessages.length > 0) {
    try { await scanNewMessages(allProcessedMessages); } catch (err: any) { console.error('[Extraction] ContextMonitor error:', err.message); }
  }

  try { await generateBriefing(); } catch (err: any) { console.error('[Extraction] Briefing error:', err.message); }
  try { await checkAndDraftSubmissions(); } catch (err: any) { console.error('[Extraction] Drafter error:', err.message); }

  return {
    run_id: runId,
    total_tokens_used: totalTokens,
    activities_extracted: totalActivities,
    messages_processed: totalProcessed,
    messages_remaining: fetchUnprocessedCount(),
    errors,
  };
}
```

- [ ] **Step 2: Rewrite `src/server/server.ts`**

Replace the entire file:

```typescript
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import {
  fetchActivities,
  fetchMessages,
  fetchActivityStatusCounts,
  fetchActivityTypeCounts,
  fetchMessageStats,
  fetchUsageSummary,
  fetchUnprocessedCount,
  updateActivityStatus,
  fetchLatestBriefing,
  fetchLatestKnowledgeBase,
  fetchWeekDensity,
  fetchExtractionRuns,
  updateActivityDelivery,
  openDb,
} from './db.js';
import { runExtraction } from './extraction.js';
import { generateKnowledgeBase, seedKnowledgeBaseIfEmpty } from './knowledge.js';
import { regenerateDraft } from './drafter.js';
import { dispatchDelivery, autoCompleteOverdue } from './delivery.js';

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

openDb();
seedKnowledgeBaseIfEmpty();

// Extraction scheduler
const intervalMin = parseInt(process.env.EXTRACTION_INTERVAL_MINUTES || '15');
setInterval(async () => {
  try {
    console.log('[Scheduler] Auto-extraction started');
    await runExtraction();
  } catch (err: any) {
    console.error('[Scheduler] Error:', err.message);
  }
}, intervalMin * 60 * 1000);

// Daily overdue auto-complete
setInterval(() => {
  try { autoCompleteOverdue(); } catch (err: any) { console.error('[Scheduler] AutoComplete error:', err.message); }
}, 24 * 60 * 60 * 1000);

// --- Activities ---
app.get('/api/activities', (req: Request, res: Response): void => {
  try {
    const { status, urgency, limit = 500 } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit)) || 500, 5000);
    const acts = fetchActivities(
      status ? String(status) : undefined,
      urgency ? String(urgency) : undefined,
      parsedLimit
    );
    res.json({ data: acts, pagination: { total: acts.length, limit: parsedLimit } });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

app.patch('/api/activities/:id', (req: Request, res: Response): void => {
  try {
    const { status } = req.body;
    if (!['pendente', 'concluido', 'descartado'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' }); return;
    }
    updateActivityStatus(parseInt(req.params.id), status);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.patch('/api/activities/:id/delivery', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { delivery_method, delivery_instructions, delivery_draft, action } = req.body;

    if (delivery_method || delivery_instructions || delivery_draft) {
      updateActivityDelivery(id, { delivery_method, delivery_instructions, delivery_draft });
    }

    if (action === 'ignore') {
      updateActivityDelivery(id, { delivery_stage: 'ignored' });
      res.json({ success: true }); return;
    }

    if (action === 'regenerate') {
      const draft = await regenerateDraft(id, delivery_instructions || '');
      res.json({ success: true, draft }); return;
    }

    if (action === 'approve') {
      updateActivityDelivery(id, { delivery_stage: 'delivering' });
      const acts = fetchActivities() as any[];
      const activity = acts.find((a) => a.id === id);
      if (activity) dispatchDelivery(activity).catch(console.error);
      res.json({ success: true }); return;
    }

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activities/:id/deliver', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const acts = fetchActivities() as any[];
    const activity = acts.find((a) => a.id === id);
    if (!activity) { res.status(404).json({ error: 'Not found' }); return; }
    dispatchDelivery(activity).catch(console.error);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Messages ---
app.get('/api/messages', (req: Request, res: Response): void => {
  try {
    const { limit = 200, offset = 0, search } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit)) || 200, 1000);
    const parsedOffset = parseInt(String(offset)) || 0;
    const messages = fetchMessages(parsedLimit + parsedOffset, 0, search ? String(search) : undefined);
    res.json({ data: messages.slice(parsedOffset, parsedOffset + parsedLimit), pagination: { total: messages.length, limit: parsedLimit, offset: parsedOffset } });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Briefing ---
app.get('/api/briefing', (req: Request, res: Response): void => {
  try {
    const b = fetchLatestBriefing();
    if (!b) { res.json({ content: 'Nenhum resumo disponível ainda.', minutes_ago: null }); return; }
    const minutesAgo = Math.round((Date.now() - new Date(b.created_at).getTime()) / 60000);
    res.json({ content: b.content, activities_count: b.activities_count, minutes_ago: minutesAgo });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Extractions log ---
app.get('/api/extractions', (req: Request, res: Response): void => {
  try { res.json({ data: fetchExtractionRuns(20) }); }
  catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Stats ---
app.get('/api/stats', (req: Request, res: Response): void => {
  try {
    const messageStats = fetchMessageStats();
    const statusCounts = fetchActivityStatusCounts();
    const typeCounts = fetchActivityTypeCounts();
    const usageSummary = fetchUsageSummary();
    const remaining = fetchUnprocessedCount();
    const lastRunAt = usageSummary.last_run_at;
    const lastExtractionMinutesAgo = lastRunAt
      ? Math.round((Date.now() - new Date(lastRunAt).getTime()) / 60000)
      : null;

    res.json({
      total_messages: messageStats.total,
      total_activities: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      messages_processed: messageStats.total - remaining,
      messages_remaining: remaining,
      activities_by_status: { pendente: statusCounts.pendente || 0, concluido: statusCounts.concluido || 0, descartado: statusCounts.descartado || 0 },
      activities_by_type: { prova: typeCounts.prova || 0, trabalho: typeCounts.trabalho || 0, evento: typeCounts.evento || 0, atividade: typeCounts.atividade || 0 },
      token_usage: {
        prompt_tokens: usageSummary.prompt_tokens,
        completion_tokens: usageSummary.completion_tokens,
        total_tokens: usageSummary.prompt_tokens + usageSummary.completion_tokens,
        run_count: usageSummary.run_count,
        last_run_at: lastRunAt,
      },
      last_extraction_minutes_ago: lastExtractionMinutesAgo,
      first_message_timestamp: messageStats.first_timestamp,
      deadline_density: fetchWeekDensity(),
    });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// --- Extract (manual) ---
app.post('/api/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchSize = 30, maxBatches = 10 } = req.body;
    res.json(await runExtraction(batchSize, maxBatches));
  } catch { res.status(500).json({ error: 'Extraction failed' }); }
});

// --- Knowledge base ---
app.post('/api/knowledge/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    await generateKnowledgeBase();
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (_req: Request, res: Response): void => { res.json({ status: 'ok' }); });

app.listen(port, () => {
  console.log(`[Server] Listening on http://localhost:${port}`);
});
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Fix any type errors before proceeding.

- [ ] **Step 4: Start server and verify endpoints respond**

```bash
npm run dev:server &
sleep 3
curl -s http://localhost:3000/health
curl -s http://localhost:3000/api/briefing
curl -s http://localhost:3000/api/stats | grep -o '"deadline_density":{[^}]*}'
kill %1
```

Expected: `{"status":"ok"}`, briefing JSON, density object present.

- [ ] **Step 5: Commit**

```bash
git add src/server/extraction.ts src/server/server.ts
git commit -m "feat: extraction pipeline chains detector+monitor+briefing+drafter; scheduler; all new API endpoints"
```

---

## Task 9: Tool Provider Updates

**Files:**
- Modify: `src/frontend/toolProvider.ts`

**Interfaces:**
- Produces: `get_briefing`, `get_extractions`, updated `get_activities` (urgency param), `update_activity_delivery`, `deliver_activity` tools

- [ ] **Step 1: Replace `src/frontend/toolProvider.ts`**

```typescript
async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

export const toolProvider: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_activities: async (args) => {
    const url = new URL('/api/activities', window.location.origin);
    if (args.status && args.status !== 'all') url.searchParams.set('status', String(args.status));
    if (args.urgency) url.searchParams.set('urgency', String(args.urgency));
    url.searchParams.set('limit', '1000');
    return getJson(url.toString());
  },

  get_messages: async (args) => {
    const url = new URL('/api/messages', window.location.origin);
    if (args.search) url.searchParams.set('search', String(args.search));
    url.searchParams.set('limit', '1000');
    return getJson(url.toString());
  },

  get_stats: async () => getJson('/api/stats'),
  get_briefing: async () => getJson('/api/briefing'),
  get_extractions: async () => getJson('/api/extractions'),

  update_activity_status: async (args) => {
    const response = await fetch(`/api/activities/${args.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: args.status }),
    });
    if (!response.ok) throw new Error(`Update failed: ${response.status}`);
    return response.json();
  },

  update_activity_delivery: async (args) => {
    const response = await fetch(`/api/activities/${args.id}/delivery`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_method: args.delivery_method,
        delivery_instructions: args.delivery_instructions,
        delivery_draft: args.delivery_draft,
        action: args.action,
      }),
    });
    if (!response.ok) throw new Error(`Delivery update failed: ${response.status}`);
    return response.json();
  },

  deliver_activity: async (args) => {
    const response = await fetch(`/api/activities/${args.id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Deliver failed: ${response.status}`);
    return response.json();
  },

  run_extraction: async () => {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: 30, maxBatches: 10 }),
    });
    if (!response.ok) throw new Error(`Extraction failed: ${response.status}`);
    return response.json();
  },
};
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/toolProvider.ts
git commit -m "feat: tool provider adds get_briefing, get_extractions, update_activity_delivery, deliver_activity"
```

---

## Task 10: Dashboard Redesign

**Files:**
- Rewrite: `src/frontend/pages/Dashboard.tsx`

- [ ] **Step 1: Rewrite `src/frontend/pages/Dashboard.tsx`**

```typescript
import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

const dashboardProgram = `
$showReview = false
$reviewId = ""
$reviewDraft = ""
$reviewMethod = ""
$reviewCtx = ""
$guidanceText = ""
$showGuidance = false

briefingQ = Query("get_briefing", {}, {content: "Carregando...", minutes_ago: null})
stats = Query("get_stats", {}, {last_extraction_minutes_ago: null, deadline_density: {seg:0,ter:0,qua:0,qui:0,sex:0,sab:0,dom:0}}, 60)
weekQ = Query("get_activities", {urgency: "urgent", status: "pendente"}, {data: []})
futureQ = Query("get_activities", {urgency: "future", status: "pendente"}, {data: []})
reviewQ = Query("get_activities", {status: "pendente"}, {data: []})

weekSorted = @Sort(weekQ.data, "due_date", "asc")
futureSorted = @Sort(futureQ.data, "due_date", "asc")
pendingReview = @Filter(reviewQ.data, "delivery_stage", "==", "pending_review")
needsMethod = @Filter(reviewQ.data, "delivery_stage", "==", "needs_method")

updateDelivery = Mutation("update_activity_delivery", {id: $reviewId, delivery_draft: $reviewDraft, action: "approve"})
regenDelivery = Mutation("update_activity_delivery", {id: $reviewId, delivery_instructions: $guidanceText, action: "regenerate"})
markDone = Mutation("update_activity_status", {id: $reviewId, status: "concluido"})
markIgnored = Mutation("update_activity_delivery", {id: $reviewId, action: "ignore"})

lastRunLabel = stats.last_extraction_minutes_ago == null ? "nunca" : "" + stats.last_extraction_minutes_ago + "min atras"
header = Stack([TextContent("ADS Panel", "large-heavy"), TextContent("auto - ultima: " + lastRunLabel, "small")], "row", "none", "center", "between")

briefingCard = Callout("info", "Resumo do dia", briefingQ.content)

densityRow = Stack([
  Stack([TextContent("Seg", "small"), Tag("" + stats.deadline_density.seg, null, "sm", stats.deadline_density.seg > 2 ? "danger" : stats.deadline_density.seg > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Ter", "small"), Tag("" + stats.deadline_density.ter, null, "sm", stats.deadline_density.ter > 2 ? "danger" : stats.deadline_density.ter > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Qua", "small"), Tag("" + stats.deadline_density.qua, null, "sm", stats.deadline_density.qua > 2 ? "danger" : stats.deadline_density.qua > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Qui", "small"), Tag("" + stats.deadline_density.qui, null, "sm", stats.deadline_density.qui > 2 ? "danger" : stats.deadline_density.qui > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Sex", "small"), Tag("" + stats.deadline_density.sex, null, "sm", stats.deadline_density.sex > 2 ? "danger" : stats.deadline_density.sex > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Sab", "small"), Tag("" + stats.deadline_density.sab, null, "sm", stats.deadline_density.sab > 2 ? "danger" : stats.deadline_density.sab > 0 ? "warning" : "neutral")], "column", "s", "center"),
  Stack([TextContent("Dom", "small"), Tag("" + stats.deadline_density.dom, null, "sm", stats.deadline_density.dom > 2 ? "danger" : stats.deadline_density.dom > 0 ? "warning" : "neutral")], "column", "s", "center")
], "row", "m", "end", "between")
densityCard = Card([CardHeader("Prazo esta semana"), densityRow], "card", "column", "m")

reviewCallout = @Count(pendingReview) > 0 ? Callout("warning", "Revisao pendente", "" + @Count(pendingReview) + " atividade(s) prontas para entrega — abra a atividade para revisar") : null
needsMethodCallout = @Count(needsMethod) > 0 ? Callout("warning", "Como entregar?", "" + @Count(needsMethod) + " atividade(s) precisam de instrucoes de entrega") : null

stageColor = "a.delivery_stage == 'pending_review' ? 'danger' : a.delivery_stage == 'needs_method' ? 'warning' : a.delivery_stage == 'gathering' ? 'info' : a.delivery_stage == 'done' ? 'success' : a.delivery_stage == 'delivering' ? 'info' : a.delivery_stage == 'failed' ? 'danger' : 'neutral'"

colPrazo = Col("Prazo", @Each(weekSorted, "a", Tag(a.urgency_label, null, "sm", a.urgency_color)))
colAtiv = Col("Atividade", weekSorted.title)
colEntrega = Col("Entrega", @Each(weekSorted, "a", Tag(a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "needs_method" ? "warning" : a.delivery_stage == "gathering" ? "info" : a.delivery_stage == "done" ? "success" : a.delivery_stage == "delivering" ? "info" : a.delivery_stage == "failed" ? "danger" : "neutral")))
colAcoes = Col("Acoes", @Each(weekSorted, "a", Stack([Button("Feito", Action([@Set($reviewId, a.id), @Run(markDone), @Run(weekQ)]), "secondary", "normal", "extra-small"), Button("Revisar", Action([@Set($reviewId, a.id), @Set($reviewDraft, a.delivery_draft), @Set($reviewMethod, a.delivery_method), @Set($reviewCtx, a.delivery_context), @Set($showReview, true)]), "primary", "normal", "extra-small")], "row", "s")))
weekTable = Table([colPrazo, colAtiv, colEntrega, colAcoes])
weekEmpty = TextContent("Nenhuma atividade urgente esta semana.")
weekSection = Card([CardHeader("Esta Semana"), @Count(weekSorted) > 0 ? weekTable : weekEmpty], "card", "column", "m")

futureItems = @Each(futureSorted, "a", Card([Stack([TextContent(a.urgency_label + " — " + a.title, "small-heavy"), Tag(a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "needs_method" ? "warning" : "neutral")], "row", "s", "center", "between"), TextContent(a.description == null ? "" : a.description, "small")], "clear", "column", "s"))
futureSection = @Count(futureSorted) > 0 ? Card([CardHeader("Mais Adiante"), Stack(futureItems, "column", "s")], "sunk", "column", "m") : null

draftArea = FormControl("Rascunho", Input("reviewDraft", "Conteudo da submissao...", "text", null, $reviewDraft))
methodInfo = TextContent("Metodo: " + $reviewMethod, "small")
guidanceArea = $showGuidance ? FormControl("Orientacao", Input("guidanceText", "Explique como entregar...", "text", null, $guidanceText)) : null
approveBtn = Button("Aprovar e Entregar", Action([@Run(updateDelivery), @Set($showReview, false), @Run(weekQ), @Run(reviewQ)]), "primary")
regenBtn = Button("Regenerar", Action([@Run(regenDelivery), @Run(weekQ)]), "secondary")
guidanceBtn = Button("Dar contexto", Action([@Set($showGuidance, true)]), "secondary")
cancelBtn = Button("Cancelar", Action([@Set($showReview, false)]), "secondary")
reviewForm = Form("reviewForm", Buttons([approveBtn, regenBtn, guidanceBtn, cancelBtn]), [draftArea, $showGuidance ? guidanceArea : null])
reviewModal = Modal("Revisar entrega", $showReview, [methodInfo, reviewForm])

root = Stack([header, briefingCard, densityCard, reviewCallout, needsMethodCallout, weekSection, futureSection, reviewModal])
`;

export function Dashboard() {
  return <Renderer library={openuiLibrary} response={dashboardProgram} toolProvider={toolProvider} />;
}
```

- [ ] **Step 2: Start dev server and visually verify dashboard**

```bash
npm run dev
```

Open `http://localhost:5173`. Check:
- Header shows "ADS Panel" + auto text
- Briefing callout renders (may say "Nenhum resumo...")
- Density row shows 7 day columns
- Esta Semana table present (or empty state)
- No extraction button anywhere

- [ ] **Step 3: Commit**

```bash
git add src/frontend/pages/Dashboard.tsx
git commit -m "feat: Dashboard redesign — briefing, density, review queue, Esta Semana, Mais Adiante"
```

---

## Task 11: Status Page — Tab Navigation

**Files:**
- Modify: `src/frontend/pages/Status.tsx`

- [ ] **Step 1: Replace `src/frontend/pages/Status.tsx`**

```typescript
import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

const statusProgram = `
$tab = "visao_geral"

stats = Query("get_stats", {}, {total_messages: 0, total_activities: 0, messages_processed: 0, messages_remaining: 0, activities_by_status: {pendente: 0, concluido: 0, descartado: 0}, activities_by_type: {prova: 0, trabalho: 0, evento: 0, atividade: 0}, token_usage: {prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, run_count: 0, last_run_at: null}, first_message_timestamp: null}, 30)
extractionsQ = Query("get_extractions", {}, {data: []})
allActivitiesQ = Query("get_activities", {}, {data: []})

tabSelect = FormControl("", Select("tab", [SelectItem("visao_geral", "Visao Geral"), SelectItem("extracoes", "Extracoes"), SelectItem("atividades", "Atividades (Debug)")], null, null, $tab))
header = Card([CardHeader("Status do Sistema", "Monitoramento"), tabSelect], "clear", "row", "m", "center", "between")

row1 = Stack([TextContent("Total de Mensagens"), TextContent("" + stats.total_messages)], "row", "none", "center", "between")
row2 = Stack([TextContent("Processadas"), TextContent("" + stats.messages_processed)], "row", "none", "center", "between")
row3 = Stack([TextContent("Nao Processadas (fila)"), TextContent("" + stats.messages_remaining)], "row", "none", "center", "between")
row4 = Stack([TextContent("Primeira Mensagem"), TextContent(stats.first_message_timestamp == null ? "Sem mensagens" : stats.first_message_timestamp)], "row", "none", "center", "between")
mensagensSection = Card([CardHeader("Mensagens"), row1, row2, row3, row4], "sunk", "column", "s")

aRow1 = Stack([TextContent("Total"), TextContent("" + stats.total_activities)], "row", "none", "center", "between")
aRow2 = Stack([TextContent("Pendentes"), TextContent("" + stats.activities_by_status.pendente)], "row", "none", "center", "between")
aRow3 = Stack([TextContent("Concluidas"), TextContent("" + stats.activities_by_status.concluido)], "row", "none", "center", "between")
aRow4 = Stack([TextContent("Descartadas"), TextContent("" + stats.activities_by_status.descartado)], "row", "none", "center", "between")
atividadesSection = Card([CardHeader("Atividades"), aRow1, aRow2, aRow3, aRow4], "sunk", "column", "s")

apiRow1 = Stack([TextContent("Total Tokens"), TextContent("" + stats.token_usage.total_tokens)], "row", "none", "center", "between")
apiRow2 = Stack([TextContent("Execucoes"), TextContent("" + stats.token_usage.run_count)], "row", "none", "center", "between")
apiRow3 = Stack([TextContent("Ultima Extracao"), TextContent(stats.token_usage.last_run_at == null ? "Nunca" : stats.token_usage.last_run_at)], "row", "none", "center", "between")
apiRow4 = Stack([TextContent("Custo Est."), TextContent("USD $" + @Round(stats.token_usage.prompt_tokens / 1000000 * 0.14 + stats.token_usage.completion_tokens / 1000000 * 0.28, 4))], "row", "none", "center", "between")
apiSection = Card([CardHeader("API (OpenCode)"), apiRow1, apiRow2, apiRow3, apiRow4], "sunk", "column", "s")
footer = Stack([TextContent("Atualiza a cada 30s", "small"), Tag("live", null, "sm", "info")], "row", "s", "center", "between")
visaoGeralTab = Stack([mensagensSection, atividadesSection, apiSection, footer], "column", "m")

extrSorted = @Sort(extractionsQ.data, "started_at", "desc")
extrItems = @Each(extrSorted, "e", Card([Stack([TextContent(e.started_at, "small-heavy"), TextContent("" + e.messages_in_batch + " msgs / " + (e.prompt_tokens + e.completion_tokens) + " tokens", "small")], "row", "s", "center", "between")], "sunk", "column", "s"))
extractoesTab = Stack([CardHeader("Historico de Extracoes"), @Count(extrSorted) > 0 ? Stack(extrItems, "column", "s") : TextContent("Nenhuma extracao registrada.")], "column", "m")

allSorted = @Sort(allActivitiesQ.data, "due_date", "asc")
dbgColTitle = Col("Titulo", allSorted.title)
dbgColType = Col("Tipo", @Each(allSorted, "a", Tag(a.type, null, "sm", a.type == "prova" ? "danger" : a.type == "trabalho" ? "warning" : "neutral")))
dbgColStatus = Col("Status", @Each(allSorted, "a", Tag(a.status, null, "sm", a.status == "pendente" ? "warning" : a.status == "concluido" ? "success" : "neutral")))
dbgColGraded = Col("Nota?", @Each(allSorted, "a", Tag(a.is_graded == 1 ? "sim" : "nao", null, "sm", a.is_graded == 1 ? "info" : "neutral")))
dbgColStage = Col("Etapa", @Each(allSorted, "a", Tag(a.delivery_stage == null ? "—" : a.delivery_stage, null, "sm", a.delivery_stage == "pending_review" ? "danger" : a.delivery_stage == "failed" ? "danger" : a.delivery_stage == "done" ? "success" : "neutral")))
dbgColDate = Col("Prazo", allSorted.due_date)
dbgTable = Table([dbgColTitle, dbgColType, dbgColStatus, dbgColGraded, dbgColStage, dbgColDate])
atividadesTab = Stack([CardHeader("Todas as Atividades (Debug)"), @Count(allSorted) > 0 ? dbgTable : TextContent("Nenhuma atividade.")], "column", "m")

currentTab = $tab == "extracoes" ? extractoesTab : $tab == "atividades" ? atividadesTab : visaoGeralTab

root = Stack([header, currentTab])
`;

export function Status() {
  return <Renderer library={openuiLibrary} response={statusProgram} toolProvider={toolProvider} />;
}
```

- [ ] **Step 2: Visually verify in browser**

Open `http://localhost:5173/status` (or navigate via nav). Check:
- Tab selector switches between Visao Geral / Extracoes / Atividades
- Visao Geral shows stats cards
- Extracoes shows extraction history (may be empty)
- Atividades shows debug table with delivery columns

- [ ] **Step 3: Commit**

```bash
git add src/frontend/pages/Status.tsx
git commit -m "feat: Status page gains tab nav — Visao Geral / Extracoes / Atividades debug"
```

---

## Task 12: Messages Page Polish

**Files:**
- Modify: `src/frontend/pages/Messages.tsx`

- [ ] **Step 1: Replace the program string in `src/frontend/pages/Messages.tsx`**

```typescript
import { Renderer } from '@openuidev/react-lang';
import { openuiLibrary } from '../library';
import { toolProvider } from '../toolProvider';

const messagesProgram = `
$search = ""

messagesQ = Query("get_messages", {search: $search}, {data: []})
sorted = @Sort(messagesQ.data, "timestamp", "desc")

searchBox = FormControl("Buscar", Input("search", "Buscar mensagens por autor ou conteudo...", "text", null, $search))
countLabel = TextContent("" + @Count(sorted) + " mensagem(ns)", "small")

feedList = Stack(@Each(sorted, "m", Card([Stack([TextContent(m.author, "small-heavy"), TextContent(m.timestamp, "small"), Tag(m.group_label, null, "sm", m.group_label == "profs" ? "warning" : "info"), m.activity_count > 0 ? Tag("" + m.activity_count + " atividade(s)", null, "sm", "info") : null], "row", "s", "center"), TextContent(m.body == null ? "[Mensagem vazia]" : m.body), Tag(m.processed == 1 ? "Processada" : "Nao processada", null, "sm", m.processed == 1 ? "success" : "warning")], "clear", "column", "s")), "column", "m")

emptyState = @Count(sorted) > 0 ? feedList : TextContent("Nenhuma mensagem encontrada.")

root = Card([CardHeader("Mensagens", "Feed dos grupos do WhatsApp"), searchBox, countLabel, emptyState], "card", "column", "m")
`;

export function Messages() {
  return <Renderer library={openuiLibrary} response={messagesProgram} toolProvider={toolProvider} />;
}
```

Changes vs. old version:
1. Root wrapped in `Card("card")` (was bare `Stack`)
2. Activity count tag appears when `m.activity_count > 0`
3. Removed `ID: N (WA: ...)` noise from message footer

- [ ] **Step 2: Visually verify**

Open Messages page. Confirm: Card wrapper visible, messages with extracted activities show the count tag, no ID noise in footer.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/pages/Messages.tsx
git commit -m "feat: Messages page polish — Card wrapper, activity count tag, remove ID noise"
```

---

## Self-Review

### Spec coverage check

| Spec section | Covered in |
|---|---|
| 2.1 Auto-extraction scheduler (15 min) | Task 8 `server.ts` setInterval |
| 2.2 Graded classifier | Task 3 `deliveryDetector.ts` |
| 2.3 Delivery method detector | Task 3 `deliveryDetector.ts` |
| 2.4 Context monitor | Task 5 `contextMonitor.ts` |
| 2.5 Briefing generator | Task 4 `briefing.ts` + `/api/briefing` |
| 2.6 Submission drafter (T-3) | Task 6 `drafter.ts` |
| 2.7 Delivery dispatcher | Task 7 `delivery.ts` (Playwright stubbed) |
| 2.8 Time-based auto-complete | Task 7 `autoCompleteOverdue()` in Task 8 daily interval |
| 3.1 New activity columns | Task 1 `runMigrations()` |
| 3.2 briefings table | Task 1 `schema.sql` |
| 3.3 Urgency fields | Task 1 `fetchActivities()` + `computeUrgency()` |
| 3.4 deadline_density | Task 1 `fetchWeekDensity()` + Task 8 `/api/stats` |
| 4. API changes | Task 8 `server.ts` |
| 5. Dashboard redesign | Task 10 |
| 5.4 Draft review modal | Task 10 (Mutation-based, no Modal refresh on regen — Hugo must close+reopen) |
| 6. Status tabs | Task 11 |
| 7. Messages polish | Task 12 |
| 8. Knowledge base DB + endpoint | Task 2 + Task 8 |

### Known gaps / limitations

- **Draft review modal** does not auto-refresh draft after "Regenerar" in the current OpenUI Lang design. Hugo must close and reopen the modal. This is acceptable for an MVP.
- **Playwright delivery** is fully stubbed. Full form automation requires implementing `playwrightStub()` in `delivery.ts` — see spec section 2.7.
- **`needs_method` flow** (Hugo types delivery instructions) requires the Dashboard review modal to present a delivery-method input field for activities in `needs_method` stage. The current modal only shows for `pending_review`. Add a separate modal or expand the logic when implementing follow-up.
- **Mais Adiante accordion**: implemented as flat Card list (not Accordion component) — works with known components. If `Accordion` / `AccordionItem` are available in `@openuidev/react-ui`, upgrade to accordion for collapsible behavior.
