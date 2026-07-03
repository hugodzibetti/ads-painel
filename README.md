# ads-painel

**MVP**: Painel automatizado de atividades acadêmicas, capturando mensagens de dois grupos WhatsApp e extraindo prazos (provas, trabalhos, eventos, atividades) via LLM para revisão manual em um painel Streamlit.

## Arquitetura

- **Bot (Node.js)**: Escuta os dois grupos WhatsApp via `whatsapp-web.js`, insere mensagens no SQLite
- **App (Python/Streamlit)**: Interface web para revisar atividades extraídas pela LLM, gerenciar status
- **SQLite compartilhado**: Feed único de mensagens + atividades estruturadas, com WAL + busy_timeout para concorrência segura

## Setup

### 1. Clonar e instalar dependências

```bash
git clone <repo-url> ads-painel
cd ads-painel

# Bot
cd bot && npm install && cd ..

# App
python -m venv venv
source venv/bin/activate  # ou 'venv\Scripts\activate' no Windows
pip install -r app/requirements.txt
```

### 2. Configurar `.env`

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

Edite `.env`:

```dotenv
OPENCODE_API_KEY=<sua-chave-api>
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_MODEL=deepseek-v4-flash

# Deixe em branco por enquanto
WHATSAPP_GROUP_ID_ALUNOS=
WHATSAPP_GROUP_ID_PROFS=

DB_PATH=./data/app.db
```

### 3. Iniciar o bot (primeira vez)

```bash
cd bot
npm start
```

O bot exibirá um **QR Code** no terminal. Escaneie com seu WhatsApp:

1. Abra WhatsApp no seu telefone
2. Vá em **Configurações > Conectados** (ou similar)
3. Aponte a câmera para o QR Code exibido no terminal

Após autenticar, o bot listará todos os grupos disponíveis com seus IDs. Identifique:

- **"ADS"** → este é o grupo de **alunos**
- **"1° ADS Fasipe Sorriso"** → este é o grupo de **professores+alunos**

Copie os IDs e atualize `.env`:

```dotenv
WHATSAPP_GROUP_ID_ALUNOS=<ID do grupo "ADS">
WHATSAPP_GROUP_ID_PROFS=<ID do grupo "1° ADS Fasipe Sorriso">
```

Reinicie o bot (Ctrl+C, depois `npm start` novamente). Agora ele deve começar a capturar mensagens dos dois grupos.

### 4. Iniciar a aplicação Streamlit

Em outro terminal:

```bash
cd app
streamlit run Home.py
```

A aplicação abrirá em `http://localhost:8501`.

## Fluxo de uso

1. **Bot rodando**: captura mensagens continuamente dos dois grupos WhatsApp
2. **App aberta**: exibe contador de mensagens pendentes e atividades
3. **Extração automática 1x/dia**: um agendador externo (cron/systemd, veja "Extração diária" abaixo) roda `python -m scripts.daily_extraction`, que processa até **10 lotes de 30 mensagens** por execução (limite de custo) e extrai atividades (prova, trabalho, evento, atividade) com prazos
4. **Revise no Painel**:
   - Tabs: Pendentes, Concluídas, Descartadas
   - Para cada atividade: marque como ✅ Concluir ou ❌ Descartar
   - Cards coloridos indicam urgência (🟢 verde = longe, 🔴 vermelho = atrasado)
5. **Histórico**: abra a página Mensagens para pesquisar e visualizar o feed completo

## Import retroativo (histórico completo com mídia)

Para popular o banco com o histórico completo de um grupo (não só mensagens novas), exporte a conversa no WhatsApp com mídia incluída (Configurações do grupo → Exportar conversa → Incluir mídia) e rode:

```bash
cd app && source venv/bin/activate
python -m scripts.import_export "/caminho/para/Conversa do WhatsApp com ADS.zip" "/caminho/para/Conversa do WhatsApp com 1° ADS Fasipe Sorriso.zip"
```

Primeiro argumento é sempre o export do grupo **alunos**, segundo é sempre **profs**. O script nunca copia os `.zip`/mídia para dentro do repositório — extrai para uma pasta temporária do sistema, processa, e descarta.

