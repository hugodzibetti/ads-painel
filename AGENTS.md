# ads-painel — Agent Instructions

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill .env (OPENCODE_API_KEY required)
cp .env.example .env

# Run full dev stack (Express :3000 + Vite :5173)
npm run dev

# Run WhatsApp bot standalone (prints QR code on first login)
npm run bot
```

Docker alternative: `docker compose up --build` (exposes :3000, prebuilt production image).

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server + frontend concurrently |
| `npm run dev:server` | Express API server only (port 3000) |
| `npm run dev:frontend` | Vite dev server only (port 5173, proxies `/api` to :3000) |
| `npm run bot` | WhatsApp listener (tsx src/bot/index.ts) |
| `npm run build` | Build server (tsc) + frontend (vite build) |
| `npm run start` | Production server (node dist/server/server.js) |
| `npm run type-check` | TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run all tests (`vitest run`) |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Test coverage report |
| `docker compose up --build` | Production Docker deployment |

## Verification

| Check | Command | Status |
|-------|---------|--------|
| Type check | `npm run type-check` | Present |
| Tests | `npm run test` | Present (6 test files, vitest) |
| Lint | — | **Missing** — no ESLint/Prettier config (intentional per CLAUDE.md) |
| Build | `npm run build` | Present |

## Key Architecture

```
ads-painel/
├── src/
│   ├── bot/index.ts            # WhatsApp listener (whatsapp-web.js) → SQLite
│   ├── server/
│   │   ├── server.ts           # Express API (port 3000)
│   │   ├── db.ts               # SQLite access (better-sqlite3, WAL mode)
│   │   ├── extraction.ts       # LLM extraction pipeline (batches of 30, max 10)
│   │   ├── prompts.ts          # LLM prompt templates
│   │   ├── briefing.ts         # Activity briefing logic
│   │   ├── delivery.ts         # Delivery tracking
│   │   ├── drafter.ts          # Activity drafting
│   │   ├── knowledge.ts        # Knowledge base
│   │   ├── llm.ts              # LLM client wrapper
│   │   ├── contextMonitor.ts   # Context monitoring
│   │   └── *.test.ts           # Tests
│   └── frontend/
│       ├── main.tsx            # React entry (OpenUI `<Renderer>`)
│       ├── pages/              # Dashboard, Messages, Status pages
│       ├── toolProvider.ts     # Maps OpenUI Lang tools → Express API calls
│       └── library.ts          # Shared frontend utilities
├── shared/schema.sql           # SQLite schema (messages, activities)
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Data flow
1. **Bot** listens on two WhatsApp groups (`WHATSAPP_GROUP_ID_ALUNOS`, `WHATSAPP_GROUP_ID_PROFS`), stores raw messages in SQLite with `group_label`.
2. **Extraction** triggered by Dashboard button (`POST /api/extract`) — pulls unprocessed messages in batches of 30 (max 300/call), sends to LLM, deduplicates, stores activities.
3. **Frontend** uses OpenUI Lang DSL — `<Renderer>` executes `Query`/`Mutation` statements against `toolProvider.ts`, which calls the Express API. No LLM involved in page rendering.

### LLM contract
- Model: `deepseek-v4-flash` (OpenCode Zen Go API). **Do not change without checking pricing.**
- Prompt lines: `[id=N][group_label] (local timestamp) author: body`
- Relative dates resolved using message timestamp, not current time.
- Timezone: `America/Sao_Paulo` (hardcoded, not configurable).
- Dedup keyed on `(type, normalized title, due_date)`.

### Database
- SQLite with WAL mode + `busy_timeout: 5000`.
- `messages` table: `wa_message_id` UNIQUE, `group_label`, `processed` flag.
- `activities` table: `type` (prova/trabalho/evento/atividade), `status` (pendente/concluido/descartado), `confidence` (alta/media/baixa).

## Pitfalls

- **No linter** — this is intentional. CLAUDE.md says "No lint/typecheck config — don't invent one." Only `npm run type-check` and `npm run test` exist.
- **WhatsApp is unofficial** — `whatsapp-web.js` uses browser automation (Chromium). Account may get flagged by Meta.
- **Cost control** — extraction capped at 10 batches × 30 messages per click. No background polling. Uses cheap model by design.
- **Non-text media** — images/video/audio stored as `[type]` placeholder only. No transcription in the live pipeline (out of scope for MVP).
- **Timezone hardcoded** — `America/Sao_Paulo` in prompts. Not configurable via env.
- **Python legacy** — README still references Python/Streamlit setup, but the codebase is now fully Node.js/TypeScript. Ignore the Python instructions in README; follow CLAUDE.md and this file.
- **Build output** — `tsc` outputs to `dist/`, Vite outputs to `dist/public/`. Both in `.gitignore`.
- **.env is gitignored** — also `.secret.env`. Never commit secrets.
- **Git worktrees** — `.worktrees/` in `.gitignore`. Remote branches follow `batch/*` and `worktree-*` naming conventions.
