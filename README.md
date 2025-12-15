# 🔗 AnchorMarks

A modern, self-hosted bookmark manager with browser sync, Flow Launcher integration, REST API, and SQLite backend.

## ✨ Features

- **📚 Organize Bookmarks** - Create folders with custom colors
- **🔍 Fast Search** - Full-text search with intelligent ranking
- **🎯 Advanced Filtering** - Full-width filter bar with folder/tag counts (see [Help](public/help.html#search))
- **⭐ Favorites** - Quick access to important bookmarks
- **🏷️ Tags** - Categorize and filter bookmarks
- **🌙 Dark Mode** - Beautiful light and dark themes
- **📱 Responsive** - Works on desktop, tablet, and mobile
- **🔄 Browser Sync** - Chrome/Edge/Firefox extension
- **🔌 API Access** - REST API for Flow Launcher and other tools
- **📥 Import/Export** - HTML & JSON support
- 🖼️ **Auto Favicons** - Automatic favicon fetching and caching

## 📸 Screenshots

| Dashboard | Search | Mobile |
|:---:|:---:|:---:|
| <img src="screenshots/anchormarks_dashboard_1765737807089.png" width="300" alt="Dashboard"> | <img src="screenshots/anchormarks_search_1765737823968.png" width="300" alt="Search"> | <img src="screenshots/anchormarks_mobile_1765737840238.png" width="200" alt="Mobile"> |

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
- **Auth & CSRF Flow** - Developer reference: [public/help.html#developer-auth-csrf](public/help.html#developer-auth-csrf)

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

## 📜 License

MIT License - use, modify, and distribute freely.

---

**[View full documentation in Help →](public/help.html)**

