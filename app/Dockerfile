FROM python:3.12-slim

WORKDIR /app

COPY app/requirements.txt app/requirements.txt
RUN pip install --no-cache-dir -r app/requirements.txt

COPY app/ app/
COPY shared/ shared/

WORKDIR /app/app

EXPOSE 8501

CMD ["streamlit", "run", "Home.py", "--server.address=0.0.0.0", "--server.port=8501"]