Processamento por tipo de mídia (pensado pra ficar barato): texto e PDF (extração local, de graça) são processados sempre; imagens usam `kimi-k2.7-code` via `OPENCODE_VISION_BASE_URL`/`OPENCODE_VISION_MODEL` (mesmo plano Go já assinado, sem custo extra — testado empiricamente porque nem todo modelo do Go plan tem visão real: `glm-5.2` recusa a imagem explicitamente, `kimi-k2.7-code` e `minimax-m3` leem texto de imagem corretamente); áudio e vídeo são transcritos localmente via `faster-whisper` (`large-v3`, usa GPU se disponível — sem custo de API, mas o download inicial do modelo (~3GB) é bem mais rápido com um `HF_TOKEN` gratuito configurado); figurinhas são ignoradas.

Requer `ffmpeg` instalado no sistema para processar vídeos (`apt install ffmpeg`).

Rodar `large-v3` só em CPU é bem lento para exports grandes — recomenda-se GPU se você tiver histórico volumoso pra importar.

## Extração diária

A extração de atividades não roda mais por clique manual — um agendador externo ao repositório (cron ou systemd timer, específico do host onde a aplicação roda) deve invocar `python -m scripts.daily_extraction` uma vez por dia. O script drena a fila inteira de mensagens não processadas na mesma execução (mesmo loop de lotes de 10x30 usado em `import_export.py`), então mesmo picos de volume acima de 300 mensagens/dia são processados numa única chamada do agendador.

**Crontab** (`crontab -e`):
```bash
0 6 * * * cd /caminho/para/ads-painel/app && venv/bin/python -m scripts.daily_extraction >> /caminho/para/ads-painel/logs/daily_extraction.log 2>&1
```

**systemd timer** (alternativa): crie `/etc/systemd/system/ads-painel-extraction.service`:
```ini
[Unit]
Description=Extração diária de atividades do ads-painel

[Service]
Type=oneshot
WorkingDirectory=/caminho/para/ads-painel/app
ExecStart=/caminho/para/ads-painel/app/venv/bin/python -m scripts.daily_extraction
User=SEU_USUARIO
```

