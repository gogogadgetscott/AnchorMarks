# 🔗 AnchorMarks

A modern, self-hosted bookmark manager with browser sync, Flow Launcher integration, REST API, and SQLite backend.

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

## 🚀 Quick Start

```bash
# Install and start development server
npm install
npm run dev

# Visit http://localhost:3000
```

📘 **[View full documentation →](public/help.html)** | [Installation Guide](INSTALL.md)

## 🔧 Configuration

**Development** (default):
```bash
npm run dev  # Runs on localhost:3000
```

**Production**:
```bash
cp .env.example .env
# Edit .env with your settings
npm run prod
```

See [INSTALL.md](INSTALL.md) for detailed deployment options.

## 📝 Documentation

- **[Help & Documentation](public/help.html)** - Complete user guide with all features (in-app)
- **[INSTALL.md](INSTALL.md)** - Installation and quick start guide
- **[SECURITY.md](SECURITY.md)** - Security policy and best practices
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guidelines

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 🔐 Security

- **Password Hashing** - bcryptjs
- **JWT Authentication** - Secure token-based auth
- **CSRF Protection** - Tokens for state mutations
- **User Isolation** - Per-user data filtering
- **Input Validation** - URLs, names, tags sanitized
- **SSRF Guard** - Private IP blocking

See [SECURITY.md](SECURITY.md) for details.

## �� License

MIT License - use, modify, and distribute freely.

---

**[View full documentation in Help →](public/help.html)**
