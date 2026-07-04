import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockChatFn = vi.hoisted(() => vi.fn());

vi.mock('./llm.js', () => ({
  chat: mockChatFn,
  getModel: vi.fn(() => 'test-model'),
}));

const dbMocks = vi.hoisted(() => ({
  fetchUnprocessedMessages: vi.fn(),
  fetchUnprocessedCount: vi.fn(),
  markBatchProcessed: vi.fn(),
  insertActivities: vi.fn(),
  checkDuplicateActivity: vi.fn(),
  insertLLMUsage: vi.fn(),
  fetchLatestKnowledgeBase: vi.fn().mockReturnValue(null),
  updateActivityDelivery: vi.fn(),
  fetchActivities: vi.fn().mockReturnValue([]),
}));

vi.mock('./db.js', () => dbMocks);

// Silence post-run pipeline — all wrapped in try/catch anyway, but let's be explicit
vi.mock('./deliveryDetector.js', () => ({ classifyAndDetect: vi.fn().mockResolvedValue({ is_graded: false, delivery_method: 'unknown', delivery_url: null, delivery_instructions: null }) }));
vi.mock('./briefing.js', () => ({ generateBriefing: vi.fn() }));
vi.mock('./contextMonitor.js', () => ({ scanNewMessages: vi.fn() }));
vi.mock('./drafter.js', () => ({ checkAndDraftSubmissions: vi.fn() }));

import { runExtraction } from './extraction.js';

const sampleMessage = (id: number) => ({
  id,
  wa_message_id: `wa${id}`,
  group_label: 'alunos',
  author: 'Alice',
  body: 'body',
  timestamp: '2026-01-01T10:00:00.000Z',
});

function mockCompletion(content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) {
  mockChatFn.mockResolvedValueOnce({
    content,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  });
}

