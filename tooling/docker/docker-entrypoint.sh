#!/bin/sh
set -e

echo "Initializing AnchorMarks container..."
echo "Using pre-built frontend from image"

# Ensure server dependencies are present (host volume may not include node_modules)
echo "Installing server dependencies (production)..."
cd /apps/server
npm install --omit=dev --no-audit --no-fund --no-package-lock

# Start the server as node user
echo "Starting server..."
cd /apps/server
exec su-exec node node index.js
