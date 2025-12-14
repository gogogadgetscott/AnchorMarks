# Use Node.js LTS Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install 
RUN npm ci
# RUN npm ci --only=production

# Copy application files
COPY server ./server
COPY public ./public

# Create directories for data and favicons
RUN mkdir -p /data /app/public/favicons

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
RUN chown -R nodejs:nodejs /app /data
USER nodejs

# Start the application
CMD ["node", "server/index.js"]
