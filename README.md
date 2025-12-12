# 🔗 AnchorMarks

A modern, self-hosted bookmark manager with browser sync, Flow Launcher integration, REST API, and AI-assisted tooling baked into development.

## ✨ Features

- **📚 Organize Bookmarks** - Create folders with custom colors
- **🔍 Fast Search** - Full-text search with intelligent ranking
- **⭐ Favorites** - Quick access to important bookmarks
- **🏷️ Tags** - Categorize and filter bookmarks
- **🌙 Dark Mode** - Beautiful light and dark themes
- **📱 Responsive** - Works on desktop, tablet, and mobile
- **🔄 Browser Sync** - Chrome/Edge/Firefox extension
- **🔌 API Access** - REST API for Flow Launcher and other tools
- **📥 Import/Export** - HTML & JSON support
- **🖼️ Auto Favicons** - Automatic favicon fetching and caching
- **🤖 AI-Supported Build** - Built with AI-assisted workflows for faster iteration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (download from https://nodejs.org/)
- npm

### Installation

```bash
cd AnchorMarks
npm install
npm start
```

Visit `http://localhost:3000` and create an account!

---

## 🔧 Configuration

Create your own `.env` from `.env.example` before running in production. Required values:

- `JWT_SECRET` - a long, random string (the app refuses to start in production with the placeholder)
- `CORS_ORIGIN` - comma-separated allowed origins; do not use `*` in production
- `DB_PATH` - absolute path for the SQLite database when using a volume/mounted directory

In development, defaults are permissive; production enforces the settings above.

---

## 🎯 Flow Launcher Plugin

Use AnchorMarks directly from Flow Launcher!

### Installation

1. Copy `flow-launcher-plugin` folder to:
   ```
   %APPDATA%\FlowLauncher\Plugins\AnchorMarks-1.0.0
   ```

2. Install Python dependency:
   ```
   pip install requests
   ```

3. Restart Flow Launcher

4. Configure: `lv config http://localhost:3000 your_api_key`

### Usage

| Command | Description |
|---------|-------------|
| `lv` | Show top/recent bookmarks |
| `lv <query>` | Search bookmarks |
| `lv add <url>` | Add a new bookmark |
| `lv open` | Open AnchorMarks in browser |

---

## 🌐 Browser Extension

### Installation (Developer Mode)

1. Open Chrome/Edge → Extensions → Enable "Developer mode"
2. Click "Load unpacked" → Select `extension` folder
3. Click extension icon → Enter API key → Connect

### Features

- **Add Current Page** - Quick-add with one click
- **Push Bookmarks** - Sync browser bookmarks to AnchorMarks
- **Right-Click Menu** - "Add to AnchorMarks" on any link

---

## 📡 API Documentation

### Authentication

```
X-API-Key: lv_xxxxxxxxxxxxxxxxxxxxxxxx
```

Find your API key in Settings → API Access.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quick-search?q=query` | Search (Flow Launcher optimized) |
| GET | `/api/bookmarks` | Get all bookmarks |
| POST | `/api/bookmarks` | Create bookmark |
| PUT | `/api/bookmarks/:id` | Update bookmark |
| DELETE | `/api/bookmarks/:id` | Delete bookmark |
| GET | `/api/folders` | Get all folders |
| GET | `/api/health` | Health check |

### Example: Create Bookmark

```bash
curl -X POST http://localhost:3000/api/bookmarks \
  -H "X-API-Key: lv_your_key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "title": "Example"}'
```

---

## 🖼️ Automatic Favicon Fetching

AnchorMarks automatically fetches and caches favicons:

1. **On Bookmark Creation** - Immediately queues favicon fetch
2. **Background Processing** - Fetches missing favicons every 30 seconds
3. **Multiple Sources** - Tries Google, DuckDuckGo, and direct site
4. **Local Caching** - Stores favicons locally for faster loading


---

## 🚀 Production Deployment

### Option 1: Docker (Recommended)

```bash
# Using Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t anchormarks .
docker run -d -p 3000:3000 -v anchormarks_data:/data anchormarks
```

### Option 2: Direct Installation (Linux)

```bash
# Run the installation script
sudo bash deploy/install.sh

# Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/anchormarks
sudo ln -s /etc/nginx/sites-available/anchormarks /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d bookmarks.yourdomain.com
```

### Option 3: Manual Setup

1. Copy files to server
2. Install dependencies: `npm ci --only=production`
3. Create `.env` from `.env.example`
4. Set up as systemd service (see `deploy/anchormarks.service`)
5. Configure reverse proxy (Nginx/Caddy)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `JWT_SECRET` | anchormarks-secret-key-change-in-production | Development default; set a strong value in production |
| `DB_PATH` | ./server/anchormarks.db | SQLite database file path (use an absolute path in production) |
| `CORS_ORIGIN` | * (development) | Allowed origins; required and cannot be * in production |

---

## 📁 Project Structure

```
AnchorMarks/
├── server/
│   └── index.js          # Express API server
├── public/
│   ├── index.html        # Main application
│   ├── css/styles.css    # Styles
│   ├── js/app.js         # Frontend JavaScript
│   └── favicons/         # Cached favicons
├── extension/            # Browser extension
├── flow-launcher-plugin/ # Flow Launcher plugin
├── deploy/
│   ├── nginx.conf        # Nginx configuration
│   ├── anchormarks.service # Systemd service
│   └── install.sh        # Deployment script
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 🔐 Security

- **Password Hashing** - bcrypt with salt rounds
- **JWT Authentication** - 30-day token expiry
- **API Keys** - Separate keys for external access
- **Rate Limiting** - 100 requests/minute in production
- **Security Headers** - XSS, clickjacking protection
- **Local Storage** - SQLite with WAL mode
- **SSRF Guard** - Favicon fetching and dead-link checks skip private/loopback addresses in production

## ✅ Testing

- Run automated checks: `npm test` (uses an isolated SQLite database)
- Recommended before release: `npm test -- --runInBand` on CI to avoid timing variance

---

## 📄 License

MIT License - feel free to use, modify, and distribute.

---

Built with ❤️ and AI assistance for bookmark enthusiasts
