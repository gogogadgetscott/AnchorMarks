
# --- Stage 1: Build frontend ---
FROM node:20-alpine AS client-build
WORKDIR /client
COPY apps/client/package*.json ./
RUN npm install --no-audit --no-fund
COPY apps/client .
RUN npm run build

# --- Stage 2: Main app ---
FROM node:20-alpine
WORKDIR /
RUN apk add --no-cache python3 g++ make su-exec

# Set up workspace structure
COPY package.json /package.json

# Create workspace directories and copy package.json files
RUN mkdir -p /apps/server /apps/client /apps/public
COPY apps/server/package*.json /apps/server/
COPY apps/client/package*.json /apps/client/

# Install all dependencies
RUN npm install --no-audit --no-fund

# Copy application code
COPY apps/server /apps/server
COPY apps/client /apps/client
COPY apps/public /apps/public

# Copy built frontend from previous stage (fallback for first run)
COPY --from=client-build /client/dist /apps/client/dist

# Copy entrypoint script
COPY tooling/docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /apps/data /apps/data/database /apps/public/favicons
# Build-time ARGs for environment variables
ARG NODE_ENV=production
ARG PORT=3000
ARG HOST=0.0.0.0
ARG DB_PATH=/apps/database/anchormarks.db
ARG JWT_SECRET=your-super-secret-jwt-key-change-this-to-a-random-string
ARG CORS_ORIGIN=*
ARG SSL_KEY=/apps/ssl/privkey.pem
ARG SSL_CERT=/apps/ssl/fullchain.pem

# Set ENV from ARG for runtime
ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT
ENV HOST=$HOST
ENV DB_PATH=$DB_PATH
ENV JWT_SECRET=$JWT_SECRET
ENV CORS_ORIGIN=$CORS_ORIGIN
ENV SSL_KEY=$SSL_KEY
ENV SSL_CERT=$SSL_CERT

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://${HOST}:${PORT}/api/health || exit 1

# Ensure proper ownership of all app directories and node_modules
RUN chown -R node:node /apps /node_modules /docker-entrypoint.sh
# Don't switch to node user yet - entrypoint needs root to write to mounted volumes
ENTRYPOINT ["/docker-entrypoint.sh"]
