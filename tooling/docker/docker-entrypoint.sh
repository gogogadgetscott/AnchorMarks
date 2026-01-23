#!/bin/sh
set -e

echo "Initializing AnchorMarks container..."
echo "Using pre-built frontend from image"

# Start the server as node user
echo "Starting server..."
cd /apps/server
exec su-exec node node index.js
