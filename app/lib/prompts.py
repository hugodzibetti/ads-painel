from datetime import datetime, timezone, timedelta
import pytz

def get_system_prompt():
    """Build the system prompt for extraction."""
    return """Você é um assistente especializado em extrair atividades acadêmicas de mensagens de WhatsApp.

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
"""

def build_user_prompt(messages):
    """Build the user prompt with messages and current context."""
    tz = pytz.timezone('America/Sao_Paulo')
    now_local = datetime.now(tz)
    date_str = now_local.strftime('%Y-%m-%d')
    day_name = now_local.strftime('%A')
    day_name_pt = {
        'Monday': 'segunda',
        'Tuesday': 'terça',
        'Wednesday': 'quarta',
        'Thursday': 'quinta',
        'Friday': 'sexta',
        'Saturday': 'sábado',
        'Sunday': 'domingo'
    }.get(day_name, day_name)
    time_str = now_local.strftime('%H:%M')

    prompt = f"""Data/hora atual: {date_str} ({day_name_pt}), {time_str}, America/Sao_Paulo.

Analise as seguintes mensagens e extraia atividades acadêmicas:

"""
    for msg in messages:
        msg_ts = datetime.fromisoformat(msg['timestamp'])
        msg_ts_local = msg_ts.replace(tzinfo=timezone.utc).astimezone(tz)
        msg_dt_str = msg_ts_local.strftime('%Y-%m-%d %H:%M')
        group_label = msg.get('group_label', 'desconhecido')

        prompt += f"[id={msg['id']}][{group_label}] ({msg_dt_str}) {msg['author']}: {msg['body']}\n"

    prompt += """\nRetorne um JSON válido com a seguinte estrutura:
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
"""
    return prompt
