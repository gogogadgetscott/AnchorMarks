#!/bin/bash
# AnchorMarks Production Deployment Script
# Run this on your production server

set -e

echo "🔗 AnchorMarks Deployment Script"
echo "==============================="

# Configuration
APP_DIR="/opt/anchormarks"
APP_USER="anchormarks"
NODE_VERSION="20"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
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
mkdir -p $APP_DIR/public/favicons

echo "📋 Copying application files..."
cp -r server $APP_DIR/
cp -r public $APP_DIR/
cp package*.json $APP_DIR/

echo "📚 Installing dependencies..."
cd $APP_DIR
npm ci --only=production

echo "🔐 Setting up environment..."
if [ ! -f $APP_DIR/.env ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
JWT_SECRET=$JWT_SECRET
DB_PATH=$APP_DIR/server/anchormarks.db
EOF
  echo "✅ Generated .env file with secure JWT secret"
fi

echo "👤 Setting permissions..."
chown -R $APP_USER:$APP_USER $APP_DIR
chmod 600 $APP_DIR/.env

echo "🚀 Setting up systemd service..."
cp deploy/anchormarks.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable anchormarks
systemctl start anchormarks

echo ""
echo "✅ AnchorMarks deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure Nginx (see deploy/nginx.conf)"
echo "   2. Set up SSL with Let's Encrypt"
echo "   3. Update CORS_ORIGIN in $APP_DIR/.env"
echo ""
echo "🔧 Useful commands:"
echo "   systemctl status anchormarks    # Check status"
echo "   journalctl -u anchormarks -f    # View logs"
echo "   systemctl restart anchormarks   # Restart service"
echo ""