e `/etc/systemd/system/ads-painel-extraction.timer`:
```ini
[Unit]
Description=Roda a extração diária do ads-painel às 6h

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Depois: `sudo systemctl enable --now ads-painel-extraction.timer`.

Nenhum desses arquivos é versionado no repositório — caminhos e usuário do sistema variam por host, então cabe a quem hospeda a aplicação adaptar e instalar localmente.

## Estrutura de arquivos

```
ads-painel/
├── shared/
│   └── schema.sql              # Schema SQLite compartilhado
├── bot/
│   ├── package.json
│   ├── config.js               # Carrega .env e resolve DB_PATH
│   ├── db.js                   # Acesso SQLite
│   └── index.js                # Lógica principal do bot
├── app/
│   ├── Home.py                 # Landing page
│   ├── requirements.txt
│   ├── lib/
│   │   ├── db.py               # Acesso SQLite (Python)
│   │   ├── prompts.py          # Templates de prompt LLM
│   │   └── extraction.py       # Pipeline de extração
│   ├── scripts/
│   │   └── daily_extraction.py # CLI invocado 1x/dia pelo agendador externo
│   └── pages/
│       ├── 1_Painel.py         # Página de revisão de atividades
│       └── 2_Mensagens.py      # Página de feed de mensagens
├── .env.example
├── .gitignore
└── README.md
```

## Notas técnicas

### Banco de dados

- **SQLite WAL mode**: garante escrita e leitura simultâneas sem travamento
- **busy_timeout**: 5 segundos por conexão (Node: better-sqlite3, Python: sqlite3)
- **Schema idempotente**: ambos os processos executam o schema no startup

### Extração de atividades

- **Tipos válidos**: prova, trabalho, evento, atividade
- **Confiança**: alta, media, baixa (indicada no Painel com ⚠️)
- **Timestamps**: convertidos para `America/Sao_Paulo` antes do prompt
- **Datas relativas** ("hoje", "amanhã", "segunda que vem"): resolvidas pelo timestamp da própria mensagem, não pela data atual
- **Dedup**: evita duplicar o mesmo aviso repostado em ambos os grupos
- **source_message_id**: referência explícita à mensagem original (link no Painel)

### Controle de custo

- **Cap de processamento**: máximo 10 lotes de 30 mensagens **por execução** do `daily_extraction`
- **Frequência fixa**: extração roda 1x/dia via agendador externo (cron/systemd), nunca em polling contínuo
- **Visibilidade**: tokens consumidos exibidos após cada execução
- **Modelo**: `deepseek-v4-flash` (barato); **não altere sem avaliar custo**

## Riscos e limitações

### ⚠️ Uso não-oficial do WhatsApp

A biblioteca `whatsapp-web.js` usa automação do navegador (Chromium) para conectar ao WhatsApp. Isso **não é oficialmente suportado** pela Meta/WhatsApp:

- **Conta pode ser suspeita**: se atividade anormal for detectada, a conta pode receber avisos ou restrições
- **Sem suporte**: Meta pode mudar o protocolo e quebrar a biblioteca sem aviso
- **Uso sob próprio risco**: certifique-se de que está autorizado a usar automação neste contexto (ambiente pessoal/educacional, não produção pública)

### 🤖 Extração por LLM

- **Imprecisão**: o modelo pode não entender contexto, deixar passar prazos ou criar atividades imaginárias
- **Confiança baixa**: atividades com confiança baixa (ex: especulações de colegas) devem ser revisadas manualmente
- **Fora de escopo MVP**: mídia (imagens, áudios) não são processadas — prazos comunicados só por imagem/áudio não serão capturados

### 🔒 Concorrência SQLite

- **WAL mode**: garante operações seguras, mas em casos extremos de contenção, a aplicação pode ficar mais lenta
- **Busy timeout**: conflitos de escrita são reprocessados automaticamente até 5 segundos

### 💰 Uso de API

- **OpenCode Zen Go**: monitore regularmente o painel de uso no site do OpenCode para acompanhar consumo
- **Custo por token**: `deepseek-v4-flash` é barato, mas acumula com o tempo — monitore o consumo diário exibido no Painel
- **Atingir limite**: se atingir limite de uso do plano, a extração falhará com erro de API key inválida

### 📱 Funcionalidades não incluídas neste MVP

- Transcrição/gravação de aulas
- Extração de mídia (imagens, áudios, PDFs)
- Histórico completo retroativo (apenas novas mensagens a partir do start do bot)
- Notificações em tempo real
- Integração com calendário / agenda

## Fases futuras

### Resumos e pesquisa

Usar o histórico estruturado para responder perguntas tipo:
- "Quais provas já passaram e qual foi o resultado?"
- "Quantos trabalhos tenho em aberto?"
- "Qual professor costuma passar tarefas?"

## Troubleshooting

### Bot não conecta ao WhatsApp

- Verifique se o QR Code apareceu e foi escaneado
- Confirme que seu telefone está conectado à internet
- Tente desconectar e reconectar no WhatsApp Web no navegador do seu computador (confirma que a sessão não está bloqueada)

### "WHATSAPP_GROUP_ID_* must be set"

O bot pediu para você mapear os IDs dos grupos. Rode novamente sem a variável setada e copie os IDs exibidos.

### Streamlit error: "ModuleNotFoundError: No module named 'openai'"

```bash
pip install -r app/requirements.txt
```

### Extração retorna "items": []

Pode ser:
- Nenhuma mensagem nova foi adicionada desde a última execução
- Mensagens são apenas conversas off-topic (o modelo as descarta corretamente)
- Mensagens têm prazos em formatação que o modelo não reconhecer (ajuste o prompt em `app/lib/prompts.py`)

### Base de dados "database is locked"

Raro com WAL mode. Se acontecer:
- Pare ambos os processos (bot e app)
- Aguarde 2-3 segundos
- Reinicie

### "Invalid API key" ao extrair

- Verifique se `OPENCODE_API_KEY` está correto em `.env`
- Confirme que não atingiu o limite de uso do plano OpenCode Zen Go
- Teste a chave diretamente no painel do OpenCode

## Contribuindo / Próximos passos

Este é um MVP funcional. Se desejar estender:

1. **Ajustar prompts**: edite `app/lib/prompts.py` para melhorar reconhecimento de padrões
2. **Adicionar filtros**: estenda `app/lib/db.py` para queries mais sofisticadas
3. **Refinar urgência**: customize cores e cálculo de proximidade em `app/pages/1_Painel.py`

## Licença

Pessoal / educacional. Veja riscos acima.
