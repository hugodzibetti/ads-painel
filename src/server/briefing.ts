import { chat } from './llm.js';
import { fetchActivitiesForBriefing, insertBriefing } from './db.js';

const SYSTEM_PROMPT = `Você é um assistente de estudante universitário. Gere um parágrafo curto (2-3 frases) em português resumindo o estado atual das atividades pendentes: urgência, conflitos de prazo, atividades prontas para revisão. Seja direto e objetivo. Mencione nomes de matérias e prazos concretos quando disponíveis.`;

export async function generateBriefing(): Promise<void> {
  const activities = fetchActivitiesForBriefing();
  if (activities.length === 0) return;

  const summary = activities.map((a) =>
    `[${a.type}] "${a.title}" — prazo: ${a.due_date} (${a.days_until_due} dias) — etapa: ${a.delivery_stage}`
  ).join('\n');

  const { content } = await chat(SYSTEM_PROMPT, `Atividades pendentes:\n${summary}`, { temperature: 0.4 });
  if (content) {
    insertBriefing(content, activities.length);
    console.log('[Briefing] Generated briefing for', activities.length, 'activities');
  }
}
