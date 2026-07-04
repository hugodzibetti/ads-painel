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
