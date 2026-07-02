import streamlit as st
from lib.extraction import run_extraction
from lib.db import fetch_activities, update_activity_status
from lib.theme import urgency_badge_html, inject_css

st.set_page_config(page_title="Painel", layout="wide")
inject_css()

st.title("Atividades")

col1, col2 = st.columns([4, 1])
with col1:
    st.markdown("Revise e atualize o status das atividades extraídas das mensagens do WhatsApp.")
with col2:
    if st.button(
        "🔄 Atualizar",
        use_container_width=True,
        key="update_btn",
        disabled=st.session_state.get("extraction_running", False),
    ):
        st.session_state["extraction_running"] = True
        try:
            with st.spinner("Processando mensagens..."):
                result = run_extraction(max_batches=10)
        finally:
            st.session_state["extraction_running"] = False

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

st.divider()

def render_activity_card(activity):
    with st.container(border=True):
        header_col1, header_col2 = st.columns([3, 1], gap="small")
        with header_col1:
            st.markdown(f"**{activity['type'].upper()}** — {activity['title']}")
        with header_col2:
            if activity['confidence'] == 'baixa':
                st.caption("⚠️ Baixa confiança")

        if activity['description']:
            st.markdown(activity['description'], unsafe_allow_html=False)

        meta_col1, meta_col2, meta_col3, meta_col4 = st.columns(4, gap="small")
        with meta_col1:
            st.caption(f"📅 Prazo: **{activity['due_date']}**")
        with meta_col2:
            st.caption(f"👤 {activity['author']}")
        with meta_col3:
            st.caption(f"💬 {activity['group_label']}")
        with meta_col4:
            st.markdown(urgency_badge_html(activity['due_date']), unsafe_allow_html=True)

        action_col1, action_col2, action_col3 = st.columns([1, 1, 2], gap="small")
        with action_col1:
            if st.button("Concluir", key=f"conclude_{activity['id']}", use_container_width=True, type="primary"):
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

def render_activity_tab(status, empty_message):
    activities = fetch_activities(status=status)
    if not activities:
        st.info(empty_message)
    else:
        st.markdown(f"{len(activities)} atividade(s)")
        st.divider()
        for activity in activities:
            render_activity_card(activity)

tab1, tab2, tab3 = st.tabs(["📋 Pendentes", "✅ Concluídas", "🗑️ Descartadas"])

with tab1:
    render_activity_tab('pendente', "Nenhuma atividade pendente.")

with tab2:
    render_activity_tab('concluido', "Nenhuma atividade concluída.")

with tab3:
    render_activity_tab('descartado', "Nenhuma atividade descartada.")
