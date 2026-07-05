import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

async function freshDb() {
  const mod = await import('./db.js');
  mod.closeDb();
  return mod;
}

beforeEach(() => {
  process.env.DB_PATH = `./__testdata__/${Date.now()}-${Math.random().toString(36).slice(2)}/test.db`;
});

afterEach(async () => {
  const mod = await import('./db.js');
  mod.closeDb();
  rmSync(resolve(process.cwd(), '__testdata__'), { recursive: true, force: true });
  delete process.env.DB_PATH;
});

describe('getDbPath / openDb path resolution', () => {
  it('resolves a relative DB_PATH against the repo root, not one level above it', async () => {
    const mod = await import('./db.js');
    mod.openDb();
    const expectedPath = resolve(process.cwd(), process.env.DB_PATH!.replace(/^\.\//, ''));
    expect(existsSync(expectedPath)).toBe(true);
  });
});

describe('insertMessage / messageExists', () => {
  it('inserts a new message and makes it retrievable by wa_message_id', async () => {
    const { insertMessage, messageExists } = await freshDb();
    insertMessage('wa1', 'alunos', 'Alice', 'hello', '2026-01-01T10:00:00.000Z');
    expect(messageExists('wa1')).toBe(true);
    expect(messageExists('does-not-exist')).toBe(false);
  });

  it('silently ignores duplicate wa_message_id inserts instead of throwing', async () => {
    const { insertMessage } = await freshDb();
    insertMessage('dup', 'alunos', 'Alice', 'first', '2026-01-01T10:00:00.000Z');
    expect(() => insertMessage('dup', 'alunos', 'Alice', 'second', '2026-01-01T10:00:00.000Z')).not.toThrow();
  });

  it('rethrows non-constraint errors instead of swallowing them', async () => {
    const { insertMessage, closeDb } = await freshDb();
    closeDb();
    // group_label is NOT NULL in the schema; passing null triggers a
    // non-UNIQUE constraint error that insertMessage must not swallow.
    expect(() => insertMessage('m1', null as any, 'Alice', 'body', '2026-01-01T10:00:00.000Z')).toThrow(
      /NOT NULL constraint failed/
    );
  });
});

describe('getDbPath absolute path handling', () => {
  it('uses an absolute DB_PATH as-is instead of resolving it against the repo root', async () => {
    const { existsSync: exists } = await import('fs');
    const tmpAbsolute = resolve('/tmp', `ads-painel-abs-test-${Date.now()}.db`);
    process.env.DB_PATH = tmpAbsolute;
    const { openDb, closeDb } = await freshDb();
    openDb();
    expect(exists(tmpAbsolute)).toBe(true);
    closeDb();
    rmSync(tmpAbsolute, { force: true });
    rmSync(`${tmpAbsolute}-shm`, { force: true });
    rmSync(`${tmpAbsolute}-wal`, { force: true });
  });
});

describe('fetchUnprocessedMessages / fetchUnprocessedCount / markBatchProcessed', () => {
  it('only returns unprocessed messages, ordered by timestamp ascending', async () => {
    const { insertMessage, fetchUnprocessedMessages } = await freshDb();
    insertMessage('m2', 'alunos', 'A', 'second', '2026-01-02T10:00:00.000Z');
    insertMessage('m1', 'alunos', 'A', 'first', '2026-01-01T10:00:00.000Z');
    const rows = fetchUnprocessedMessages(10);
    expect(rows.map((r) => r.wa_message_id)).toEqual(['m1', 'm2']);
  });

  it('respects the batchSize limit', async () => {
    const { insertMessage, fetchUnprocessedMessages } = await freshDb();
    for (let i = 0; i < 5; i++) {
      insertMessage(`m${i}`, 'alunos', 'A', `body${i}`, `2026-01-0${i + 1}T10:00:00.000Z`);
    }
    expect(fetchUnprocessedMessages(3)).toHaveLength(3);
  });

  it('excludes messages after markBatchProcessed and updates the unprocessed count', async () => {
    const { insertMessage, fetchUnprocessedMessages, fetchUnprocessedCount, markBatchProcessed } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    insertMessage('m2', 'alunos', 'A', 'body2', '2026-01-02T10:00:00.000Z');
    const rows = fetchUnprocessedMessages(10);
    markBatchProcessed([rows[0].id!]);
    expect(fetchUnprocessedCount()).toBe(1);
    expect(fetchUnprocessedMessages(10).map((r) => r.wa_message_id)).toEqual(['m2']);
  });

  it('markBatchProcessed is a no-op for an empty id list', async () => {
    const { markBatchProcessed, fetchUnprocessedCount } = await freshDb();
    expect(() => markBatchProcessed([])).not.toThrow();
    expect(fetchUnprocessedCount()).toBe(0);
  });
});

describe('insertActivitiesAndMark (atomic batch commit)', () => {
  it('inserts the activities and marks the source messages processed in one call', async () => {
    const { insertMessage, fetchUnprocessedMessages, fetchUnprocessedCount, insertActivitiesAndMark, fetchActivities } =
      await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);

    const ids = insertActivitiesAndMark(
      [{ type: 'prova', title: 'Prova', due_date: '2026-02-01', source_message_id: msg.id! }],
      [msg.id!]
    );

    expect(ids).toHaveLength(1);
    expect(fetchActivities()).toHaveLength(1);
    expect(fetchUnprocessedCount()).toBe(0);
  });

  it('still marks messages processed when there are no activities to insert', async () => {
    const { insertMessage, fetchUnprocessedMessages, fetchUnprocessedCount, insertActivitiesAndMark, fetchActivities } =
      await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);

    const ids = insertActivitiesAndMark([], [msg.id!]);

    expect(ids).toEqual([]);
    expect(fetchActivities()).toHaveLength(0);
    expect(fetchUnprocessedCount()).toBe(0);
  });
});

