import math

import streamlit as st
from lib.db import fetch_messages, fetch_messages_count
from lib.theme import inject_css

st.set_page_config(page_title="Mensagens", layout="wide")
inject_css()

st.title("Mensagens")
st.markdown("Histórico completo de mensagens capturadas dos grupos de WhatsApp.")

st.divider()

col1, col2 = st.columns([4, 1], gap="small")
with col1:
    search_query = st.text_input(
        "Pesquisar",
        placeholder="Buscar por autor, palavra-chave...",
        label_visibility="collapsed"
    )
with col2:
    with st.spinner("Carregando mensagens..."):
        total = fetch_messages_count(search_query)
    total_pages = max(1, math.ceil(total / 200))
    page = st.number_input(
        "Página",
        min_value=1,
        max_value=total_pages,
        value=1,
        step=1,
        label_visibility="collapsed"
    )

st.divider()

offset = (page - 1) * 200

with st.spinner("Carregando mensagens..."):
    if search_query:
        messages = fetch_messages(limit=200, offset=offset, search_query=search_query)
        st.markdown(f"**{len(messages)} de {total} resultado(s)**")
    else:
        messages = fetch_messages(limit=200, offset=offset, search_query=None)
        st.markdown(f"**Página {page} de {total_pages}** — {total} mensagen(ns)")

if not messages:
    st.info("Nenhuma mensagem encontrada.")
else:
    for msg in messages:
        with st.container(border=True):
            header_col1, header_col2 = st.columns([3, 1], gap="small")
            with header_col1:
                st.caption(f"**{msg['author']}** · {msg['group_label']}")
            with header_col2:
                activity_count = msg.get('activity_count', 0)
                if activity_count > 0:
                    st.caption(f"🔗 {activity_count} atividade(s)")

            st.markdown(msg['body'] or "*[mensagem sem texto]*")

            st.caption(f"#{msg['id']} · {msg['timestamp']}")
