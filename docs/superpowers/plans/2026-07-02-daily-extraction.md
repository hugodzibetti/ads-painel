# Extração Diária Automática Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual "Atualizar" button in the Painel page with a fully automatic daily extraction pipeline invoked by an external scheduler (cron/systemd), and feed the LLM prompt with the set of already-known activities so it reasons better about continuations/variations of existing items.

**Architecture:** Reuse the existing `run_extraction()` pipeline unchanged in its external contract (same batch cap, same error semantics). Add a new `fetch_active_activities()` DB helper, thread it through `build_user_prompt()` as an optional parameter, wire it into `run_extraction()`, add a thin `app/scripts/daily_extraction.py` CLI entrypoint (same drain-loop pattern as `app/scripts/import_export.py`), and strip the manual trigger UI from `app/pages/1_Painel.py` in favor of a read-only "last run" caption sourced from the existing `llm_usage` table.

**Tech Stack:** Python 3, Streamlit, sqlite3, pytest, pytz. No new dependencies.

## Global Constraints

- Never call the real OpenCode/OpenAI API in any test — always mock the client (per CLAUDE.md and existing test patterns in this repo).
- Do not change the 10-batch cap or the 30-message batch size in `run_extraction()` (CLAUDE.md: cost control is a deliberate design constraint).
- Do not change `OPENCODE_MODEL` away from `deepseek-v4-flash`.
- Do not add a new DB table or schema migration for "last run" tracking — `llm_usage.timestamp` (via `fetch_usage_summary()['last_run_at']`) already answers that.
- Do not version cron/systemd unit files in the repo — document them as copy/adapt snippets in README only (host-specific paths).
- Follow existing test conventions: pytest with temp SQLite file per test (`tempfile.mkstemp`), `unittest.mock.patch`/`MagicMock` for the OpenAI client, no new test framework.

---

### Task 1: `fetch_active_activities` DB helper

**Files:**
- Modify: `app/lib/db.py` (add function after `check_duplicate_activity`, around line 170)
- Test: `app/tests/test_db.py`

**Interfaces:**
- Produces: `fetch_active_activities(limit=200) -> list[dict]`, each dict has keys `type`, `title`, `due_date`, `status`. Excludes `status='descartado'`. Ordered by `due_date ASC`.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/test_db.py`, in the import block at the top, add `fetch_active_activities` to the `from lib.db import (...)` list. Then add these two tests (anywhere after `test_check_duplicate_activity_ignores_accents`):

```python
def test_fetch_active_activities_excludes_descartado_and_orders_by_due_date():
    """fetch_active_activities must skip descartado and order pendente+concluido by due_date."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    insert_activities([
        {'type': 'prova', 'title': 'Prova B', 'due_date': '2026-07-20', 'source_message_id': msg_id, 'status': 'pendente'},
        {'type': 'trabalho', 'title': 'Trabalho A', 'due_date': '2026-07-05', 'source_message_id': msg_id, 'status': 'concluido'},
        {'type': 'evento', 'title': 'Evento Descartado', 'due_date': '2026-07-01', 'source_message_id': msg_id, 'status': 'descartado'},
    ])

    active = fetch_active_activities()

    assert [a['title'] for a in active] == ['Trabalho A', 'Prova B']
    assert all(a['status'] != 'descartado' for a in active)
    assert active[0]['type'] == 'trabalho'
    assert active[0]['due_date'] == '2026-07-05'

    os.unlink(db_path)


def test_fetch_active_activities_respects_limit():
    """fetch_active_activities must cap results at the given limit."""
    db_path = create_test_db()
    init_test_schema(db_path)

    os.environ['DB_PATH'] = db_path

    conn = sqlite3.connect(db_path)
    msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg1', 'alunos', 'João', 'test', datetime.now(timezone.utc).isoformat(), 0)
    ).fetchone()[0]
    conn.commit()
    conn.close()

    insert_activities([
        {'type': 'prova', 'title': 'Prova 1', 'due_date': '2026-07-01', 'source_message_id': msg_id},
        {'type': 'prova', 'title': 'Prova 2', 'due_date': '2026-07-02', 'source_message_id': msg_id},
        {'type': 'prova', 'title': 'Prova 3', 'due_date': '2026-07-03', 'source_message_id': msg_id},
    ])

    active = fetch_active_activities(limit=2)

    assert len(active) == 2
    assert [a['title'] for a in active] == ['Prova 1', 'Prova 2']

    os.unlink(db_path)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_db.py -k fetch_active_activities -v`
Expected: FAIL with `ImportError: cannot import name 'fetch_active_activities'`

- [ ] **Step 3: Implement `fetch_active_activities`**

In `app/lib/db.py`, add this function right after `check_duplicate_activity` (after the line `return any(normalize_title(row['title']) == title_normalized for row in rows)` / before `def fetch_messages`):

```python
def fetch_active_activities(limit=200):
    """Fetch pendente + concluido activities (never descartado) as LLM prompt context, ordered by due_date."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            SELECT type, title, due_date, status FROM activities
            WHERE status IN ('pendente', 'concluido')
            ORDER BY due_date ASC
            LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_db.py -v`
Expected: all tests PASS (existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add app/lib/db.py app/tests/test_db.py
git commit -m "feat: add fetch_active_activities DB helper for daily extraction context"
```

