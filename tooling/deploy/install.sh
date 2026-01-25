#!/bin/bash
# AnchorMarks Production Deployment Script
# Run this on your production server

set -e

echo "🔗 AnchorMarks Deployment Script"
echo "==============================="

# Configuration
ROOT_DIR="."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use a system user with UID 1001 to match the container's node user
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

echo "👤 Creating application user (anchormarks UID=1001)..."
# Create a system user with fixed UID so host ownership matches container user
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd -r -u 1001 -s /bin/false -M $APP_USER || true
else
  echo "ℹ️  User $APP_USER already exists"
fi

echo "📁 Setting up application directory..."
mkdir -p $ROOT_DIR/apps/database
mkdir -p $ROOT_DIR/apps/public/favicons

echo "📚 Installing dependencies..."
npm ci --only=production

echo "🔐 Setting up environment..."
if [ ! -f $ROOT_DIR/.env ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  cat > $ROOT_DIR/.env << EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
JWT_SECRET=$JWT_SECRET
DB_PATH=$ROOT_DIR/apps/database/anchormarks.db
EOF
  echo "✅ Generated .env file with secure JWT secret"
fi

# Generate self-signed SSL certs (for initial setup) and set env vars
SSL_DIR="$ROOT_DIR/apps/ssl"
SSL_KEY_PATH="$SSL_DIR/privkey.pem"
SSL_CERT_PATH="$SSL_DIR/fullchain.pem"
if [ ! -f "$SSL_KEY_PATH" ] || [ ! -f "$SSL_CERT_PATH" ]; then
  mkdir -p "$SSL_DIR"
  echo "🔐 Generating self-signed SSL certificate for initial setup..."
  CN="${HOST:-$(hostname -f 2>/dev/null || hostname)}"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_KEY_PATH" -out "$SSL_CERT_PATH" \
    -subj "/CN=${CN}"
  echo "✅ Generated self-signed cert and key in $SSL_DIR"
fi

# Append SSL paths to .env if they are not already present
if [ -f "$ROOT_DIR/.env" ]; then
  if ! grep -q '^SSL_KEY=' "$ROOT_DIR/.env" 2>/dev/null; then
    echo "SSL_KEY=$SSL_KEY_PATH" >> "$ROOT_DIR/.env"
  fi
  if ! grep -q '^SSL_CERT=' "$ROOT_DIR/.env" 2>/dev/null; then
    echo "SSL_CERT=$SSL_CERT_PATH" >> "$ROOT_DIR/.env"
  fi
fi

echo "👤 Setting permissions on application directories..."
# Ensure data and server directories are owned by UID 1001 so container's node user can write
chown -R 1001:1001 $ROOT_DIR/apps || chown -R $APP_USER:$APP_USER $ROOT_DIR/apps || true
chown -R 1001:1001 $ROOT_DIR/apps/database || true
if [ -f $ROOT_DIR/.env ]; then
  chmod 600 $ROOT_DIR/.env
fi
if [ -d "$ROOT_DIR/apps/ssl" ]; then
  chown -R 1001:1001 "$ROOT_DIR/apps/ssl" || true
  chmod 644 "$ROOT_DIR/apps/ssl/fullchain.pem" 2>/dev/null || true
  chmod 600 "$ROOT_DIR/apps/ssl/privkey.pem" 2>/dev/null || true
fi

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
  echo "   cd $ROOT_DIR && sudo -u $APP_USER node server/app.js"
  echo ""
  echo "   Or use npm:"
  echo "   cd $ROOT_DIR && sudo -u $APP_USER npm start"
fi

echo ""
echo "📋 Next steps:"
echo "   1. Configure Nginx (see tooling/deploy/nginx.conf)"
echo "   2. Set up SSL with Let's Encrypt"
echo "   3. Update CORS_ORIGIN in $ROOT_DIR/.env"
echo ""
