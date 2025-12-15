#!/bin/bash
# AnchorMarks Production Deployment Script
# Run this on your production server

set -e

echo "🔗 AnchorMarks Deployment Script"
echo "==============================="

# Configuration
APP_DIR="./"
APP_USER="user"
NODE_VERSION="20"

# Check if running as root (POSIX-compatible)
if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "👤 Creating application user..."
useradd -r -s /bin/false $APP_USER || true

echo "📁 Setting up application directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIRpublic/favicons

echo "📋 Copying application files..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"

# Resolve APP_DIR to absolute path for comparison
ABSOLUTE_APP_DIR="$(cd "$APP_DIR" 2>/dev/null && pwd || echo "$APP_DIR")"

if [ "$SOURCE_DIR" = "$ABSOLUTE_APP_DIR" ]; then
  echo "ℹ️  Installing in-place. Skipping file copy."
else
  cp -r "$SOURCE_DIR/server" "$APP_DIR"
  cp -r "$SOURCE_DIR/public" "$APP_DIR"
  cp "$SOURCE_DIR/package"*.json "$APP_DIR"
fi

echo "📚 Installing dependencies..."
cd $APP_DIR
npm ci --only=production

echo "🔐 Setting up environment..."
if [ ! -f $APP_DIR.env ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  cat > $APP_DIR.env << EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
JWT_SECRET=$JWT_SECRET
DB_PATH=$APP_DIRserver/anchormarks.db
EOF
  echo "✅ Generated .env file with secure JWT secret"
fi

echo "👤 Setting permissions..."
chown -R $APP_USER:$APP_USER $APP_DIR
chmod 600 $APP_DIR.env

echo "🚀 Setting up systemd service..."
cp "$SCRIPT_DIR/anchormarks.service" /etc/systemd/system/

# Check if systemd is available
if pidof systemd > /dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable anchormarks
  systemctl start anchormarks
  
  echo ""
  echo "✅ AnchorMarks deployed and running!"
  echo ""
  echo "� Useful commands:"
  echo "   systemctl status anchormarks    # Check status"
  echo "   journalctl -u anchormarks -f    # View logs"
  echo "   systemctl restart anchormarks   # Restart service"
else
  echo ""
  echo "⚠️  Systemd not available (WSL/container detected)"
  echo "   Service file installed to /etc/systemd/system/anchormarks.service"
  echo ""
  echo "✅ AnchorMarks installed successfully!"
  echo ""
  echo "🚀 To start manually, run:"
  echo "   cd $APP_DIR && sudo -u $APP_USER node server/index.js"
  echo ""
  echo "   Or use npm:"
  echo "   cd $APP_DIR && sudo -u $APP_USER npm start"
fi

echo ""
echo "📋 Next steps:"
echo "   1. Configure Nginx (see deploy/nginx.conf)"
echo "   2. Set up SSL with Let's Encrypt"
echo "   3. Update CORS_ORIGIN in $APP_DIR.env"
echo ""
