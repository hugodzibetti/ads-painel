import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchLatestKnowledgeBase, insertKnowledgeBase, fetchMessages, insertLLMUsage } from './db.js';
import { chat, getModel } from './llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function seedKnowledgeBaseIfEmpty(): Promise<void> {
  const existing = fetchLatestKnowledgeBase();
  if (existing) return;

  const jsonPath = resolve(__dirname, '../../data/knowledge-base.json');
  if (!existsSync(jsonPath)) {
    console.log('[Knowledge] No knowledge base found — run POST /api/knowledge/generate');
    return;
  }

  const content = readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(content);
  insertKnowledgeBase(JSON.stringify(parsed), 0);
  console.log('[Knowledge] Seeded knowledge base from data/knowledge-base.json');
}

export async function generateKnowledgeBase(): Promise<void> {
  const messages = fetchMessages(5000, 0);
  const formatted = messages
    .filter((m) => m.body && m.body.length > 5 && m.body.length < 500)
    .map((m) => `[${m.group_label}] (${(m.timestamp || '').slice(0, 10)}) ${m.author}: ${m.body}`)
    .join('\n');

  const systemPrompt = `Você é um analista acadêmico. Analise as mensagens do WhatsApp do grupo de ADS (Análise e Desenvolvimento de Sistemas) da FASIPE Sinop e produza um documento estruturado em JSON com as seguintes informações sobre o grupo:
- professors: array de objetos com name, subjects, delivery_patterns, announcement_style
- subjects: array de objetos com name, professor, typical_activities, delivery_method
- group_norms: objeto com profs e alunos descrevendo o padrão de uso de cada grupo
- delivery_patterns: objeto mapeando método (google_forms, whatsapp, in_person, google_docs) para array de contextos/padrões observados
Responda APENAS com o JSON, sem explicações.`;

  const userPrompt = `Mensagens (${messages.length} total):\n\n${formatted}`;

  const result = await chat(systemPrompt, userPrompt, {
    temperature: 0.1,
    max_tokens: 16000,
    injectKnowledgeBase: false,
  });

  if (!result.content) {
    throw new Error('Knowledge generation returned empty content');
  }

  insertKnowledgeBase(result.content, messages.length);
  insertLLMUsage(getModel(), result.promptTokens, result.completionTokens, messages.length);
  console.log(`[Knowledge] Generated knowledge base from ${messages.length} messages`);
}
