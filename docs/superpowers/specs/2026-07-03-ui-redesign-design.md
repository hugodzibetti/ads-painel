# ADS Panel — Full Redesign & Automation Spec
**Date:** 2026-07-03  
**User:** Hugo (sole user — FASIPE ADS, Sinop MT)  
**North star:** The app does everything it can alone. It asks Hugo only when genuinely blocked.

---

## Core Principle

Zero effort for the student. The app extracts deadlines, monitors group discussions, prepares submissions, and delivers them — autonomously. Hugo reviews final submissions before they go out. That is the only required interaction. Everything else is automated.

---

## 1. What the App Does End-to-End

```
WhatsApp groups (alunos + profs)
  ↓ [bot listens, inserts messages]
Auto-extraction every 15min
  ↓ [LLM extracts activities + classifies graded/non-graded + detects delivery method]
Non-graded → ignored entirely
Graded → enters delivery pipeline
  ↓ [app monitors WhatsApp continuously for task discussion + professor hints]
T-3 days before deadline
  ↓ [LLM builds submission draft using all gathered context]
Hugo reviews draft → approves or adjusts
  ↓ [app delivers via detected method]
Auto-marked concluido
```

After deadline passes with no delivery: auto-marked concluido (time-based fallback for in-person tasks).

---

## 2. Automation Architecture

### 2.1 Auto-Extraction Scheduler
- `setInterval` in `server.ts` fires `runExtraction()` every 15 minutes on boot
- Configurable via `EXTRACTION_INTERVAL_MINUTES` env var (default: 15)
- After each run: fires briefing generator + delivery detector + context monitor
- No extraction button in the UI

### 2.2 Graded vs Non-Graded Classifier
LLM judgment run immediately after extraction, per new activity.

**Graded** (enters delivery pipeline): `prova`, `trabalho`, atividades with explicit grade references ("vale nota", "N1", "N2", "pontos"), lab reports, formulários that count toward grade.

**Non-graded / ignored** (delivery_stage = `ignored`): enquetes, preference polls ("tem notebook?"), event RSVPs, informational forms, class schedule confirmations. LLM must be precise — when uncertain, treat as graded and let Hugo decide.

Stored as `is_graded: boolean` on the activity.

### 2.3 Delivery Method Detector
LLM reads activity description + source messages to return:

| Method | Signal | Delivery mechanism |
|--------|--------|--------------------|
| `google_forms` | `forms.gle` URL | Playwright fills + submits |
| `google_docs` | `docs.google.com` URL or "enviar doc" | LLM generates content, Playwright submits |
| `whatsapp` | "enviar no grupo", "mandar no zap", "responder aqui" | WhatsApp bot sends to correct group |
| `in_person` | "presencial", "sala", "na aula", "imprimir" | Reminder only; auto-done after class time |
| `unknown` | No clear signal | `needs_method` → Hugo explains once |

When `unknown`: Dashboard flags the activity. Hugo types a plain-language explanation ("enviar o link do doc no grupo dos profs"). LLM parses → sets method + instructions. App saves pattern for reuse with same professor.

### 2.4 Context Monitor
Every extraction run also scans new messages for discussion of existing pending graded activities — professor clarifications, classmate questions and answers, deadline changes, hints about expected format. Appended to `delivery_context` on the activity. Richer context = better draft.

### 2.5 Briefing Generator (`src/server/briefing.ts`)
- Called after every extraction run
- Reads all pending activities + their delivery stages
- Produces a 2–3 sentence Portuguese paragraph: urgency, conflicts, pending reviews
- Stored in `briefings` table, served instantly by `GET /api/briefing`
- Includes delivery state: "Trabalho de LP pronto para revisão. Prova de ES amanhã."

### 2.6 Submission Drafter
Triggered at T-3 days before `due_date` for graded activities in `gathering` stage.

- Reads: activity description, source messages, all accumulated `delivery_context`
- Generates submission content appropriate to the method (form answers, doc content, WhatsApp message)
- Sets `delivery_stage = pending_review`
- Dashboard immediately shows "Revisão pendente" highlight

