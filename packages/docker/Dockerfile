# Use Node.js LTS Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 g++

# Copy package files from the apps workspace so dependencies are installed
# (root package.json is a workspace root and does not contain deps)
COPY apps/package*.json ./

# Install dependencies (use install since workspace lockfile may not exist)
RUN npm install --production --no-audit --no-fund

# Copy application files from repo root (workspace layout)
COPY apps/server ./server
COPY apps/public ./public
COPY apps/__mocks__ ./__mocks__

# Create directories for data and favicons
RUN mkdir -p /data /data/public/favicons

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/anchormarks.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Start the application
CMD ["node", "server/app.js"]
