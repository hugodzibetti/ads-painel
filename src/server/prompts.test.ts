import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSystemPrompt, buildUserPrompt } from './prompts.js';
import type { Message } from './db.js';

describe('getSystemPrompt', () => {
  it('documents the valid activity types, confidence levels, and JSON contract', () => {
    const prompt = getSystemPrompt();
    expect(prompt).toContain('prova');
    expect(prompt).toContain('trabalho');
    expect(prompt).toContain('evento');
    expect(prompt).toContain('atividade');
    expect(prompt).toContain('alta');
    expect(prompt).toContain('media');
    expect(prompt).toContain('baixa');
    expect(prompt).toContain('source_message_id');
    expect(prompt).toContain('items');
  });
});

describe('buildUserPrompt', () => {
  beforeEach(() => {
    // 2026-01-06T12:00:00.000Z is a Tuesday -> São Paulo (UTC-3) is 2026-01-06 09:00, "terça"
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('states the current date/time converted to America/Sao_Paulo (UTC-3)', () => {
    const prompt = buildUserPrompt([]);
    expect(prompt).toContain('2026-01-06 (terça), 09:00, America/Sao_Paulo');
  });

  it('formats each message line as [id][group_label] (local timestamp) author: body', () => {
    const messages: Message[] = [
      {
        id: 42,
        wa_message_id: 'wa42',
        group_label: 'profs',
        author: 'Prof Bob',
        body: 'Prova amanhã às 10h',
        timestamp: '2026-01-05T15:00:00.000Z',
      },
    ];
    const prompt = buildUserPrompt(messages);
    expect(prompt).toContain('[id=42][profs] (2026-01-05 12:00) Prof Bob: Prova amanhã às 10h');
  });

  it('falls back to a readable marker when a message timestamp is invalid', () => {
    const messages: Message[] = [
      {
        id: 1,
        wa_message_id: 'wa1',
        group_label: 'alunos',
        author: 'Alice',
        body: 'oi',
        timestamp: 'not-a-date',
      },
    ];
    const prompt = buildUserPrompt(messages);
    expect(prompt).toContain('not-a-date (timestamp inválido)');
  });

  it('labels a missing group_label as desconhecido', () => {
    const messages: Message[] = [
      {
        id: 1,
        wa_message_id: 'wa1',
        group_label: '',
        author: 'Alice',
        body: 'oi',
        timestamp: '2026-01-05T15:00:00.000Z',
      },
    ];
    const prompt = buildUserPrompt(messages);
    expect(prompt).toContain('[desconhecido]');
  });

  it('includes the expected JSON response schema', () => {
    const prompt = buildUserPrompt([]);
    expect(prompt).toContain('"items"');
    expect(prompt).toContain('YYYY-MM-DD');
  });
});
