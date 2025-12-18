# Installation Guide for AnchorMarks

Complete step-by-step instructions for setting up AnchorMarks in various environments.

## Table of Contents

1. [Quick Start (5 Minutes)](#quick-start-5-minutes)
2. [Installation Methods](#installation-methods)
3. [Docker Installation](#docker-installation)
4. [Linux/macOS Installation](#linuxmacos-installation)
5. [Windows Installation](#windows-installation)
6. [Verification & Testing](#verification--testing)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start (5 Minutes)

Get AnchorMarks running in 5 minutes!

### Development (Fastest)

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm run dev

# 3. Open http://localhost:3000
```

### Docker (Easiest for Production)

```bash
# Start with Docker Compose (compose file is in `tooling/docker`)
docker compose -f tooling/docker/docker-compose.yml up -d

# Open http://localhost:3000
```

### Production Linux

```bash
# Run automated installer
sudo bash tooling/deploy/install.sh

# Follow prompts for domain setup
```

**Next Steps:**

1. Create an account (click "Sign Up")
2. Add your first bookmark (click "+ New Bookmark")
3. Organize with folders and tags

📘 **[View full documentation →](help.html)**

---

## Quick Start (Development)

The fastest way to get AnchorMarks running for development:

### Step 1: Prerequisites

Ensure you have Node.js 18+ installed:

```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

If not installed, download from https://nodejs.org/

### Step 2: Clone/Navigate to Project

```bash
cd AnchorMarks
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Development Server

```bash
npm run dev
```

### Step 5: Access the Application

Open http://localhost:3000 in your browser and create an account!

---

## Installation Methods

Choose the installation method that best suits your needs:

### Development

- **For local development & testing**
- [Quick Start](#quick-start-development)

### Production - Docker (Recommended)

- **For easy deployment & scaling**
- [Docker Installation](#docker-installation)

### Production - Direct Installation

- **For dedicated servers without Docker**
- [Linux/macOS Installation](#linuxmacos-installation)
- [Windows Installation](#windows-installation)

---

## Docker Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 1.29+ (optional but recommended)

### Option 1: Docker Compose (Easiest)

1. **Configure Environment**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your settings:**

   ```bash
   nano .env
   # Set: NODE_ENV=production, JWT_SECRET, CORS_ORIGIN, DB_PATH
   ```

3. **Start Services**

   ```bash
   # From project root
   docker compose -f tooling/docker/docker-compose.yml up -d
   # OR from the tooling/docker directory
   # cd tooling/docker && docker compose up -d
   ```

4. **Verify**

   ```bash
   docker compose -f tooling/docker/docker-compose.yml logs -f anchormarks
   curl http://localhost:3000/api/health
   ```

5. **Stop Services**
   ```bash
   docker compose -f tooling/docker/docker-compose.yml down
   ```

### Option 2: Manual Docker Build

1. **Build Image**

   ```bash
   # Build using the Dockerfile in tooling/docker
   docker build -t anchormarks:latest tooling/docker
   ```

2. **Create Data Volume** (optional, recommended)

   ```bash
   docker volume create anchormarks_data
   ```

3. **Run Container**

   ```bash
   docker run -d \
     --name anchormarks \
     --restart=always \
     -p 3000:3000 \
     -v anchormarks_data:/data \
     -e NODE_ENV=production \
     -e JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
     -e CORS_ORIGIN=https://yourdomain.com \
     -e DB_PATH=/data/anchormarks.db \
     anchormarks:latest
   ```

4. **Verify**

   ```bash
   docker logs -f anchormarks
   curl http://localhost:3000/api/health
   ```

5. **Stop Container**
   ```bash
   docker stop anchormarks
   ```

### Docker Commands Reference

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs -f anchormarks

# Execute command in container
docker exec -it anchormarks bash

# Stop container
docker stop anchormarks

# Start stopped container
docker start anchormarks

# Remove container
docker rm anchormarks

# Remove image
docker rmi anchormarks:latest
```

---

## Linux/macOS Installation

### Prerequisites

- Linux (Ubuntu 18.04+, Debian 10+, CentOS 7+) or macOS 10.14+
- sudo access (for systemd service)
- curl or wget
- nginx or other reverse proxy (optional but recommended)

### Step 1: Install Node.js

**Ubuntu/Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL:**

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**macOS (using Homebrew):**

```bash
brew install node@18
```

Verify installation:

```bash
node --version
npm --version
```

### Step 2: Clone/Copy AnchorMarks

```bash
# Clone from GitHub
git clone https://github.com/yourusername/anchormarks.git /opt/anchormarks

# Or copy from existing location
sudo cp -r /path/to/anchormarks /opt/anchormarks

# Set permissions
sudo chown -R $(whoami):$(whoami) /opt/anchormarks
cd /opt/anchormarks
```

### Step 3: Install Dependencies

```bash
npm ci --only=production
```

### Step 4: Configure Environment

```bash
cp .env.example .env
nano .env
```

Required configuration:

```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
JWT_SECRET=your-strong-random-secret-here
DB_PATH=/var/lib/anchormarks/anchormarks.db
CORS_ORIGIN=https://yourdomain.com
```

Generate a strong JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Create Data Directory

```bash
sudo mkdir -p /var/lib/anchormarks
sudo chown -R nobody:nogroup /var/lib/anchormarks
sudo chmod 700 /var/lib/anchormarks
```

### Step 6: Set Up systemd Service

```bash
# Copy service file
sudo cp tooling/deploy/anchormarks.service /etc/systemd/system/

# Edit if needed
sudo nano /etc/systemd/system/anchormarks.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable anchormarks
sudo systemctl start anchormarks

# Check status
sudo systemctl status anchormarks
```

View logs:

```bash
sudo journalctl -u anchormarks -f
```

### Step 7: Set Up Nginx Reverse Proxy

1. **Copy configuration**

   ```bash
   sudo cp tooling/deploy/nginx.conf /etc/nginx/sites-available/anchormarks
   ```

2. **Edit configuration**

   ```bash
   sudo nano /etc/nginx/sites-available/anchormarks
   # Change server_name to your domain
   ```

3. **Enable site**

   ```bash
   sudo ln -s /etc/nginx/sites-available/anchormarks /etc/nginx/sites-enabled/
   ```

4. **Test Nginx configuration**

   ```bash
   sudo nginx -t
   ```

5. **Reload Nginx**
   ```bash
   sudo systemctl reload nginx
   ```

### Step 8: Set Up SSL Certificate

**Using Let's Encrypt with Certbot:**

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is automatic
sudo systemctl status certbot.timer
```

### Step 9: Verify Installation

```bash
# Check if service is running
sudo systemctl status anchormarks

# Test API endpoint
curl https://yourdomain.com/api/health

# View logs
sudo journalctl -u anchormarks -n 20
```

### Service Management Commands

```bash
# Start service
sudo systemctl start anchormarks

# Stop service
sudo systemctl stop anchormarks

# Restart service
sudo systemctl restart anchormarks

# View status
sudo systemctl status anchormarks

# View logs (last 20 lines)
sudo journalctl -u anchormarks -n 20

# View logs (follow in real-time)
sudo journalctl -u anchormarks -f

# Enable auto-start on boot
sudo systemctl enable anchormarks

# Disable auto-start on boot
sudo systemctl disable anchormarks
```

---

## Windows Installation

### Prerequisites

- Windows 10/11 or Windows Server 2019+
- Node.js 18+ (64-bit)
- npm
- Text editor (Notepad++, VS Code, or similar)
- Optional: Docker Desktop for Windows

### Option 1: Using Node.js Directly

1. **Install Node.js**
   - Download from https://nodejs.org/
   - Run installer and follow instructions
   - Verify: Open PowerShell and run
     ```powershell
     node --version
     npm --version
     ```

2. **Clone/Navigate to Project**

   ```powershell
   cd C:\Users\YourUsername\Documents
   git clone https://github.com/yourusername/anchormarks
   # Or copy the folder from existing location
   ```

3. **Install Dependencies**

   ```powershell
   cd anchormarks
   npm install
   ```

4. **Configure Environment**

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   # Edit with your settings
   ```

5. **Start Application**

   ```powershell
   npm run dev
   ```

6. **Access Application**
   - Open http://localhost:3000

### Option 2: Using Docker Desktop

1. **Install Docker Desktop**
   - Download from https://www.docker.com/products/docker-desktop
   - Run installer and follow instructions

2. **Start Docker Desktop**
   - Search for "Docker Desktop" and launch

3. **Configure AnchorMarks**

   ```powershell
   cd C:\path\to\anchormarks
   Copy-Item .env.example .env
   # Edit .env with Notepad
   ```

4. **Build and Run**

   ```powershell
   docker compose -f tooling/docker/docker-compose.yml up -d
   ```

5. **Verify**

   ```powershell
   # Check if container is running
   docker ps

   # View logs
   docker compose -f tooling/docker/docker-compose.yml logs -f
   ```

### Option 3: Using Windows Services (Advanced)

1. **Install NSSM** (Non-Sucking Service Manager)

   ```powershell
   # Download from https://nssm.cc/download
   # Extract and add to PATH
   ```

2. **Install as Service**

   ```powershell
   nssm install AnchorMarks "C:\Program Files\nodejs\node.exe" "C:\path\to\anchormarks\server\app.js"
   nssm set AnchorMarks AppDirectory "C:\path\to\anchormarks"
   nssm set AnchorMarks AppEnvironmentExtra NODE_ENV=production
   nssm start AnchorMarks
   ```

3. **Manage Service**

   ```powershell
   # View status
   nssm status AnchorMarks

   # Stop service
   nssm stop AnchorMarks

   # Start service
   nssm start AnchorMarks
   ```

---

## Verification & Testing

### Health Check

Test if the application is responding:

```bash
# Development
curl http://localhost:3000/api/health

# Production
curl https://yourdomain.com/api/health
```

Expected response:

```json
{ "status": "ok" }
```

### Create Test Account

1. Open http://localhost:3000 (or your domain)
2. Click "Sign Up"
3. Enter username, email, password
4. Click "Create Account"

### Test API Key

1. Log in to the application
2. Go to Settings → API Access
3. Copy the API key
4. Test with:
   ```bash
   curl "http://localhost:3000/api/bookmarks" \
     -H "X-API-Key: your_api_key"
   ```

### Run Test Suite

```bash
npm test
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process (macOS/Linux)
kill -9 <PID>

# Or change PORT environment variable
PORT=3001 npm run dev
```

### Module Not Found

```bash
# Clear and reinstall
rm -rf node_modules
npm install
```

### Database Locked

```bash
# Check if another process is accessing database
lsof /path/to/anchormarks.db

# Restart application
npm run dev
```

### CORS Errors

```bash
# Check CORS_ORIGIN in .env
cat .env | grep CORS_ORIGIN

# For development, use:
CORS_ORIGIN=*

# For production, use your domain:
CORS_ORIGIN=https://yourdomain.com
```

### SSL Certificate Issues

```bash
# Verify Nginx configuration
sudo nginx -t

# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text

# Renew certificate manually
sudo certbot renew --dry-run
```

### Systemd Service Issues

```bash
# View service status
sudo systemctl status anchormarks

# View recent logs
sudo journalctl -u anchormarks -n 50

# Check service configuration
sudo nano /etc/systemd/system/anchormarks.service

# Reload systemd
sudo systemctl daemon-reload
```

### Docker Issues

```bash
# View container logs
docker logs -f anchormarks

# Check if container is running
docker ps | grep anchormarks

# Inspect container
docker inspect anchormarks

# Remove and rebuild
docker rm anchormarks
# Build using the Dockerfile in tooling/docker
docker build -t anchormarks:latest tooling/docker
docker compose -f tooling/docker/docker-compose.yml up -d
```

---

## Next Steps

After installation:

1. **Create Your First Bookmark** - Add some bookmarks to test the UI
2. **Set Up Browser Extension** - Install the extension for quick bookmarking
3. **Configure Flow Launcher** - Set up the Flow Launcher plugin if you use it
4. **Backup Database** - Set up automated backups for your SQLite database
5. **Enable HTTPS** - Follow Step 8 above to secure your installation

For more information, see:

- [README.md](README.md) - Features and usage
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
- [SECURITY.md](SECURITY.md) - Security best practices
- [ROADMAP.md](ROADMAP.md) - Planned features
