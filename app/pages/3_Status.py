import os
from datetime import datetime, timedelta, timezone

import pytz
import streamlit as st

from lib.cost import calculate_cost, INPUT_PRICE_PER_1M, OUTPUT_PRICE_PER_1M
from lib.db import (
    fetch_unprocessed_count,
    fetch_usage_summary,
    fetch_activity_status_counts,
    fetch_activity_type_counts,
    fetch_message_stats,
    get_db_path,
)
from lib.theme import inject_css

st.set_page_config(page_title="Status", layout="wide")
inject_css()

st.title("Status do Projeto")
st.markdown("Visão geral de uso, custo estimado e atividade do sistema.")
st.divider()

tz = pytz.timezone('America/Sao_Paulo')
model = os.getenv('OPENCODE_MODEL', 'deepseek-v4-flash')

all_time = fetch_usage_summary()
since_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
last_30d = fetch_usage_summary(since=since_30d)

cost_all_time = calculate_cost(all_time['prompt_tokens'], all_time['completion_tokens'])
cost_30d = calculate_cost(last_30d['prompt_tokens'], last_30d['completion_tokens'])
avg_cost_per_run = cost_all_time / all_time['run_count'] if all_time['run_count'] else 0.0

st.subheader("Custo e Tokens")
cost_cols = st.columns(4)
with cost_cols[0]:
    st.metric("Custo Estimado (total)", f"${cost_all_time:.4f}")
with cost_cols[1]:
    st.metric("Custo Estimado (30 dias)", f"${cost_30d:.4f}")
with cost_cols[2]:
    st.metric("Tokens de Entrada", f"{all_time['prompt_tokens']:,}")
with cost_cols[3]:
    st.metric("Tokens de Saída", f"{all_time['completion_tokens']:,}")

st.caption(
    f"Estimativa baseada no preço do modelo `{model}` na OpenCode Zen: "
    f"US\\${INPUT_PRICE_PER_1M:.2f}/1M tokens de entrada, US\\${OUTPUT_PRICE_PER_1M:.2f}/1M de saída. "
    "Não reflete cobrança real caso você esteja em um plano de assinatura (OpenCode Go)."
)

st.divider()

st.subheader("Execuções de Extração")
run_cols = st.columns(3)
with run_cols[0]:
    st.metric("Total de Execuções", all_time['run_count'])
with run_cols[1]:
    st.metric("Custo Médio por Execução", f"${avg_cost_per_run:.4f}")
with run_cols[2]:
    if all_time['last_run_at']:
        last_run_local = datetime.fromisoformat(all_time['last_run_at']).astimezone(tz)
        st.metric("Última Execução", last_run_local.strftime("%d/%m %H:%M"))
    else:
        st.metric("Última Execução", "—")

st.divider()

st.subheader("Mensagens")
msg_stats = fetch_message_stats()
queue = fetch_unprocessed_count()
msg_cols = st.columns(3)
with msg_cols[0]:
    st.metric("Total Capturado", msg_stats['total'])
with msg_cols[1]:
    st.metric("Na Fila", queue)
with msg_cols[2]:
    if msg_stats['first_timestamp']:
        first_dt = datetime.fromisoformat(msg_stats['first_timestamp']).replace(tzinfo=timezone.utc)
        days_running = max(0, (datetime.now(timezone.utc) - first_dt).days)
        st.metric("Dias de Operação", days_running)
    else:
        st.metric("Dias de Operação", "—")

st.divider()

st.subheader("Atividades")
status_counts = fetch_activity_status_counts()
type_counts = fetch_activity_type_counts()

status_cols = st.columns(4)
with status_cols[0]:
    st.metric("Total", sum(status_counts.values()))
with status_cols[1]:
    st.metric("Pendentes", status_counts.get('pendente', 0))
with status_cols[2]:
    st.metric("Concluídas", status_counts.get('concluido', 0))
with status_cols[3]:
    st.metric("Descartadas", status_counts.get('descartado', 0))

with st.container(border=True):
    st.markdown("**Por tipo**")
    type_labels = {"prova": "Provas", "trabalho": "Trabalhos", "evento": "Eventos", "atividade": "Atividades"}
    type_cols = st.columns(4)
    for col, (key, label) in zip(type_cols, type_labels.items()):
        with col:
            st.metric(label, type_counts.get(key, 0))

st.divider()

st.subheader("Sistema")
sys_cols = st.columns(2)
with sys_cols[0]:
    db_path = get_db_path()
    db_size_mb = db_path.stat().st_size / (1024 * 1024) if db_path.exists() else 0
    st.metric("Tamanho do Banco de Dados", f"{db_size_mb:.2f} MB")
with sys_cols[1]:
    st.metric("Modelo em Uso", model)
