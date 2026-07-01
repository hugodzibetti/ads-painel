import streamlit as st
from lib.db import fetch_unprocessed_count, fetch_activities

st.set_page_config(page_title="ads-painel", layout="wide")

st.title("ads-painel")
st.markdown("Acompanhe prazos da turma de ADS extraídos automaticamente das mensagens do WhatsApp.")

st.markdown("---")

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

st.markdown("---")

st.subheader("Fluxo de Uso")
st.markdown("""
1. O bot captura mensagens dos grupos de WhatsApp
2. Clique em **"Atualizar"** no Painel para extrair atividades (prazos, provas, trabalhos)
3. Revise cada atividade: marque como concluída ou descarte as incorretas
4. Consulte o histórico de mensagens na aba **Mensagens** quando precisar
""")
