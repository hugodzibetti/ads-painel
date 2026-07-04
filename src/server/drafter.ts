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
