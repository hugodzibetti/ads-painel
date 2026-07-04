// Maps OpenUI Lang Query()/Mutation() tool names to the existing REST API.
// No LLM is involved: Query/Mutation run these functions directly and
// client-side $variables/@builtins handle filtering, sorting, and reactivity.

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

export const toolProvider: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_activities: async (args) => {
    const status = String(args.status ?? 'all');
    const url = new URL('/api/activities', window.location.origin);
    if (status !== 'all') url.searchParams.set('status', status);
    url.searchParams.set('limit', '1000');
    return getJson(url.toString());
  },

  get_messages: async (args) => {
    const search = String(args.search ?? '');
    const url = new URL('/api/messages', window.location.origin);
    if (search) url.searchParams.set('search', search);
    url.searchParams.set('limit', '1000');
    return getJson(url.toString());
  },

  get_stats: async () => getJson('/api/stats'),

  update_activity_status: async (args) => {
    const response = await fetch(`/api/activities/${args.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: args.status }),
    });
    if (!response.ok) throw new Error(`Update failed: ${response.status}`);
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
