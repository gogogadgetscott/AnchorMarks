#!/bin/sh
set -e

echo "Initializing AnchorMarks container..."
echo "Using pre-built frontend from image"

# Ensure database directory exists (already owned by node via Dockerfile chown)
mkdir -p /apps/database

# Dependencies are installed and audited during the image build.
echo "Using production dependencies from image"

# Start the server
echo "Starting server..."
cd /anchormarks/apps/server
exec node index.js