describe('insertActivities / fetchActivities / updateActivityStatus', () => {
  it('inserts activities and returns their generated ids', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    const ids = insertActivities([
      { type: 'prova', title: 'Prova de Redes', due_date: '2026-02-01', source_message_id: msg.id! },
    ]);
    expect(ids).toHaveLength(1);
  });

  it('defaults status to pendente and confidence to media when omitted', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, fetchActivities } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    insertActivities([{ type: 'evento', title: 'Palestra', due_date: '2026-02-01', source_message_id: msg.id! }]);
    const [activity] = fetchActivities();
    expect(activity.status).toBe('pendente');
    expect(activity.confidence).toBe('media');
  });

  it('filters fetchActivities by status', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, updateActivityStatus, fetchActivities } =
      await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    const [id1] = insertActivities([
      { type: 'prova', title: 'A', due_date: '2026-02-01', source_message_id: msg.id! },
    ]);
    insertActivities([{ type: 'trabalho', title: 'B', due_date: '2026-02-02', source_message_id: msg.id! }]);
    updateActivityStatus(id1, 'concluido');

    expect(fetchActivities('concluido').map((a) => a.title)).toEqual(['A']);
    expect(fetchActivities('pendente').map((a) => a.title)).toEqual(['B']);
    expect(fetchActivities()).toHaveLength(2);
  });

  it('joins group_label/author/message_timestamp from the source message', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, fetchActivities } = await freshDb();
    insertMessage('m1', 'profs', 'Prof Bob', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    insertActivities([{ type: 'prova', title: 'A', due_date: '2026-02-01', source_message_id: msg.id! }]);
    const [activity] = fetchActivities();
    expect(activity.group_label).toBe('profs');
    expect(activity.author).toBe('Prof Bob');
  });
});

describe('checkDuplicateActivity', () => {
  it('detects duplicates that are case- and accent-insensitive', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, checkDuplicateActivity } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    insertActivities([{ type: 'prova', title: 'Prova de Redes', due_date: '2026-02-01', source_message_id: msg.id! }]);

    expect(checkDuplicateActivity('prova', 'prova de redes', '2026-02-01')).toBe(true);
  });

  it('does not match a different type or due_date', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, checkDuplicateActivity } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    insertActivities([{ type: 'prova', title: 'Prova de Redes', due_date: '2026-02-01', source_message_id: msg.id! }]);

    expect(checkDuplicateActivity('trabalho', 'prova de redes', '2026-02-01')).toBe(false);
    expect(checkDuplicateActivity('prova', 'prova de redes', '2026-02-02')).toBe(false);
  });

  it('ignores activities with status descartado', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, updateActivityStatus, fetchActivities, checkDuplicateActivity } =
      await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    insertActivities([{ type: 'prova', title: 'Prova de Redes', due_date: '2026-02-01', source_message_id: msg.id! }]);
    const [activity] = fetchActivities();
    updateActivityStatus(activity.id!, 'descartado');

    expect(checkDuplicateActivity('prova', 'prova de redes', '2026-02-01')).toBe(false);
  });
});

