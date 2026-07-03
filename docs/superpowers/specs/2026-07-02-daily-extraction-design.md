# Extração diária automática — design

## Contexto e motivação

Hoje a extração de atividades (`run_extraction()` em `app/lib/extraction.py`) só roda quando o usuário clica em "Atualizar" na página Painel (`app/pages/1_Painel.py`). Isso foi uma decisão deliberada de controle de custo (CLAUDE.md: cap de 10 lotes/clique, sem polling em background). Na prática isso significa que atividades novas só aparecem depois de uma ação manual, o que o usuário achou pouco natural para um painel que deveria refletir o estado atual automaticamente.

Foi cogitada uma abordagem mais ambiciosa (agente com acesso a tools, decidindo por conta própria quando buscar mais mensagens) e recusada em favor de algo mais simples e previsível: rodar a extração 1x por dia via agendador externo (cron/systemd timer), mantendo o mesmo pipeline de hoje (mensagens não processadas → LLM → activities), mas passando as atividades já conhecidas (pendentes e concluídas) como contexto adicional no prompt, para o modelo ter noção do que já existe antes de extrair coisas novas. O botão manual "Atualizar" é removido — a extração passa a ser 100% automática.

## Arquitetura

### 1. Script de execução diária

Novo arquivo `app/scripts/daily_extraction.py`, no mesmo padrão de `app/scripts/import_export.py`: um script standalone, invocado via `python -m scripts.daily_extraction` a partir de `app/`, pensado para ser chamado por cron/systemd — **não** roda dentro do processo do Streamlit e não fica em loop infinito esperando o próximo dia (isso é responsabilidade do agendador externo, fora do repo).

```python
def main():
    while True:
        summary = run_extraction(max_batches=10)
        print(f"lote: {summary['messages_processed']} processadas, "
              f"{summary['activities_extracted']} atividades, "
              f"{summary['total_tokens_used']} tokens, "
              f"{summary['messages_remaining']} restantes")
        if summary['errors']:
            print(f"erros: {summary['errors']}")
        if summary['messages_remaining'] == 0 or summary['messages_processed'] == 0:
            break

if __name__ == '__main__':
    main()
```

Isso reaproveita `run_extraction()` sem nenhuma mudança de contrato — mesmo cap de 10 lotes por chamada ao script, mesmo comportamento de "lote inválido ainda é marcado processado, só erro de rede/API deixa pra retry". O loop `while True` aqui dreno a fila do dia inteiro em uma única execução do cron (ex.: se o volume de mensagens do dia passar de 300, o script continua rodando lotes de 10 em 10 até `messages_remaining == 0`), da mesma forma que `import_export.py` já faz hoje.

Saída via `print()` para stdout — cron por padrão manda stdout/stderr por e-mail local ou pode ser redirecionado (`>> logs/daily_extraction.log 2>&1`), e systemd captura automaticamente no journal. Não é necessário nenhum sistema de log estruturado novo.

### 2. Agendamento (fora do repo)

Cron e systemd timer são específicos do host (caminhos absolutos, usuário do sistema) — não fazem sentido como arquivos versionados no repo. O `README.md` ganha uma seção "Extração diária" com dois exemplos prontos pra copiar/adaptar:

**Crontab** (`crontab -e`):
```
0 6 * * * cd /caminho/para/ads-painel/app && venv/bin/python -m scripts.daily_extraction >> /caminho/para/ads-painel/logs/daily_extraction.log 2>&1
```

**systemd timer** (alternativa, se o usuário preferir): snippet de `.service` + `.timer` de exemplo, com nota para ajustar `WorkingDirectory`, `ExecStart` e o usuário do sistema.

Nenhum dos dois é testável em CI/automaticamente — a verificação é rodar o script manualmente uma vez e conferir que ele processa e termina (não fica pendurado).

### 3. Atividades existentes como contexto no prompt

Nova função em `app/lib/db.py`:

```python
def fetch_active_activities(limit=200):
    """Fetch pendente + concluido activities (never descartado) as context for the LLM prompt."""
```
Retorna `type`, `title`, `due_date`, `status`, ordenado por `due_date ASC`, limitado a 200 (mesma ordem de grandeza dos outros `limit` já usados em `db.py`; na prática o volume do dataset é pequeno o suficiente para nunca bater nesse teto, mas evita prompt sem limite se o histórico crescer muito).

