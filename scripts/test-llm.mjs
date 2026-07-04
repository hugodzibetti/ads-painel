import OpenAI from 'openai';
import 'dotenv/config';

const client = new OpenAI({
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1',
});

const response = await client.chat.completions.create({
  model: process.env.OPENCODE_MODEL || 'deepseek-v4-flash',
  messages: [
    { role: 'system', content: 'Você é um assistente útil.' },
    { role: 'user', content: 'Liste 3 matérias típicas de um curso de ADS no Brasil.' },
  ],
  temperature: 0.2,
  max_tokens: 200,
});

console.log('Full response:', JSON.stringify(response, null, 2));
console.log('Content:', response.choices[0]?.message?.content);
