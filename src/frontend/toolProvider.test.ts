import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolProvider } from './toolProvider.js';

beforeEach(() => {
  (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
  (globalThis as any).fetch = vi.fn();
});

async function loadToolProvider() {
  return toolProvider;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('toolProvider.get_activities', () => {
  it('omits the status param and requests limit=1000 when status is "all"', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse({ data: [] }));
    await toolProvider.get_activities({ status: 'all' });
    const url = new URL((fetch as any).mock.calls[0][0]);
    expect(url.searchParams.get('status')).toBeNull();
    expect(url.searchParams.get('limit')).toBe('1000');
    expect(url.pathname).toBe('/api/activities');
  });

  it('sets the status param when a specific status is requested', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse({ data: [] }));
    await toolProvider.get_activities({ status: 'pendente' });
    const url = new URL((fetch as any).mock.calls[0][0]);
    expect(url.searchParams.get('status')).toBe('pendente');
  });

  it('throws when the API responds with a non-ok status', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse(null, false, 500));
    await expect(toolProvider.get_activities({ status: 'all' })).rejects.toThrow('500');
  });
});

describe('toolProvider.get_messages', () => {
  it('only sets search param when a non-empty search is given', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse({ data: [] }));
    await toolProvider.get_messages({ search: '' });
    let url = new URL((fetch as any).mock.calls[0][0]);
    expect(url.searchParams.get('search')).toBeNull();

    await toolProvider.get_messages({ search: 'prova' });
    url = new URL((fetch as any).mock.calls[1][0]);
    expect(url.searchParams.get('search')).toBe('prova');
  });
});

describe('toolProvider.get_stats', () => {
  it('requests /api/stats', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse({ total_messages: 0 }));
    await toolProvider.get_stats({});
    expect((fetch as any).mock.calls[0][0]).toBe('/api/stats');
  });
});

describe('toolProvider.update_activity_status', () => {
  it('PATCHes the activity id with the new status', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse({ success: true }));
    await toolProvider.update_activity_status({ id: 7, status: 'concluido' });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe('/api/activities/7');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ status: 'concluido' });
  });

  it('throws when the update fails', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse(null, false, 400));
    await expect(toolProvider.update_activity_status({ id: 7, status: 'x' })).rejects.toThrow('400');
  });
});

describe('toolProvider.run_extraction', () => {
  it('POSTs the default batchSize/maxBatches to /api/extract', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse({ activities_extracted: 0 }));
    await toolProvider.run_extraction({});
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toBe('/api/extract');
    expect(JSON.parse(options.body)).toEqual({ batchSize: 30, maxBatches: 10 });
  });

  it('throws when extraction fails', async () => {
    const toolProvider = await loadToolProvider();
    (fetch as any).mockResolvedValue(jsonResponse(null, false, 500));
    await expect(toolProvider.run_extraction({})).rejects.toThrow('500');
  });
});