describe('runExtraction', () => {
  const originalApiKey = process.env.OPENCODE_API_KEY;

  beforeEach(() => {
    process.env.OPENCODE_API_KEY = 'test-key';
    dbMocks.fetchUnprocessedMessages.mockReset();
    dbMocks.fetchUnprocessedCount.mockReset().mockReturnValue(0);
    dbMocks.markBatchProcessed.mockReset();
    dbMocks.insertActivities.mockReset().mockReturnValue([]);
    dbMocks.checkDuplicateActivity.mockReset().mockReturnValue(false);
    dbMocks.insertLLMUsage.mockReset();
    dbMocks.fetchActivities.mockReset().mockReturnValue([]);
    dbMocks.updateActivityDelivery.mockReset();
    mockChatFn.mockReset();
  });

  afterEach(() => {
    process.env.OPENCODE_API_KEY = originalApiKey;
  });

  it('returns an error immediately when OPENCODE_API_KEY is not set, without touching the db', async () => {
    delete process.env.OPENCODE_API_KEY;
    const result = await runExtraction();
    expect(result.errors).toEqual(['OPENCODE_API_KEY is not set']);
    expect(result.activities_extracted).toBe(0);
    expect(dbMocks.fetchUnprocessedMessages).not.toHaveBeenCalled();
  });

  it('stops immediately when there are no unprocessed messages', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValue([]);
    const result = await runExtraction();
    expect(result.messages_processed).toBe(0);
    expect(mockChatFn).not.toHaveBeenCalled();
  });

  it('inserts valid extracted activities and marks the batch processed', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(
      JSON.stringify({
        items: [{ type: 'prova', title: 'Prova', due_date: '2026-02-01', source_message_id: 1, confidence: 'alta' }],
      })
    );

    const result = await runExtraction();

    expect(dbMocks.insertActivities).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'prova', title: 'Prova', source_message_id: 1 }),
    ]);
    expect(dbMocks.markBatchProcessed).toHaveBeenCalledWith([1]);
    expect(result.activities_extracted).toBe(1);
    expect(result.messages_processed).toBe(1);
    expect(result.total_tokens_used).toBe(15);
  });

  it('parses JSON wrapped in a markdown code fence', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(
      '```json\n' +
        JSON.stringify({
          items: [{ type: 'evento', title: 'Palestra', due_date: '2026-02-01', source_message_id: 1, confidence: 'media' }],
        }) +
        '\n```'
    );

    const result = await runExtraction();
    expect(result.activities_extracted).toBe(1);
  });

  it('marks the batch processed without inserting activities when the response is not valid JSON', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion('not json at all');

    const result = await runExtraction();
    expect(dbMocks.markBatchProcessed).toHaveBeenCalledWith([1]);
    expect(dbMocks.insertActivities).not.toHaveBeenCalled();
    expect(result.activities_extracted).toBe(0);
    expect(result.messages_processed).toBe(1);
  });

  it('also marks the batch processed when a {...}-shaped fallback match is still invalid JSON', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion('here is the result: {not: valid, json}');

    const result = await runExtraction();
    expect(dbMocks.markBatchProcessed).toHaveBeenCalledWith([1]);
    expect(result.activities_extracted).toBe(0);
  });

  it('discards items missing required fields', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(JSON.stringify({ items: [{ type: 'prova', title: 'Prova' }] }));

    const result = await runExtraction();
    expect(dbMocks.insertActivities).not.toHaveBeenCalled();
    expect(result.activities_extracted).toBe(0);
  });

  it('discards items whose source_message_id is not in the current batch', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(
      JSON.stringify({
        items: [{ type: 'prova', title: 'Prova', due_date: '2026-02-01', source_message_id: 999, confidence: 'alta' }],
      })
    );

    const result = await runExtraction();
    expect(dbMocks.insertActivities).not.toHaveBeenCalled();
    expect(result.activities_extracted).toBe(0);
  });

  it('discards items with an invalid type', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(
      JSON.stringify({
        items: [{ type: 'festa', title: 'Festa', due_date: '2026-02-01', source_message_id: 1, confidence: 'alta' }],
      })
    );

    const result = await runExtraction();
    expect(dbMocks.insertActivities).not.toHaveBeenCalled();
  });

  it('defaults an invalid confidence to media instead of discarding the item', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(
      JSON.stringify({
        items: [{ type: 'prova', title: 'Prova', due_date: '2026-02-01', source_message_id: 1, confidence: 'super-alta' }],
      })
    );

    await runExtraction();
    expect(dbMocks.insertActivities).toHaveBeenCalledWith([expect.objectContaining({ confidence: 'media' })]);
  });

  it('discards items with a non-ISO due_date', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    mockCompletion(
      JSON.stringify({
        items: [{ type: 'prova', title: 'Prova', due_date: '01/02/2026', source_message_id: 1, confidence: 'alta' }],
      })
    );

    const result = await runExtraction();
    expect(dbMocks.insertActivities).not.toHaveBeenCalled();
    expect(result.activities_extracted).toBe(0);
  });

  it('skips items that are duplicates of existing activities', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValueOnce([]);
    dbMocks.checkDuplicateActivity.mockReturnValue(true);
    mockCompletion(
      JSON.stringify({
        items: [{ type: 'prova', title: 'Prova', due_date: '2026-02-01', source_message_id: 1, confidence: 'alta' }],
      })
    );

    const result = await runExtraction();
    expect(dbMocks.insertActivities).not.toHaveBeenCalled();
    expect(result.activities_extracted).toBe(0);
    expect(dbMocks.markBatchProcessed).toHaveBeenCalledWith([1]);
  });

  it('records the LLM error and continues instead of throwing when a batch call rejects', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValueOnce([sampleMessage(1)]).mockReturnValue([]);
    mockChatFn.mockRejectedValueOnce(new Error('rate limited'));

    const result = await runExtraction();
    expect(result.errors).toEqual(['Batch 1 extraction error: rate limited']);
    expect(dbMocks.markBatchProcessed).not.toHaveBeenCalled();
  });

  it('stops after maxBatches even if messages remain unprocessed', async () => {
    dbMocks.fetchUnprocessedMessages.mockReturnValue([sampleMessage(1)]);
    mockCompletion(JSON.stringify({ items: [] }));
    mockCompletion(JSON.stringify({ items: [] }));

    await runExtraction(30, 2);
    expect(mockChatFn).toHaveBeenCalledTimes(2);
  });
});
