import OpenAI from 'openai';
import { fetchLatestKnowledgeBase } from './db.js';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENCODE_API_KEY || '',
      baseURL: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1',
    });
  }
  return _client;
}

export function getModel(): string {
  return process.env.OPENCODE_MODEL || 'deepseek-v4-flash';
}

export async function chat(
  systemPrompt: string,
  userContent: string,
  opts: { temperature?: number; max_tokens?: number; injectKnowledgeBase?: boolean } = {}
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const { temperature = 0.3, max_tokens, injectKnowledgeBase = true } = opts;

  let fullSystem = systemPrompt;
  if (injectKnowledgeBase) {
    const kb = fetchLatestKnowledgeBase();
    if (kb?.content) {
      fullSystem = `## Contexto do grupo e universidade\n${kb.content}\n\n---\n\n${systemPrompt}`;
    }
  }

  const response = await getClient().chat.completions.create({
    model: getModel(),
    messages: [
      { role: 'system', content: fullSystem },
      { role: 'user', content: userContent },
    ],
    temperature,
    ...(max_tokens ? { max_tokens } : {}),
  });

  return {
    content: response.choices[0]?.message?.content || '',
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
  };
}
