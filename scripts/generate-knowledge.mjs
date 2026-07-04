import Database from 'better-sqlite3';
import OpenAI from 'openai';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', process.env.DB_PATH || './data/app.db');
const db = new Database(dbPath);

const client = new OpenAI({
  apiKey: process.env.OPENCODE_API_KEY,
  baseURL: process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1',
});
const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4-flash';

const messages = db.prepare(`
  SELECT id, group_label, author, body, timestamp
  FROM messages
  WHERE length(body) > 10 AND body NOT LIKE '[%'
  ORDER BY timestamp ASC
`).all();

console.log(`Loaded ${messages.length} text messages`);

const formatted = messages.map(m =>
  `[${m.group_label}] (${m.timestamp.slice(0, 10)}) ${m.author}: ${m.body.slice(0, 300)}`
).join('\n');

const estimatedTokens = Math.round(formatted.length / 4);
console.log(`Estimated input tokens: ${estimatedTokens}`);

const prompt = `Você recebeu ${messages.length} mensagens dos grupos de WhatsApp da turma de ADS da FASIPE, Sinop-MT.
Grupo "profs" = canal oficial de professores. Grupo "alunos" = conversa entre alunos.

Analise todas as mensagens e produza um JSON com conhecimento estruturado sobre esta turma.

MENSAGENS:
${formatted}

Produza um JSON com esta estrutura exata:
{
  "university": "FASIPE - Sinop, MT",
  "course": "ADS - Análise e Desenvolvimento de Sistemas",
  "professors": [
    {
      "name": "Nome",
      "subjects": ["Matéria 1"],
      "delivery_patterns": ["Google Forms durante aula", "enviar no grupo"],
      "announcement_style": "descrição de como este professor comunica",
      "notes": "observações relevantes"
    }
  ],
  "subjects": [
    {
      "name": "Nome da Matéria",
      "professor": "Nome",
      "typical_activities": ["provas N1/N2", "trabalhos em grupo"],
      "delivery_method": "método mais comum",
      "notes": ""
    }
  ],
  "students": [
    {
      "name": "Nome",
      "role": "líder/ativo/representante/etc"
    }
  ],
  "group_norms": {
    "profs": "como este grupo é usado",
    "alunos": "como este grupo é usado"
  },
  "delivery_patterns": {
    "google_forms": "quando e por quem é usado",
    "google_docs": "quando e por quem é usado",
    "whatsapp": "quando é usado para entrega",
    "in_person": "o que é sempre presencial",
    "email": "se usado"
  },
  "academic_calendar_notes": "observações sobre datas, N1/N2, semestre",
  "communication_patterns": "como professores e alunos se comunicam no geral"
}

Retorne APENAS o JSON, sem texto adicional.`;

console.log('Sending single synthesis call...');
const start = Date.now();

const response = await client.chat.completions.create({
  model: MODEL,
  messages: [
    { role: 'system', content: 'Você é um analista acadêmico. Analise as mensagens e produza JSON válido e completo.' },
    { role: 'user', content: prompt },
  ],
  temperature: 0.1,
  max_tokens: 16000,
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const content = response.choices[0]?.message?.content || '';
const reasoningLen = response.choices[0]?.message?.reasoning_content?.length || 0;

console.log(`Done in ${elapsed}s — total tokens: ${response.usage?.total_tokens}, content length: ${content.length}, reasoning length: ${reasoningLen}`);
console.log('finish_reason:', response.choices[0]?.finish_reason);

if (!content) {
  console.error('ERROR: content is empty. reasoning_content preview:');
  console.error((response.choices[0]?.message?.reasoning_content || '').slice(0, 500));
  process.exit(1);
}

console.log('\n--- RAW OUTPUT ---');
console.log(content.slice(0, 1000));
console.log('...');
console.log('--- END (truncated) ---\n');

let knowledge;
try {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
  knowledge = JSON.parse(match[1] || content);
} catch (err) {
  console.error('JSON parse error, saving raw output');
  knowledge = { raw: content };
}

const outPath = resolve(__dirname, '..', 'data', 'knowledge-base.json');
writeFileSync(outPath, JSON.stringify(knowledge, null, 2), 'utf-8');
console.log(`Knowledge base saved to: ${outPath}`);
console.log(`Professors: ${knowledge.professors?.length ?? 'N/A'}`);
console.log(`Subjects: ${knowledge.subjects?.length ?? 'N/A'}`);
console.log(`Students: ${knowledge.students?.length ?? 'N/A'}`);
