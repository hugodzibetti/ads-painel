# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MVP that captures messages from two WhatsApp groups (ADS student class), extracts academic deadlines via LLM, and displays them in an OpenUI web dashboard. Unified Node.js/TypeScript codebase:

- **`src/bot/index.ts`**: WhatsApp listener via `whatsapp-web.js`, writes raw messages to SQLite
- **`src/server/`**: Express API server (extraction, database, stats endpoints)
- **`src/frontend/`**: Vanilla OpenUI web interface (Dashboard, Messages, Status pages)
- **`shared/schema.sql`**: SQLite schema (messages, activities tables)

## Commands

### Development
```bash
npm install
npm run dev              # Runs server + frontend together (server :3000, frontend :5173)
npm run dev:server      # Express server only (port 3000)
npm run dev:frontend    # Vite frontend only (port 5173, proxies /api to server)
npm run bot             # Run WhatsApp bot (prints QR code on first login)
npm run type-check      # TypeScript type checking
```

### Production
```bash
npm run build           # Build server and frontend
npm start               # Run production server (port 3000)
```

### Docker
```bash
docker compose up --build    # Runs unified app + bot + SQLite
```
Exposes port 3000 with full frontend + backend. Uses Node.js 20 Alpine image.

No lint/typecheck config — don't invent one.

## Architecture

### Data flow
1. `src/bot/index.ts` listens on WhatsApp group IDs from `.env` (`WHATSAPP_GROUP_ID_ALUNOS`, `WHATSAPP_GROUP_ID_PROFS`). First run with unset IDs lists available groups and exits so user can configure them.
2. Messages are tagged with `group_label` (`'alunos'` or `'profs'`) and inserted via `src/server/db.ts:insertMessage()` into SQLite `messages` table. Non-text types (`image`, `video`, etc.) stored as `[type]` placeholder with no transcription (out of scope).
3. Dashboard "Atualizar" button triggers `POST /api/extract` → `src/server/extraction.ts:runExtraction()` on-demand (no background polling).
4. `runExtraction()` pulls unprocessed messages in batches of 30, max 10 batches/call (300 msg cap per click). For each batch: builds prompt via `src/server/prompts.ts`, calls OpenCode LLM, validates/dedups results, atomically inserts `activities` + marks batch `processed=1`. Invalid JSON or missing `source_message_id` still marks batch processed to avoid reprocessing loops.
5. Frontend fetches activities via `GET /api/activities`, messages via `GET /api/messages`, stats via `GET /api/stats`. All pages use vanilla OpenUI components.

### Why one feed with a `group_label` instead of two pipelines
`profs` group (official announcements) is more authoritative than `alunos` (rumors). Both feed the same extraction pass, each line tagged `[id=N][group_label]` so LLM can weigh conflicts. Dedups reposts across groups.

### LLM contract (`src/server/prompts.ts` + `src/server/extraction.ts`)
- Each prompt line: `[id=<messages.id>][<group_label>] (<local timestamp>) <author>: <body>` — LLM echoes literal `id` as `source_message_id`.
- Relative dates ("hoje", "amanhã", "segunda que vem") resolved using message's own timestamp (not current time) — hardcoded in system prompt since processing is delayed.
- Timestamps stored ISO-UTC in DB, converted to `America/Sao_Paulo` only when building prompt. Timezone not configurable.
- Dedup via `normalize_title()` (lowercase + strip accents) + `check_duplicate_activity()` keyed on `(type, normalized title, due_date)` vs non-`descartado` activities — exact match only.
- Returns token usage and messages remaining for Dashboard to display.

### Config (`.env` at repo root)
```
OPENCODE_API_KEY=
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_MODEL=deepseek-v4-flash
WHATSAPP_GROUP_ID_ALUNOS=
WHATSAPP_GROUP_ID_PROFS=
DB_PATH=./data/app.db
PORT=3000
NODE_ENV=development
```
`src/server/db.ts` and `src/bot/index.ts` resolve `DB_PATH` via `path.resolve()` to repo root. **Never change `OPENCODE_MODEL` without checking pricing** — cost control is deliberate (10-batch cap, no polling, usage surfaced in UI).

### SQLite concurrency
No manual locking. `src/server/db.ts` uses `better-sqlite3` with `timeout: 5000` and WAL mode (set in `shared/schema.sql`). Bot and server share same SQLite file with busy timeouts.

### Schema (`shared/schema.sql`)
- `messages`: `wa_message_id` UNIQUE (INSERT-or-ignore on dupes), `group_label`, `processed` flag
- `activities`: `type` CHECK `(prova, trabalho, evento, atividade)`, `status` CHECK `(pendente, concluido, descartado)`, `confidence` CHECK `(alta, media, baixa)`, `source_message_id` FK to messages

### Out of scope (see README "Fases futuras")
Media extraction (images/audio/PDF placeholder-only), retroactive history import, transcription, calendar integration