`app/lib/prompts.py::build_user_prompt(messages, existing_activities=None)` ganha um parâmetro opcional. Quando não-vazio, um bloco é inserido **antes** da lista de mensagens:

```
Atividades já conhecidas (não recrie itens que já existem aqui — ajuste ou ignore, o pipeline já faz dedup exato por tipo+título+data, mas use isto para julgar continuações e variações de uma mesma atividade):
- [prova] Prova de Redes — 2026-07-10 (pendente)
- [trabalho] Trabalho de BD — 2026-07-05 (concluido)

Analise as seguintes mensagens e extraia atividades acadêmicas:
...
```

Importante: isso é **só contexto textual no prompt**, não uma ferramenta que o modelo aciona — não muda o formato de saída, não introduz tool calling. `run_extraction()` passa a chamar `fetch_active_activities()` uma vez por lote (mesmo padrão do fetch de mensagens) e repassar para `build_user_prompt`. O dedup determinístico em `check_duplicate_activity()` continua sendo a garantia real contra duplicata exata — este contexto é só para ajudar o modelo a não recriar variações da mesma atividade (ex.: "Prova de Redes N2" quando já existe "Prova de Redes" pra mesma data) e ter noção do estado atual ao interpretar menções indiretas.

### 4. Remoção do botão manual

Em `app/pages/1_Painel.py`, o bloco do botão "🔄 Atualizar" (linhas 11–43 atuais) é removido inteiramente — sem botão, sem spinner, sem exibição de resultado do último clique. A página passa a abrir direto no título + divider + abas de atividades (pendentes/concluídas/descartadas), que já refletem o que a extração diária inseriu.

Como sinal de que o pipeline automático está vivo, mantemos uma linha discreta de status usando dados que já existem (`fetch_usage_summary()` em `db.py`, que já tem `last_run_at`):

```python
usage = fetch_usage_summary()
if usage['last_run_at']:
    st.caption(f"Última extração: {ultimo_timestamp_local}")  # convertido de UTC pra America/Sao_Paulo, mesmo padrão de tz usado em prompts.py
else:
    st.caption("Nenhuma extração executada ainda.")
```

Isso não é um botão nem dispara nada — é só leitura do último registro em `llm_usage`. Não adicionamos uma tabela nova de "execuções" só para isso; `llm_usage.timestamp` já é gravado a cada chamada de API dentro de `run_extraction()`, então `MAX(timestamp)` já responde "quando rodou pela última vez" sem nenhuma mudança de schema.

## Testes

- `app/tests/test_db.py`: `fetch_active_activities` retorna pendente+concluido ordenados por due_date, exclui descartado, respeita `limit`.
- `app/tests/test_prompts.py`: `build_user_prompt` com `existing_activities` não-vazio inclui o bloco "Atividades já conhecidas" formatado corretamente; com `existing_activities=None` (ou lista vazia) o prompt fica idêntico ao comportamento atual (sem regressão pros testes existentes).
- `app/tests/test_extraction.py` / `test_extraction_integration.py`: `run_extraction()` passa a chamar `fetch_active_activities()` e repassar pro prompt — teste com mock confirmando que o texto do prompt enviado à API inclui uma atividade pré-existente conhecida.
- Novo `app/tests/test_daily_extraction.py`: `main()` do script chama `run_extraction` em loop até `messages_remaining == 0`, mockando `run_extraction` para simular 2 lotes seguidos de um lote vazio (mesmo padrão de teste que `test_import_export.py` já usa pro loop de drenagem).
- Manual (não automatizável): rodar `python -m scripts.daily_extraction` uma vez contra o banco real e confirmar que processa a fila e termina sem travar; abrir o Painel no navegador e confirmar que a página carrega sem o botão e mostra a linha de "Última extração".

## Fora de escopo

- Qualquer mecanismo de agente/tool-use decidindo buscar mais mensagens por conta própria (opção considerada e descartada nesta rodada).
- Arquivos de unit/timer do systemd versionados no repo (paths são específicos de cada host).
- Notificações (e-mail, push) quando novas atividades aparecem — fora do pedido atual.
- Mudança no cap de 10 lotes por chamada de `run_extraction()` ou no batch size de 30 mensagens.
