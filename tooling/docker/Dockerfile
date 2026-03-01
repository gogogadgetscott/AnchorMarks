# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM node:22-alpine AS client-build
WORKDIR /client

# Install frontend dependencies
COPY apps/client/package*.json ./
RUN npm install --no-fund

# Build frontend
COPY apps/client .
RUN npx vite build && \
    npx esbuild src/shared/folders-utils-browser.ts \
    --bundle \
    --platform=browser \
    --format=iife \
    --global-name=foldersUtils \
    --outfile=public/js/folders-utils.js \
    --minify

# =============================================================================
# Stage 2: Production Application
# =============================================================================
FROM node:22-alpine AS production
WORKDIR /

# Install system dependencies
RUN apk add --no-cache python3 g++ make su-exec

# Copy root package.json
COPY package.json /package.json

# Create workspace structure
RUN mkdir -p /apps/server /apps/client /apps/public/favicons
COPY apps/server/package*.json /apps/server/
COPY apps/client/package*.json /apps/client/

# Install production dependencies
RUN npm install --no-fund && \
    npm audit --audit-level=high && \
    npm rebuild

# Copy application code
COPY apps/server /apps/server
COPY apps/client /apps/client

# Copy built frontend from build stage
COPY --from=client-build /client/dist /apps/client/dist

# Setup entrypoint
COPY tooling/docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment variables (non-secret defaults only)
ARG NODE_ENV=production
ARG PORT=3000
ARG HOST=0.0.0.0
ARG DB_PATH=/apps/database/anchormarks.db
# Do not default JWT_SECRET, JWT_REFRESH_SECRET, or CORS_ORIGIN
ARG JWT_SECRET
ARG JWT_REFRESH_SECRET
ARG CORS_ORIGIN
ARG SSL_ENABLED=false
ARG SSL_KEY=/apps/ssl/privkey.pem
ARG SSL_CERT=/apps/ssl/fullchain.pem

ENV NODE_ENV=$NODE_ENV \
    PORT=$PORT \
    HOST=$HOST \
    DB_PATH=$DB_PATH \
    JWT_SECRET=$JWT_SECRET \
    JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET \
    CORS_ORIGIN=$CORS_ORIGIN \
    SSL_ENABLED=$SSL_ENABLED \
    SSL_CERT=$SSL_CERT \
    WORKDIR=/apps/server

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://${HOST}:${PORT}/api/health || exit 1

# Set permissions and switch to non-root user.
# USER node is declared so container orchestrators enforcing runAsNonRoot: true
# can schedule this image without a security policy exception.
# The entrypoint uses su-exec for any setup steps that still need root before exec.
RUN chown -R node:node /apps /node_modules /docker-entrypoint.sh
USER node

ENTRYPOINT ["/docker-entrypoint.sh"]
