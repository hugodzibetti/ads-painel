# UI Redesign + Automation — Design Spec
**Date:** 2026-07-03  
**Goal:** Zero-effort academic tracking. Remove every click, filter, and interpretation burden from the student.

---

## Core Principle

The app must surface what matters without being asked. The student opens it and immediately knows what they need to do and when. No buttons to trigger extraction, no filters to apply, no raw data to interpret.

---

## 1. Automation Architecture

### 1.1 Auto-Extraction Scheduler
- `server.ts` starts a `setInterval` on boot that calls `runExtraction()` every 15 minutes
- Configurable via `EXTRACTION_INTERVAL_MINUTES` env var (default: 15)
- No "Atualizar" button anywhere in the UI

### 1.2 Briefing Generator (`src/server/briefing.ts`)
- Called automatically after every extraction run (regardless of whether new activities were found — dates shift, so urgency changes daily)
- Fetches all `pendente` activities, builds a compact prompt in Portuguese
- Calls the LLM (same OpenCode endpoint + model as extraction)
- Output: 2–3 sentence paragraph summarizing urgency and conflicts (e.g., "Prova de Cálculo II amanhã. Conflito: Trabalho de LP e Prova de ES ambos na quinta.")
- Target: ~100–150 completion tokens (cheap, fast)
- Result stored in new `briefings` DB table

### 1.3 New `briefings` Table (schema.sql)
```sql
CREATE TABLE IF NOT EXISTS briefings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activities_count INTEGER DEFAULT 0
);
```

### 1.4 Urgency Fields on Activities
`fetchActivities` adds two computed fields via SQLite:
- `days_until_due`: `ROUND(julianday(due_date) - julianday('now', 'localtime'))`
- `urgency_label`: mapped server-side — `VENCIDO` (<0), `HOJE` (0), `AMANHÃ` (1), day-of-week abbrev `SEG/TER/QUA/QUI/SEX/SÁB/DOM` (2–7), `DD/MM` (>7)
- `urgency_color`: `danger` (overdue/hoje), `warning` (amanhã), `info` (esta semana), `neutral` (futuro)

Mapping done in TypeScript after SQLite query (not in SQL) for clarity.

### 1.5 New/Modified API Endpoints
| Method | Path | Change |
|--------|------|--------|
| GET | `/api/briefing` | New — returns latest briefing row + computed `minutes_ago` |
| GET | `/api/activities` | Add `urgency` filter param: `urgent` (≤7 days or overdue) / `future` (>7 days) |
| GET | `/api/stats` | Add `deadline_density: number[]` — 7-element array (Mon–Sun of current week), count of pending activities per day, used by the Dashboard bar chart |

### 1.6 New toolProvider Entries
```ts
get_briefing: async () => getJson('/api/briefing')
// get_activities updated to pass urgency + limit from Query args
```

---

## 2. Dashboard — Full Redesign

### 2.1 What's Removed
- KPI card row (duplicated Status page)
- Full activities table with filters/search
- "Atualizar" extraction button
- Edit status modal (replaced by inline "Feito" button)

### 2.2 Layout

```
[Header]
  "ADS Panel"  (large-heavy, left)
  "auto • última: 3min atrás"  (small, right)

[Briefing]
  Callout("info", "Resumo do dia", briefingQ.content)

[Deadline Density Chart]  ← new
  BarChart: deadlines per day this week (Mon–Sun)
  Shows at a glance which days are heavy

[Esta Semana]  Card("card")
  Table:
    Col Prazo      → Tag(urgency_label, urgency_color)
    Col Atividade  → title text
    Col Tipo       → Tag(type, color)
    Col (action)   → Button("Feito", marks concluido inline) + Button("Ignorar", marks descartado inline)

[Mais Adiante]  Card("sunk")
  Accordion: one item per future activity
    Title: "DD/MM — Título"
    Body: description + type tag + confidence tag
```

### 2.3 Behavior
- `upcoming` query: `status=pendente`, `urgency=urgent`, `limit=10`
- `future` query: `status=pendente`, `urgency=future`, `limit=8`
- "Feito" button: sets `concluido`, re-queries upcoming + future — single tap, no modal
- "Ignorar" button: sets `descartado`, re-queries upcoming + future — replaces the old modal for descartado workflow
- Both use `$editId` + `$editStatus` variables + `updateResult` mutation
- Empty state for Esta Semana: `TextContent("Nenhuma atividade urgente.")` — a win, not a bug
- Briefing empty state: `"Aguardando primeira extração..."` on first launch
- No emojis — use icons from the UI library wherever decorative elements are needed

### 2.4 Deadline Density Chart
- Data: count of pending activities per weekday (Mon–Sun of current week)
- Single `Series("Atividades", [n, n, n, n, n, n, n])`
- `BarChart` variant, compact height
- Purpose: instant visual of "Thursday is brutal" without reading the table

---

## 3. Messages Page — Polish Only

### 3.1 Changes
1. **Consistent header**: wrap root in `Card("card", "column")` matching Dashboard shell
2. **Activity count badge**: show `Tag("N atividade(s)", null, "sm", "info")` per message when `activity_count > 0`
3. **Remove WA ID noise**: drop `ID: N (WA: false_55...)` from message footer — internal detail irrelevant to student

### 3.2 Unchanged
- Search box (server-side search stays)
- Group label tag (profs/alunos distinction is useful)
- Processed/unprocessed tag
- Timestamp and author display

---

## 4. Status Page

No changes. Works well as a system health monitor.

---

## 5. Files to Create/Modify

| File | Action |
|------|--------|
| `shared/schema.sql` | Add `briefings` table |
| `src/server/briefing.ts` | New — briefing generator |
| `src/server/db.ts` | Add `insertBriefing`, `fetchLatestBriefing`, update `fetchActivities` with urgency fields + filter |
| `src/server/server.ts` | Add scheduler, `GET /api/briefing`, update `GET /api/activities`, add `deadline_density` to `GET /api/stats` |
| `src/server/extraction.ts` | Call `generateBriefing()` after each run |
| `src/frontend/toolProvider.ts` | Add `get_briefing`, update `get_activities` args |
| `src/frontend/pages/Dashboard.tsx` | Full rewrite |
| `src/frontend/pages/Messages.tsx` | Minor polish |

---

## 6. Out of Scope (Future)
- Automated task delivery (submitting assignments) — explicitly flagged for a future session
- Push/browser notifications for new extractions
- Auto-dismiss low-confidence items via LLM
- Smart date re-evaluation for stale relative dates
