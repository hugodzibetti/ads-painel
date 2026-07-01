FROM node:20-slim

# Chromium do sistema: evita download do binário do puppeteer no build
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY bot/package*.json bot/
RUN cd bot && npm ci --omit=dev

COPY bot/ bot/
COPY shared/ shared/

WORKDIR /app/bot

CMD ["node", "index.js"]