Hugo reviews, can:
- **Approve**: app delivers
- **Adjust**: Hugo edits the draft inline, then approves
- **Guide**: Hugo adds context ("a professora quer no formato ABNT") → LLM regenerates → review again

### 2.7 Delivery Dispatcher (`src/server/delivery.ts`)
On approval:
- `google_forms`: Playwright agent opens URL, LLM reads fields, fills answers, submits
- `google_docs`: Playwright opens doc, LLM writes content (or updates shared doc)
- `whatsapp`: Bot sends prepared message to detected group (`alunos` or `profs`)
- `in_person`: Marks as `done` (delivery = showing up; reminder already sent)

On failure: `delivery_stage = failed`, Dashboard flags it, Hugo notified.

### 2.8 Time-Based Auto-Completion
Scheduler daily check: if `due_date` < today and `delivery_stage` not in (`done`, `failed`, `ignored`):
- `in_person` activities → auto-mark `concluido` (happened or not, moment passed)
- Others → flag as overdue, do not auto-complete (something went wrong in pipeline)

---

## 3. Database Changes

### 3.1 New Columns on `activities`
```sql
ALTER TABLE activities ADD COLUMN is_graded INTEGER DEFAULT 1;
ALTER TABLE activities ADD COLUMN delivery_method TEXT; -- google_forms|google_docs|whatsapp|in_person|unknown
ALTER TABLE activities ADD COLUMN delivery_url TEXT;
ALTER TABLE activities ADD COLUMN delivery_instructions TEXT; -- user-provided or LLM-derived
ALTER TABLE activities ADD COLUMN delivery_context TEXT; -- JSON array of {message_id, author, body, timestamp}
ALTER TABLE activities ADD COLUMN delivery_draft TEXT; -- LLM-generated submission content
ALTER TABLE activities ADD COLUMN delivery_stage TEXT DEFAULT 'detecting';
-- detecting|ignored|needs_method|gathering|pending_review|delivering|done|failed
```

### 3.2 New `briefings` Table
```sql
CREATE TABLE IF NOT EXISTS briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activities_count INTEGER DEFAULT 0
);
```

### 3.3 Urgency Fields (computed, not stored)
Added in `fetchActivities` TypeScript post-processing:
- `days_until_due`: integer from SQLite `ROUND(julianday(due_date) - julianday('now', 'localtime'))`
- `urgency_label`: `VENCIDO` (<0), `HOJE` (0), `AMANHÃ` (1), day-of-week abbrev (2–7), `DD/MM` (>7)
- `urgency_color`: `danger` (≤0), `warning` (1), `info` (2–7), `neutral` (>7)

### 3.4 `deadline_density` in Stats
Array of 7 integers (Mon–Sun of current week), count of pending graded activities per day. Added to `GET /api/stats` response.

---

## 4. API Changes

| Method | Path | Change |
|--------|------|--------|
| GET | `/api/briefing` | New — latest briefing + `minutes_ago` |
| GET | `/api/activities` | Add `urgency` filter (`urgent`/`future`), add urgency + delivery fields to response |
| GET | `/api/stats` | Add `deadline_density: number[]` (7 days) |
| PATCH | `/api/activities/:id/delivery` | New — update delivery_method, delivery_instructions, approve/reject draft |
| POST | `/api/activities/:id/deliver` | New — trigger delivery for approved activity |

---

## 5. Dashboard — Full Redesign

### 5.1 What's Removed
- KPI card row
- Full activities table with filters/search
- Extraction trigger button
- Edit status modal (replaced by inline actions)

