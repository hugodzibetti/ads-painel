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
