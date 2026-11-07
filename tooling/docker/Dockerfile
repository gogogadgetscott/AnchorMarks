# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM node:22-alpine AS client-build
WORKDIR /client

# Install frontend dependencies. --legacy-peer-deps works around an npm 10
# arborist crash ("Cannot read properties of null (reading 'edgesOut')") when
# resolving this dependency set without a lockfile in the stage.
COPY apps/client/package*.json ./
RUN npm install --no-fund --legacy-peer-deps

# Build frontend (root package.json is needed to read the app version)
COPY package.json /package.json
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
WORKDIR /anchormarks

# Install system dependencies
RUN apk add --no-cache python3 g++ make su-exec

# Copy the workspace manifests. The root package-lock.json is the authoritative
# workspace lockfile (the nested apps/server/package-lock.json is stale).
COPY package.json /anchormarks/package.json
COPY package-lock.json /anchormarks/package-lock.json

# Create the workspace member directories and copy only their manifests, so the
# dependency layer is cached independently of source changes.
RUN mkdir -p /anchormarks/apps/server /anchormarks/apps/client
COPY apps/server/package.json /anchormarks/apps/server/package.json
COPY apps/client/package.json /anchormarks/apps/client/package.json

# Install production dependencies once, from the workspace root.
# The workspace root must be a normal directory: when the project root is "/",
# npm silently skips workspace dependencies (only root devDependencies get
# installed), and the server then cannot find dotenv/express at startup.
RUN npm ci --omit=dev --no-fund && \
    npm audit --omit=dev --audit-level=high && \
    npm rebuild

# Copy application code (node_modules excluded via the root .dockerignore)
COPY apps/server /anchormarks/apps/server
COPY apps/client /anchormarks/apps/client

# Copy built frontend from build stage
COPY --from=client-build /client/dist /anchormarks/apps/client/dist

# Setup entrypoint
COPY tooling/docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment variables (non-secret defaults only)
ARG NODE_ENV=production
ARG PORT=3000
ARG HOST=0.0.0.0
ARG DB_PATH=/apps/database/anchormarks.db
ARG CORS_ORIGIN
ARG SSL_ENABLED=false
ARG SSL_KEY=/apps/ssl/privkey.pem
ARG SSL_CERT=/apps/ssl/fullchain.pem

ENV NODE_ENV=$NODE_ENV \
    PORT=$PORT \
    HOST=$HOST \
    DB_PATH=$DB_PATH \
    CORS_ORIGIN=$CORS_ORIGIN \
    SSL_ENABLED=$SSL_ENABLED \
    SSL_CERT=$SSL_CERT \
    WORKDIR=/anchormarks/apps/server

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://${HOST}:${PORT}/api/health || exit 1

# Set permissions and switch to non-root user.
# USER node is declared so container orchestrators enforcing runAsNonRoot: true
# can schedule this image without a security policy exception.
# The entrypoint uses su-exec for any setup steps that still need root before exec.
RUN mkdir -p /apps && chown -R node:node /anchormarks /apps /docker-entrypoint.sh

# Relative paths from .env (e.g. DB_PATH=./apps/database/anchormarks.db) resolve
# against the project root, which is now /anchormarks. Point them back at the
# docker-compose volumes so the existing database and certificates keep working.
RUN mkdir -p /apps/database /apps/ssl && \
    chown node:node /apps/database /apps/ssl && \
    ln -s /apps/database /anchormarks/apps/database && \
    ln -s /apps/ssl /anchormarks/apps/ssl
USER node

ENTRYPOINT ["/docker-entrypoint.sh"]
