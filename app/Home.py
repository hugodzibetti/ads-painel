import streamlit as st
from lib.db import fetch_unprocessed_count, fetch_activities
from lib.theme import inject_css

st.set_page_config(page_title="ads-painel", layout="wide")
inject_css()

st.title("ads-painel")
st.markdown("Acompanhe prazos da turma de ADS extraídos automaticamente das mensagens do WhatsApp.")

st.divider()

col1, col2, col3 = st.columns(3)

with col1:
    pending_count = fetch_unprocessed_count()
    st.metric("Mensagens na Fila", pending_count)

with col2:
    activities = fetch_activities(status='pendente')
    st.metric("Atividades Pendentes", len(activities))

with col3:
    all_activities = fetch_activities()
    st.metric("Total de Atividades", len(all_activities))

st.divider()

with st.container(border=True):
    st.subheader("Fluxo de Uso")
    st.markdown("""
1. O bot captura mensagens dos grupos de WhatsApp
2. A extração de atividades (prazos, provas, trabalhos) roda automaticamente 1x por dia
3. Revise cada atividade: marque como concluída ou descarte as incorretas
4. Consulte o histórico de mensagens na aba **Mensagens** quando precisar
""")
