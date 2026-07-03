# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal MVP that captures messages from two WhatsApp groups (a class of ADS students), extracts academic deadlines (exams, assignments, events) via LLM, and shows them in a Streamlit dashboard for manual review. Two independent processes share one SQLite database:

- **`bot/`** (Node.js): connects to WhatsApp via `whatsapp-web.js`, listens on two group chats, writes raw messages to SQLite.
- **`app/`** (Python/Streamlit): reads unprocessed messages, calls an LLM to extract structured activities, renders the review UI.
- **`shared/schema.sql`**: single source of truth for the DB schema, executed idempotently by both processes on every connection/startup.

## Commands

### Bot (Node)
```bash
cd bot && npm install
npm start                      # runs index.js, prints QR code first run
node tests/test_config.js      # plain node script, no test runner — asserts + process.exit(1) on failure
node tests/test_db.js
```

### App (Python)
```bash
python -m venv venv && source venv/bin/activate
pip install -r app/requirements.txt
cd app && streamlit run Home.py            # serves http://localhost:8501
cd app && python -m pytest tests/          # tests do sys.path.insert(parent) to import lib.*
cd app && python -m pytest tests/test_extraction.py -k some_test   # single test
```

### Docker (both processes + shared volume)
```bash
docker compose up --build
```
`app` Dockerfile installs `app/requirements.txt` and copies `shared/`; `bot` Dockerfile installs system Chromium (`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`) to avoid the ~300MB puppeteer download.

There is no lint/typecheck config in this repo — don't invent one.

## Architecture

### Data flow
1. `bot/index.js` listens on the two WhatsApp group IDs configured in `.env` (`WHATSAPP_GROUP_ID_ALUNOS`, `WHATSAPP_GROUP_ID_PROFS`). On first run with those vars unset, it lists all available groups with their IDs and exits (`process.exit(0)`) so the user can map them.
2. Every accepted message is tagged with `group_label` (`'alunos'` or `'profs'`) and inserted via `bot/db.js` `insertMessage()` into the single `messages` table — **one feed, not two pipelines**. Non-text types (`image`, `video`, `audio`, `ptt`, `document`) are stored as a placeholder body like `[image]` with no OCR/transcription (out of scope for this MVP — see README "Fases futuras").
3. `app/scripts/daily_extraction.py` is invoked once/day by an external cron/systemd timer (see README's "Extração diária" section) — this is the only trigger for extraction now; there is no manual button and no in-process polling. It calls `app/lib/extraction.py:run_extraction()` in a loop until the queue drains.
4. `run_extraction()` pulls unprocessed messages in batches of 30, up to `max_batches=10` per call to `run_extraction()` (hard cost cap: 300 msgs per call; `daily_extraction.py` calls it in a loop until the queue is drained, so a busy day makes multiple calls, not one call processing everything). For each batch it builds a prompt via `app/lib/prompts.py`, calls the LLM, validates/dedups the result, and atomically inserts `activities` + marks the batch `processed=1` — even on invalid JSON or hallucinated `source_message_id` (the batch is still marked processed to avoid infinite reprocessing loops; only network/auth errors on the API call itself leave `processed=0` for retry).
5. UI reads back through `app/lib/db.py` (`fetch_activities`, `fetch_messages`) for the Painel and Mensagens pages.

### Why one feed with a `group_label` instead of two pipelines
The `profs` group (official announcements, explicit dates) is more authoritative than `alunos` (rumors, "does anyone know if there's a test today?", post-exam grade chat). Both are fed into the same extraction pass, but each prompt line is tagged `[id=N][group_label]` so the model can weigh conflicting info. This also means the same official notice reposted in both groups needs dedup — see below.

### LLM contract (`app/lib/prompts.py` + `app/lib/extraction.py`)
- Each message line in the prompt is `[id=<messages.id>][<group_label>] (<local timestamp>) <author>: <body>` — the model must echo back the literal `id` as `source_message_id`. `run_extraction()` discards (not aborts) any item whose `source_message_id` isn't in the current batch's id set.
- Relative dates ("hoje", "amanhã", "segunda que vem") must be resolved using the *message's own timestamp* (shown per-line), not the "current time" at the top of the prompt — this is called out explicitly in the system prompt because messages are processed well after being sent.
- Timestamps are stored as ISO-UTC in `messages.timestamp` and converted to `America/Sao_Paulo` only when building the prompt (`build_user_prompt` in `prompts.py`). Timezone is hardcoded, not configurable.
- Dedup happens in `extraction.py` via `normalize_title()` (lowercase + strip accents) + `check_duplicate_activity()` in `db.py`, keyed on `(type, normalized title, due_date)` against any non-`descartado` activity — plain equality, no fuzzy matching.
- `run_extraction()` returns token usage (`total_tokens_used`) and `messages_remaining` so the Painel page can show consumption and whether another click is needed to drain the backlog.

### Config (`.env` at repo root, read by both processes)
```
OPENCODE_API_KEY=
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_MODEL=deepseek-v4-flash
WHATSAPP_GROUP_ID_ALUNOS=
WHATSAPP_GROUP_ID_PROFS=
DB_PATH=./data/app.db
```
- Node (`bot/config.js`) resolves `DB_PATH` via `path.resolve(__dirname, '..', ...)`.
- Python (`app/lib/db.py`) resolves it via `Path(__file__).resolve().parents[2]` — both anchor to repo root, not `cwd`.
- Do not change `OPENCODE_MODEL` away from `deepseek-v4-flash` without checking OpenCode Zen Go pricing first — cost control is a deliberate design constraint (10-batch cap, no background polling, token usage surfaced in the UI).

### SQLite concurrency
No manual locking. Both `bot/db.js` (`better-sqlite3`, `{ timeout: 5000 }`) and `app/lib/db.py` (`sqlite3`, `PRAGMA busy_timeout=5000`) rely on WAL mode (set in `shared/schema.sql`) plus per-connection busy timeouts. Python opens a fresh connection per function call (not a cached singleton) because Streamlit runs callbacks on different threads.

### Schema (`shared/schema.sql`)
- `messages`: `wa_message_id` UNIQUE (dedup on insert — `insertMessage` swallows the UNIQUE constraint error), `group_label`, `processed` flag drives the extraction queue.
- `activities`: `type` CHECK in `(prova, trabalho, evento, atividade)`, `status` CHECK in `(pendente, concluido, descartado)`, `confidence` CHECK in `(alta, media, baixa)`, `source_message_id` FK back to `messages`.

### Out of scope for this MVP (see README "Fases futuras" for detail)
Media extraction (images/audio/PDF are placeholder-only), retroactive import of full chat history, class recording/transcription, calendar integration.
