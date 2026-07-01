import streamlit as st
from datetime import datetime, timedelta
import pytz
from lib.extraction import run_extraction
from lib.db import fetch_activities, update_activity_status

st.set_page_config(page_title="Painel", layout="wide")

st.title("Atividades")

col1, col2 = st.columns([4, 1])
with col1:
    st.markdown("Revise e atualize o status das atividades extraídas das mensagens do WhatsApp.")
with col2:
    if st.button("🔄 Atualizar", use_container_width=True, key="update_btn"):
        with st.spinner("Processando mensagens..."):
            result = run_extraction(max_batches=10)

        if result["errors"]:
            st.error("Erros durante extração:")
            for err in result["errors"]:
                st.write(f"- {err}")

        st.success(f"✅ Processamento concluído")

        result_cols = st.columns(4)
        with result_cols[0]:
            st.metric("Extraídas", result['activities_extracted'])
        with result_cols[1]:
            st.metric("Processadas", result['messages_processed'])
        with result_cols[2]:
            st.metric("Tokens", result['total_tokens_used'])
        with result_cols[3]:
            st.metric("Na Fila", result['messages_remaining'])

st.markdown("---")

tz = pytz.timezone('America/Sao_Paulo')
now = datetime.now(tz)

def get_urgency_color(due_date_str, confidence):
    try:
        due_date = datetime.fromisoformat(due_date_str).date()
        today = now.date()
        days_until = (due_date - today).days
        if days_until < 0:
            return "🔴"
        elif days_until == 0:
            return "🟠"
        elif days_until <= 3:
            return "🟡"
        else:
            return "🟢"
    except (ValueError, AttributeError, TypeError):
        return "⚪"

def render_activity_card(activity):
    urgency = get_urgency_color(activity['due_date'], activity['confidence'])
    with st.container(border=True):
        header_col1, header_col2 = st.columns([3, 1], gap="small")
        with header_col1:
            st.markdown(f"**{activity['type'].upper()}** — {activity['title']}")
        with header_col2:
            if activity['confidence'] == 'baixa':
                st.caption("⚠️ Baixa confiança")

        if activity['description']:
            st.markdown(activity['description'], unsafe_allow_html=False)

        meta_col1, meta_col2, meta_col3 = st.columns(3, gap="small")
        with meta_col1:
            st.caption(f"📅 Prazo: **{activity['due_date']}**")
        with meta_col2:
            st.caption(f"👤 {activity['author']}")
        with meta_col3:
            st.caption(f"💬 {activity['group_label']}")

        action_col1, action_col2, action_col3 = st.columns([1, 1, 2], gap="small")
        with action_col1:
            if st.button("Concluir", key=f"conclude_{activity['id']}", use_container_width=True):
                update_activity_status(activity['id'], 'concluido')
                st.success("Concluída!")
                st.rerun()
        with action_col2:
            if st.button("Descartar", key=f"discard_{activity['id']}", use_container_width=True):
                update_activity_status(activity['id'], 'descartado')
                st.info("Descartada.")
                st.rerun()
        with action_col3:
            st.caption(f"ID da mensagem: {activity['source_message_id']}")

tab1, tab2, tab3 = st.tabs(["📋 Pendentes", "✅ Concluídas", "🗑️ Descartadas"])

with tab1:
    activities = fetch_activities(status='pendente')
    if not activities:
        st.info("Nenhuma atividade pendente.")
    else:
        st.markdown(f"{len(activities)} atividade(s)")
        st.divider()
        for activity in activities:
            render_activity_card(activity)

with tab2:
    activities = fetch_activities(status='concluido')
    if not activities:
        st.info("Nenhuma atividade concluída.")
    else:
        st.markdown(f"{len(activities)} atividade(s)")
        st.divider()
        for activity in activities:
            render_activity_card(activity)

with tab3:
    activities = fetch_activities(status='descartado')
    if not activities:
        st.info("Nenhuma atividade descartada.")
    else:
        st.markdown(f"{len(activities)} atividade(s)")
        st.divider()
        for activity in activities:
            render_activity_card(activity)
