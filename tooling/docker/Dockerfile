
# --- Stage 1: Build frontend ---
FROM node:20-alpine AS client-build
WORKDIR /client
COPY apps/client/package*.json ./
RUN npm install --no-audit --no-fund
COPY apps/client .
RUN npm run build

# --- Stage 2: Main app ---
FROM node:20-alpine
WORKDIR /apps
RUN apk add --no-cache python3 g++
COPY apps/server/package*.json ./
RUN npm install --production --no-audit --no-fund
COPY package.json /package.json
COPY apps/server /apps/server
COPY apps/public /apps/public

# Copy built frontend from previous stage
COPY --from=client-build /client/dist /apps/client/dist

RUN mkdir -p /apps/data /apps/data/database /apps/public/favicons
ENV NODE_ENV=${NODE_ENV:-production}
ENV PORT=${PORT:-3000}
ENV HOST=${HOST:-0.0.0.0}
ENV DB_PATH=${DB_PATH:-/apps/database/anchormarks.db}
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://${HOST}:${PORT}/api/health || exit 1
RUN chown -R node:node /apps
USER node
CMD ["node", "/apps/server/index.js"]
