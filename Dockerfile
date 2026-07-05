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

# Build TypeScript (server + bot + frontend)
RUN npm run build

# Note: build script runs both build:server and build:frontend

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install system dependencies for whatsapp-web.js
RUN apk add --no-cache \
    chromium \
    noto-sans

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

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "dist/server/server.js"]
