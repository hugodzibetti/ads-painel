import { chat } from './llm.js';
import type { Activity, Message } from './db.js';

export interface DetectionResult {
  is_graded: boolean;
  delivery_method: string;
  delivery_url: string | null;
  delivery_instructions: string | null;
}

const SYSTEM_PROMPT = `Você é um classificador de atividades acadêmicas. Analise a atividade e as mensagens de origem e retorne um JSON com:
- is_graded (boolean): true se a atividade vale nota (trabalhos, provas, formulários com nota, relatórios de laboratório, atividades com "vale nota"/"N1"/"N2"/"pontos"). false para enquetes, preferências, RSVPs, confirmações de presença, informações gerais.
- delivery_method (string): "google_forms" se há link forms.gle, "google_docs" se há link docs.google.com ou "enviar doc", "whatsapp" se "enviar no grupo"/"mandar no zap", "in_person" se "presencial"/"sala"/"imprimir"/"na aula", "unknown" se nenhum sinal claro.
- delivery_url (string|null): URL encontrada se google_forms ou google_docs.
- delivery_instructions (string|null): instrução de entrega se extraível.
Quando incerto sobre is_graded, prefira true. Responda APENAS com JSON.`;

function extractJson(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
  try { return JSON.parse(match ? match[1] : text); } catch { return null; }
}

export async function classifyAndDetect(activity: Activity, sourceMessages: Message[]): Promise<DetectionResult> {
  const msgContext = sourceMessages.map((m) => `[${m.group_label}] ${m.author}: ${m.body}`).join('\n');
  const userContent = `Atividade: ${JSON.stringify({ type: activity.type, title: activity.title, description: activity.description })}\n\nMensagens de origem:\n${msgContext}`;

  const { content } = await chat(SYSTEM_PROMPT, userContent, { temperature: 0.1 });
  const parsed = extractJson(content);

  if (!parsed) {
    return { is_graded: true, delivery_method: 'unknown', delivery_url: null, delivery_instructions: null };
  }

  return {
    is_graded: parsed.is_graded !== false,
    delivery_method: ['google_forms', 'google_docs', 'whatsapp', 'in_person', 'unknown'].includes(parsed.delivery_method)
      ? parsed.delivery_method : 'unknown',
    delivery_url: parsed.delivery_url || null,
    delivery_instructions: parsed.delivery_instructions || null,
  };
}
