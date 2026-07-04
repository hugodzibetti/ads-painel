import { Message } from './db.js';

export function getSystemPrompt(): string {
  return `Você é um assistente especializado em extrair atividades acadêmicas de mensagens de WhatsApp.

Sua tarefa é identificar e estruturar atividades como: provas, trabalhos, eventos e atividades com prazos claros.

INSTRUÇÕES CRÍTICAS:

1. **Datas Relativas**: Use o timestamp da mensagem (mostrado entre parênteses) para resolver referências como "hoje", "amanhã", "essa sexta", "segunda que vem". Não use a data/hora atual do topo.

2. **Tipos Válidos**: 'prova', 'trabalho', 'evento', 'atividade'. Só use estes valores.

3. **Confiança**: 'alta', 'media', 'baixa'. Alta para avisos claros e oficiais. Baixa para especulações, perguntas incertas, ou informação vaga.

4. **Formato de Saída**: JSON com array "items". Cada item deve ter:
   - type (string)
   - title (string)
   - due_date (string, formato ISO YYYY-MM-DD)
   - source_message_id (integer, exatamente como estava entre [colchetes])
   - confidence (string)
   - description (string, opcional)

Exemplo de output esperado:
{
  "items": [
    {
      "type": "prova",
      "title": "Prova de Redes",
      "due_date": "2026-07-10",
      "source_message_id": 123,
      "confidence": "alta"
    }
  ]
}

PADRÕES A IGNORAR:
- Perguntas sobre existência de prova/atividade ("tem prova hj?")
- Respostas incertas de colegas ("acho que é até sexta")
- Conversas sobre notas/resultados já passados ("tirei 7 na prova")
- Cancelamentos informais ("prova de amanhã cancelada") - não cria item novo
- Mensagens de bom-dia, gírias, conversas off-topic

PADRÕES A PRIORIZAR:
- Avisos oficiais de professores/coordenador com data explícita
- Cronogramas estruturados
- Prazos claramente indicados (datas, horários)

Extraia apenas atividades futuras com informação acionável. Se não houver atividade, retorne {"items": []}.
`;
}

const DAY_NAMES_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Convert a UTC instant to São Paulo wall-clock via the IANA tz database, so the
// result stays correct across any offset/DST rule change instead of a hardcoded -3.
function formatSaoPaulo(d: Date): { date: string; time: string; dayNamePt: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const dow = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day)).getUTCDay();
  return { date, time: `${parts.hour}:${parts.minute}`, dayNamePt: DAY_NAMES_PT[dow] };
}

export function buildUserPrompt(messages: Message[]): string {
  const nowSp = formatSaoPaulo(new Date());

  let prompt = `Data/hora atual: ${nowSp.date} (${nowSp.dayNamePt}), ${nowSp.time}, America/Sao_Paulo.

Analise as seguintes mensagens e extraia atividades acadêmicas:

`;

  for (const msg of messages) {
    let msgDtStr: string;
    try {
      const msgTs = new Date(msg.timestamp);
      if (isNaN(msgTs.getTime())) throw new Error('invalid');
      const sp = formatSaoPaulo(msgTs);
      msgDtStr = `${sp.date} ${sp.time}`;
    } catch (err) {
      msgDtStr = `${msg.timestamp} (timestamp inválido)`;
    }
    const groupLabel = msg.group_label || 'desconhecido';
    prompt += `[id=${msg.id}][${groupLabel}] (${msgDtStr}) ${msg.author}: ${msg.body}\n`;
  }

  prompt += `\nRetorne um JSON válido com a seguinte estrutura:
{
  "items": [
    {
      "type": "...",
      "title": "...",
      "due_date": "YYYY-MM-DD",
      "source_message_id": <int>,
      "confidence": "alta|media|baixa",
      "description": "..." (opcional)
    }
  ]
}
`;

  return prompt;
}
