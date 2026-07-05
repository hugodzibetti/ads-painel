# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./
COPY shared/ ./shared/

# Build TypeScript (bot)
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install system dependencies for whatsapp-web.js
RUN apk add --no-cache \
    chromium

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy shared schema
COPY shared/ ./shared/

# Create data directory and hand /app to the built-in unprivileged node user
RUN mkdir -p ./data && chown -R node:node /app
USER node

# Environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f "node dist/bot/index.js" || exit 1

# Start application
CMD ["node", "dist/bot/index.js"]
