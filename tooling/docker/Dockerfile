# Use Node.js LTS Alpine for smaller image size
FROM node:20-alpine

# Set working directory to /apps to match repo/compose mounts
WORKDIR /apps

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 g++

# Copy package files from the apps workspace so dependencies are installed
# (root package.json is a workspace root and does not contain deps)
COPY apps/package*.json ./

# Install dependencies (use install since workspace lockfile may not exist)
RUN npm install --production --no-audit --no-fund

# Copy root package.json so server can require ../../package.json at runtime
COPY package.json /package.json

# Copy application files from repo root (workspace layout)
COPY apps/server /apps/server
COPY apps/public /apps/public
COPY apps/__mocks__ /apps/__mocks__

# Create directories for data and favicons (runtime bind mounts may override)
RUN mkdir -p /apps/data /apps/data/database /apps/public/favicons

# Set environment variables
ENV NODE_ENV=${NODE_ENV:-production}
ENV PORT=${PORT:-3000}
ENV HOST=${HOST:-0.0.0.0}
ENV DB_PATH=${DB_PATH:-/apps/database/anchormarks.db}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://${HOST}:${PORT}/api/health || exit 1

# Run as non-root user
RUN chown -R node:node /apps
USER node

# Start the application
CMD ["node", "/apps/server/index.js"]
