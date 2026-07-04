import { chat } from './llm.js';
import { fetchActivitiesForBriefing, appendActivityContext } from './db.js';
import type { Message } from './db.js';

const SYSTEM_PROMPT = `Você analisa mensagens de WhatsApp para identificar quais são relevantes para atividades acadêmicas pendentes.
Para cada atividade abaixo, verifique se alguma das mensagens fornece informação nova: esclarecimento do professor, mudança de prazo, formato esperado, link de entrega, dúvidas respondidas, etc.
Retorne JSON: array de objetos {"activity_id": N, "message_id": N, "summary": "resumo do que é relevante"}.
Se nenhuma mensagem for relevante para uma atividade, não a inclua. Retorne [] se nada for relevante.`;

function extractJson(text: string): any[] {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\[[\s\S]*\])/);
  try { return JSON.parse(match ? match[1] : text) || []; } catch { return []; }
}

export async function scanNewMessages(messages: Message[]): Promise<void> {
  const activities = fetchActivitiesForBriefing();
  if (activities.length === 0 || messages.length === 0) return;

  const actList = activities.map((a) => `ID ${a.id}: [${a.type}] "${a.title}" prazo ${a.due_date}`).join('\n');
  const msgList = messages
    .filter((m) => m.body && m.body.length > 5)
    .map((m) => `MSG_ID ${m.id}: [${m.group_label}] ${m.author}: ${(m.body || '').slice(0, 200)}`)
    .join('\n');

  if (!msgList) return;

  const { content } = await chat(
    SYSTEM_PROMPT,
    `Atividades pendentes:\n${actList}\n\nNovas mensagens:\n${msgList}`,
    { temperature: 0.2 }
  );

  const items = extractJson(content);
  for (const item of items) {
    const msg = messages.find((m) => m.id === item.message_id);
    if (!msg || !item.activity_id || !item.summary) continue;
    appendActivityContext(item.activity_id, {
      message_id: item.message_id,
      author: msg.author,
      body: msg.body || '',
      timestamp: msg.timestamp,
    });
  }

  if (items.length > 0) {
    console.log(`[ContextMonitor] Appended context to ${items.length} activity/message pairs`);
  }
}
