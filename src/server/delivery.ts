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