### 5.2 Layout
```
[Header — Stack row, space-between]
  "ADS Panel" (large-heavy)          "auto • última: 3min atrás" (small)

[Briefing]
  Callout("info", "Resumo do dia", briefingQ.content)

[Deadline Density]
  BarChart — pending graded activities per day this week (Mon–Sun)
  Single series. Shows "quinta está pesada" at a glance.

[Revisão Pendente — only if any]
  Callout("warning", "Revisão necessária", "N atividade(s) prontas para entrega")
  → tap to expand inline draft review per activity

[Esta Semana — Card("card")]
  Table:
    Col Prazo       → Tag(urgency_label, urgency_color)
    Col Atividade   → title
    Col Entrega     → Tag(delivery_stage, stage_color)
    Col Ações       → Button("Feito") + Button("Ignorar")
  Empty state: TextContent("Nenhuma atividade urgente.")

[Mais Adiante — Card("sunk")]
  Accordion: DD/MM — Título, body = description + delivery stage tag
```

### 5.3 Delivery Stage Colors
| Stage | Label | Color |
|-------|-------|-------|
| `ignored` | não se aplica | neutral |
| `detecting` | detectando | neutral |
| `needs_method` | como entregar? | warning |
| `gathering` | coletando info | info |
| `pending_review` | revisar agora | danger |
| `delivering` | entregando | info |
| `done` | entregue | success |
| `failed` | falhou | danger |

### 5.4 Draft Review Modal
When `delivery_stage = pending_review`, clicking the activity opens a Modal containing:
- Draft content (TextArea, editable)
- Delivery method + URL (TextContent)
- Context gathered from WhatsApp (Accordion, collapsed by default)
- Buttons: "Aprovar e Entregar" / "Regenerar" / "Dar contexto"
- "Dar contexto" reveals a second TextArea: Hugo types guidance → API call → LLM regenerates draft → modal refreshes

---

## 6. Status Page — Dynamic Complexity

Gains Tabs structure. Simple by default, debug on demand.

### Tab 1: Visão Geral (current content, unchanged)
Stats cards, auto-refresh every 30s.

### Tab 2: Extrações
Accordion of extraction runs (most recent first):
- Header: timestamp + messages processed + activities found + tokens used
- Body: list of activity titles extracted in that run, briefing snippet

### Tab 3: Atividades
Full debug table — ALL activities regardless of status, all columns including delivery fields.
Filters: status, type, delivery_stage, is_graded.
This is where the old Dashboard table lives for debugging.

---

## 7. Messages Page — Polish Only

1. Wrap root in `Card("card")` for consistent header
2. Show `Tag("N atividade(s)", null, "sm", "info")` per message when `activity_count > 0`
3. Remove `ID: N (WA: false_55...)` noise from footer

---

## 8. Files to Create/Modify

| File | Action |
|------|--------|
| `shared/schema.sql` | Add `briefings` table; add delivery columns to `activities` |
| `src/server/briefing.ts` | New — briefing generator |
| `src/server/deliveryDetector.ts` | New — graded classifier + method detector (LLM) |
| `src/server/contextMonitor.ts` | New — scans new messages for activity context |
| `src/server/drafter.ts` | New — submission draft generator (LLM), triggered at T-3 |
| `src/server/delivery.ts` | New — dispatcher (Playwright / WhatsApp bot / in-person) |
| `src/server/db.ts` | Add briefing functions; update `fetchActivities` with urgency + delivery fields; add delivery update functions |
| `src/server/server.ts` | Add scheduler; new endpoints (`/api/briefing`, `/api/activities/:id/delivery`, `/api/activities/:id/deliver`); update `/api/stats` |
| `src/server/extraction.ts` | Call briefing + delivery detector + context monitor after each run |
| `src/bot/index.ts` | Add send capability for WhatsApp delivery method |
| `src/frontend/toolProvider.ts` | Add `get_briefing`; update `get_activities`; add delivery mutation tools |
| `src/frontend/pages/Dashboard.tsx` | Full rewrite |
| `src/frontend/pages/Messages.tsx` | Minor polish |
| `src/frontend/pages/Status.tsx` | Add Tabs with Extrações + Atividades debug tabs |

---

## 9. Out of Scope (Future)
- Push/browser notifications for new extractions
- Smart date re-evaluation for stale relative dates ("semana que vem" in old messages)
- Multi-user support
