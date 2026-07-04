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
import { insertBriefing, fetchActivitiesForBriefing } from './db.js';
const mockChat = vi.mocked(chat);
const mockInsert = vi.mocked(insertBriefing);
const mockFetch = vi.mocked(fetchActivitiesForBriefing);

describe('generateBriefing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls LLM and stores result in briefings table', async () => {
    mockChat.mockResolvedValueOnce({ content: 'Prova de ES amanhã.', promptTokens: 50, completionTokens: 10 });
    const { generateBriefing } = await import('./briefing.js');
    await generateBriefing();
    expect(mockInsert).toHaveBeenCalledWith('Prova de ES amanhã.', 1);
  });

  it('skips LLM call when no pending graded activities', async () => {
    mockFetch.mockReturnValueOnce([]);
    const { generateBriefing } = await import('./briefing.js');
    await generateBriefing();
    expect(mockChat).not.toHaveBeenCalled();
  });
});