---

### Task 2: `build_user_prompt` accepts existing activities as context

**Files:**
- Modify: `app/lib/prompts.py:57-105` (`build_user_prompt`)
- Test: `app/tests/test_prompts.py`

**Interfaces:**
- Consumes: nothing new from other tasks (works with plain dicts shaped like `fetch_active_activities()`'s return — `type`, `title`, `due_date`, `status` keys).
- Produces: `build_user_prompt(messages, existing_activities=None) -> str`. Backward compatible: omitting `existing_activities` (or passing `None`/`[]`) produces byte-identical output to the current one-argument signature.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/test_prompts.py` (after `test_build_user_prompt_date_context`):

```python
def test_build_user_prompt_includes_existing_activities_block():
    """When existing_activities is given, a labeled context block must appear before the messages."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Prova de redes semana que vem',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]
    existing_activities = [
        {'type': 'prova', 'title': 'Prova de Redes', 'due_date': '2026-07-10', 'status': 'pendente'},
        {'type': 'trabalho', 'title': 'Trabalho de BD', 'due_date': '2026-07-05', 'status': 'concluido'},
    ]

    prompt = build_user_prompt(messages, existing_activities=existing_activities)

    assert 'Atividades já conhecidas' in prompt
    assert '[prova] Prova de Redes — 2026-07-10 (pendente)' in prompt
    assert '[trabalho] Trabalho de BD — 2026-07-05 (concluido)' in prompt
    # the context block must come before the messages section
    assert prompt.index('Atividades já conhecidas') < prompt.index('[id=1]')


def test_build_user_prompt_omits_existing_activities_block_when_empty_or_none():
    """No existing_activities arg, or an empty list, must produce identical output — no regression."""
    messages = [
        {
            'id': 1,
            'group_label': 'alunos',
            'author': 'João',
            'body': 'Prova de redes',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    ]

    prompt_default = build_user_prompt(messages)
    prompt_none = build_user_prompt(messages, existing_activities=None)
    prompt_empty = build_user_prompt(messages, existing_activities=[])

    assert 'Atividades já conhecidas' not in prompt_default
    assert prompt_default == prompt_none == prompt_empty
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_prompts.py -k existing_activities -v`
Expected: FAIL with `TypeError: build_user_prompt() got an unexpected keyword argument 'existing_activities'`

- [ ] **Step 3: Implement the parameter**

In `app/lib/prompts.py`, replace the `build_user_prompt` function (lines 57-105) with:

```python
def build_user_prompt(messages, existing_activities=None):
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

    prompt = f"Data/hora atual: {date_str} ({day_name_pt}), {time_str}, America/Sao_Paulo.\n\n"

    if existing_activities:
        prompt += (
            "Atividades já conhecidas (não recrie itens que já existem aqui — ajuste ou "
            "ignore; use isto para julgar continuações e variações de uma mesma atividade):\n"
        )
        for act in existing_activities:
            prompt += f"- [{act['type']}] {act['title']} — {act['due_date']} ({act['status']})\n"
        prompt += "\n"

    prompt += "Analise as seguintes mensagens e extraia atividades acadêmicas:\n\n"

    for msg in messages:
        try:
            msg_ts = datetime.fromisoformat(msg.get('timestamp'))
            msg_ts_local = msg_ts.replace(tzinfo=timezone.utc).astimezone(tz)
            msg_dt_str = msg_ts_local.strftime('%Y-%m-%d %H:%M')
        except (ValueError, TypeError):
            logger.warning(f"Invalid timestamp for message id={msg.get('id')}: {msg.get('timestamp')!r}")
            msg_dt_str = f"{msg.get('timestamp')} (timestamp inválido)"
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_prompts.py -v`
Expected: all tests PASS (existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add app/lib/prompts.py app/tests/test_prompts.py
git commit -m "feat: let build_user_prompt include known activities as context"
```

---

### Task 3: Wire `fetch_active_activities` into `run_extraction`

**Files:**
- Modify: `app/lib/extraction.py:7-14` (imports) and `:81-89` (batch loop)
- Test: `app/tests/test_extraction_integration.py`

**Interfaces:**
- Consumes: `fetch_active_activities()` from Task 1 (`app/lib/db.py`), `build_user_prompt(messages, existing_activities=...)` from Task 2 (`app/lib/prompts.py`).
- Produces: no change to `run_extraction()`'s public signature or return dict — behavior-only change (the prompt sent to the LLM now includes known activities).

- [ ] **Step 1: Write the failing test**

Add to `app/tests/test_extraction_integration.py` (after `test_run_extraction_success`):

```python
@patch('lib.extraction.OpenAI')
def test_run_extraction_includes_existing_activities_in_prompt(mock_openai_cls):
    db_path = create_test_db()
    init_test_schema(db_path)
    setup_env(db_path)

    msg_id = insert_message(db_path, 'msg1', 'Prova de Redes N2 semana que vem')

    conn = sqlite3.connect(db_path)
    known_msg_id = conn.execute(
        "INSERT INTO messages (wa_message_id, group_label, author, body, timestamp, processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        ('msg0', 'profs', 'Prof', 'Prova de Redes dia 10/07', datetime.now(timezone.utc).isoformat(), 1)
    ).fetchone()[0]
    conn.execute(
        "INSERT INTO activities (type, title, due_date, source_message_id, status) VALUES (?, ?, ?, ?, ?)",
        ('prova', 'Prova de Redes', '2026-07-10', known_msg_id, 'pendente')
    )
    conn.commit()
    conn.close()

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = make_llm_response(json.dumps({"items": []}))
    mock_openai_cls.return_value = mock_client

    run_extraction(max_batches=1)

    sent_prompt = mock_client.chat.completions.create.call_args.kwargs['messages'][1]['content']
    assert 'Atividades já conhecidas' in sent_prompt
    assert '[prova] Prova de Redes — 2026-07-10 (pendente)' in sent_prompt
    assert is_processed(db_path, msg_id) == 1

    os.unlink(db_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_extraction_integration.py -k existing_activities -v`
Expected: FAIL — assertion `'Atividades já conhecidas' in sent_prompt` fails (the block isn't in the prompt yet)

- [ ] **Step 3: Wire it in**

In `app/lib/extraction.py`, change the import block (lines 7-14) from:

```python
from lib.db import (
    fetch_unprocessed_messages,
    fetch_unprocessed_count,
    mark_processed,
    insert_activities,
    check_duplicate_activity,
    insert_llm_usage,
)
```

to:

```python
from lib.db import (
    fetch_unprocessed_messages,
    fetch_unprocessed_count,
    fetch_active_activities,
    mark_processed,
    insert_activities,
    check_duplicate_activity,
    insert_llm_usage,
)
```

Then in the batch loop, change:

```python
        try:
            user_prompt = build_user_prompt(messages)
```

to:

```python
        try:
            existing_activities = fetch_active_activities()
            user_prompt = build_user_prompt(messages, existing_activities=existing_activities)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_extraction_integration.py tests/test_extraction.py -v`
Expected: all tests PASS (existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add app/lib/extraction.py app/tests/test_extraction_integration.py
git commit -m "feat: pass known activities as LLM prompt context during extraction"
```

---

### Task 4: `daily_extraction.py` CLI entrypoint

**Files:**
- Create: `app/scripts/daily_extraction.py`
- Test: `app/tests/test_daily_extraction.py` (new file)

**Interfaces:**
- Consumes: `run_extraction(max_batches=10)` from `app/lib/extraction.py` (unchanged signature/return dict).
- Produces: `main()` — drains the extraction queue for one invocation (loops until `messages_remaining == 0` or a batch processes 0 messages), printing a one-line summary per batch to stdout. Meant to be invoked as `python -m scripts.daily_extraction` by an external scheduler.

- [ ] **Step 1: Write the failing test**

Create `app/tests/test_daily_extraction.py`:

```python
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.daily_extraction import main


@patch('scripts.daily_extraction.run_extraction')
def test_main_loops_until_queue_drained(mock_run_extraction):
    """main() must keep calling run_extraction(max_batches=10) until messages_remaining hits 0."""
    mock_run_extraction.side_effect = [
        {'total_tokens_used': 100, 'activities_extracted': 2, 'messages_processed': 30, 'messages_remaining': 15, 'errors': []},
        {'total_tokens_used': 50, 'activities_extracted': 1, 'messages_processed': 15, 'messages_remaining': 0, 'errors': []},
    ]

    main()

    assert mock_run_extraction.call_count == 2
    mock_run_extraction.assert_called_with(max_batches=10)


@patch('scripts.daily_extraction.run_extraction')
def test_main_stops_when_a_batch_processes_nothing(mock_run_extraction):
    """A batch that processes 0 messages (e.g. missing API key) must stop the loop, not spin forever."""
    mock_run_extraction.return_value = {
        'total_tokens_used': 0, 'activities_extracted': 0, 'messages_processed': 0,
        'messages_remaining': 5, 'errors': ['OPENCODE_API_KEY is not set'],
    }

    main()

    assert mock_run_extraction.call_count == 1


if __name__ == '__main__':
    test_main_loops_until_queue_drained()
    print("✓ test_main_loops_until_queue_drained")

    test_main_stops_when_a_batch_processes_nothing()
    print("✓ test_main_stops_when_a_batch_processes_nothing")

    print("\nAll tests passed!")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_daily_extraction.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.daily_extraction'`

- [ ] **Step 3: Implement the script**

Create `app/scripts/daily_extraction.py`:

```python
from lib.extraction import run_extraction


def main():
    """Drain the extraction queue for one invocation. Meant to be run once/day by an external scheduler (cron/systemd) — see README's "Extração diária" section."""
    while True:
        summary = run_extraction(max_batches=10)
        print(
            f"lote: {summary['messages_processed']} processadas, "
            f"{summary['activities_extracted']} atividades, "
            f"{summary['total_tokens_used']} tokens, "
            f"{summary['messages_remaining']} restantes"
        )
        if summary['errors']:
            print(f"erros: {summary['errors']}")
        if summary['messages_remaining'] == 0 or summary['messages_processed'] == 0:
            break


if __name__ == '__main__':
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && source venv/bin/activate && python -m pytest tests/test_daily_extraction.py -v`
Expected: both tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/scripts/daily_extraction.py app/tests/test_daily_extraction.py
git commit -m "feat: add daily_extraction CLI entrypoint for external scheduling"
```

---

### Task 5: Remove manual "Atualizar" button, show last-run status

**Files:**
- Modify: `app/pages/1_Painel.py:1-45`

**Interfaces:**
- Consumes: `fetch_usage_summary()` from `app/lib/db.py` (already exists, unchanged — returns dict with `last_run_at` key, an ISO-UTC string or `None`).
- Produces: no new interface — this is a leaf UI change, nothing downstream depends on it.

There is no existing automated test suite for Streamlit pages in this repo (none of `app/tests/*.py` import from `app/pages/`) — verification here is manual, per Step 3 below.

- [ ] **Step 1: Replace the button block with a read-only status line**

In `app/pages/1_Painel.py`, replace lines 1-45 (from the imports through the `st.divider()` that follows the button block) with:

```python
import streamlit as st
from datetime import datetime
import pytz
from lib.db import fetch_activities, update_activity_status, fetch_usage_summary
from lib.theme import urgency_badge_html, inject_css

st.set_page_config(page_title="Painel", layout="wide")
inject_css()

st.title("Atividades")
st.markdown("Revise e atualize o status das atividades extraídas das mensagens do WhatsApp. A extração roda automaticamente 1x por dia.")

usage = fetch_usage_summary()
if usage['last_run_at']:
    tz = pytz.timezone('America/Sao_Paulo')
    last_run_local = datetime.fromisoformat(usage['last_run_at']).astimezone(tz)
    st.caption(f"Última extração: {last_run_local.strftime('%d/%m/%Y %H:%M')}")
else:
    st.caption("Nenhuma extração executada ainda.")

st.divider()
```

Everything below this point in the file (`def render_activity_card(activity): ...` through the end) stays exactly as-is — only the top block (imports through the first `st.divider()`) changes.

- [ ] **Step 2: Run the full app test suite to confirm no regressions**

Run: `cd app && source venv/bin/activate && python -m pytest tests/ -v`
Expected: all tests PASS (this file has no dedicated tests, but this confirms the change didn't break imports used elsewhere)

- [ ] **Step 3: Manual verification**

```bash
cd app && source venv/bin/activate
streamlit run Home.py --server.headless true --server.port 8501 &
```

Navigate to `http://localhost:8501/Painel` (use the Playwright MCP tools: `browser_navigate`, then `browser_snapshot`) and confirm:
- No "Atualizar" button is present.
- A caption showing either "Última extração: DD/MM/AAAA HH:MM" or "Nenhuma extração executada ainda." appears below the title.
- The Pendentes/Concluídas/Descartadas tabs still render with the real data in `data/app.db` without errors.

Then stop the streamlit process:

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add app/pages/1_Painel.py
git commit -m "feat: remove manual extraction button, show last-run status instead"
```

---

### Task 6: Document the daily scheduler in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the "Fluxo de uso" section**

In `README.md`, replace this list item (around line 92):

```
3. **Clique "Atualizar" no Painel**: 
   - Processa até **10 lotes de 30 mensagens** por clique (limite de custo)
   - LLM extrai atividades (prova, trabalho, evento, atividade) com prazos
   - Mostra quantas atividades foram extraídas e tokens consumidos
```

with:

```
3. **Extração automática 1x/dia**: um agendador externo (cron/systemd, veja "Extração diária" abaixo) roda `python -m scripts.daily_extraction`, que processa até **10 lotes de 30 mensagens** por execução (limite de custo) e extrai atividades (prova, trabalho, evento, atividade) com prazos
```

- [ ] **Step 2: Add the "Extração diária" section**

Right after the "## Import retroativo (histórico completo com mídia)" section (after the line ending "...pra importar." and before "## Estrutura de arquivos"), insert:

```markdown
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
```

- [ ] **Step 3: Update "Controle de custo" bullets**

Replace (around line 164-165):

```
- **Cap de processamento**: máximo 10 lotes de 30 mensagens **por clique** em "Atualizar"
- **Sem polling automático**: extração só acontece quando você clica, não em background
```

with:

```
- **Cap de processamento**: máximo 10 lotes de 30 mensagens **por execução** do `daily_extraction`
- **Frequência fixa**: extração roda 1x/dia via agendador externo (cron/systemd), nunca em polling contínuo
```

- [ ] **Step 4: Update the "💰 Uso de API" bullet that references the button**

Replace (around line 193):

```
- **Custo por token**: `deepseek-v4-flash` é barato, mas acumula com o tempo se "Atualizar" for clicado muitas vezes
```

with:

```
- **Custo por token**: `deepseek-v4-flash` é barato, mas acumula com o tempo — monitore o consumo diário exibido no Painel
```

- [ ] **Step 5: Add `daily_extraction.py` to the file tree**

In the "## Estrutura de arquivos" tree, change:

```
│   │   └── extraction.py       # Pipeline de extração
│   └── pages/
```

to:

```
│   │   └── extraction.py       # Pipeline de extração
│   ├── scripts/
│   │   └── daily_extraction.py # CLI invocado 1x/dia pelo agendador externo
│   └── pages/
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document daily extraction scheduler, remove references to the manual button"
```

---

## Final Verification

After all 6 tasks are committed:

1. `cd app && source venv/bin/activate && python -m pytest tests/ -v` — full suite passes.
2. `cd bot && node tests/test_config.js && node tests/test_db.js` — unaffected, must still pass (no bot files touched).
3. Manual: run `python -m scripts.daily_extraction` once against a copy of the real DB (not `data/app.db` directly — copy it to a scratch path first) with a valid `OPENCODE_API_KEY`, confirm it drains and exits.
4. Manual: open the Painel page in a browser, confirm no button, confirm the "Última extração" caption reflects the manual run from step 3.