describe('fetchMessages / fetchMessagesCount', () => {
  it('searches by author or body (case-insensitive substring)', async () => {
    const { insertMessage, fetchMessages, fetchMessagesCount } = await freshDb();
    insertMessage('m1', 'alunos', 'Alice', 'sobre a prova de calculo', '2026-01-01T10:00:00.000Z');
    insertMessage('m2', 'alunos', 'Bob', 'oi pessoal', '2026-01-02T10:00:00.000Z');

    expect(fetchMessages(10, 0, 'calculo').map((m) => m.wa_message_id)).toEqual(['m1']);
    expect(fetchMessagesCount('calculo')).toBe(1);
    expect(fetchMessagesCount()).toBe(2);
  });

  it('returns activity_count for each message', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, fetchMessages } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    insertActivities([{ type: 'prova', title: 'A', due_date: '2026-02-01', source_message_id: msg.id! }]);
    const [fetched] = fetchMessages(10);
    expect(fetched.activity_count).toBe(1);
  });

  it('orders messages by timestamp descending and applies offset', async () => {
    const { insertMessage, fetchMessages } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'first', '2026-01-01T10:00:00.000Z');
    insertMessage('m2', 'alunos', 'A', 'second', '2026-01-02T10:00:00.000Z');
    expect(fetchMessages(10, 0).map((m) => m.wa_message_id)).toEqual(['m2', 'm1']);
    expect(fetchMessages(10, 1).map((m) => m.wa_message_id)).toEqual(['m1']);
  });
});

describe('messageSimilarExists', () => {
  it('matches same group/author/body within the same minute, ignoring seconds', async () => {
    const { insertMessage, messageSimilarExists } = await freshDb();
    insertMessage('m1', 'alunos', 'Alice', 'hello', '2026-01-01T10:00:05.000Z');
    expect(messageSimilarExists('alunos', 'Alice', '2026-01-01T10:00:55.000Z', 'hello')).toBe(true);
  });

  it('does not match a different minute, author, or body', async () => {
    const { insertMessage, messageSimilarExists } = await freshDb();
    insertMessage('m1', 'alunos', 'Alice', 'hello', '2026-01-01T10:00:05.000Z');
    expect(messageSimilarExists('alunos', 'Alice', '2026-01-01T10:01:05.000Z', 'hello')).toBe(false);
    expect(messageSimilarExists('alunos', 'Bob', '2026-01-01T10:00:05.000Z', 'hello')).toBe(false);
    expect(messageSimilarExists('alunos', 'Alice', '2026-01-01T10:00:05.000Z', 'bye')).toBe(false);
  });
});

describe('insertLLMUsage / fetchUsageSummary', () => {
  it('aggregates prompt/completion tokens and run count', async () => {
    const { insertLLMUsage, fetchUsageSummary } = await freshDb();
    insertLLMUsage('deepseek-v4-flash', 100, 50, 10);
    insertLLMUsage('deepseek-v4-flash', 200, 75, 20);
    const summary = fetchUsageSummary();
    expect(summary.prompt_tokens).toBe(300);
    expect(summary.completion_tokens).toBe(125);
    expect(summary.run_count).toBe(2);
    expect(summary.last_run_at).not.toBeNull();
  });

  it('returns zeroed summary when there is no usage yet', async () => {
    const { fetchUsageSummary } = await freshDb();
    const summary = fetchUsageSummary();
    expect(summary.prompt_tokens).toBe(0);
    expect(summary.completion_tokens).toBe(0);
    expect(summary.run_count).toBe(0);
    expect(summary.last_run_at).toBeNull();
  });

  it('filters by the since timestamp', async () => {
    const { insertLLMUsage, fetchUsageSummary } = await freshDb();
    insertLLMUsage('m', 10, 5, 1);
    const summary = fetchUsageSummary('2999-01-01T00:00:00.000Z');
    expect(summary.run_count).toBe(0);
  });
});

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

describe('fetchActivityStatusCounts / fetchActivityTypeCounts / fetchMessageStats', () => {
  it('groups activities by status and by type', async () => {
    const { insertMessage, fetchUnprocessedMessages, insertActivities, updateActivityStatus, fetchActivityStatusCounts, fetchActivityTypeCounts } =
      await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const [msg] = fetchUnprocessedMessages(10);
    const [id1] = insertActivities([{ type: 'prova', title: 'A', due_date: '2026-02-01', source_message_id: msg.id! }]);
    insertActivities([{ type: 'trabalho', title: 'B', due_date: '2026-02-02', source_message_id: msg.id! }]);
    updateActivityStatus(id1, 'concluido');

    expect(fetchActivityStatusCounts()).toEqual({ concluido: 1, pendente: 1 });
    expect(fetchActivityTypeCounts()).toEqual({ prova: 1, trabalho: 1 });
  });

  it('reports total message count and earliest timestamp', async () => {
    const { insertMessage, fetchMessageStats } = await freshDb();
    insertMessage('m1', 'alunos', 'A', 'body', '2026-01-05T10:00:00.000Z');
    insertMessage('m2', 'alunos', 'A', 'body', '2026-01-01T10:00:00.000Z');
    const stats = fetchMessageStats();
    expect(stats.total).toBe(2);
    expect(stats.first_timestamp).toBe('2026-01-01T10:00:00.000Z');
  });
});
