require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const http = require('http');
const fs = require('fs');
const dns = require('dns').promises;
const net = require('net');
const helmet = require('helmet');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_JWT_SECRET = 'anchormarks-secret-key-change-in-production';
const INSECURE_SECRETS = [
    DEFAULT_JWT_SECRET,
    'change-this-to-a-secure-secret',
    'your-super-secret-jwt-key-change-this-to-a-random-string'
];

function validateSecurityConfig() {
    if (NODE_ENV !== 'production') return;

    if (!process.env.JWT_SECRET || INSECURE_SECRETS.includes(process.env.JWT_SECRET)) {
        throw new Error('JWT_SECRET must be set to a strong value in production');
    }

    if (!process.env.CORS_ORIGIN) {
        throw new Error('CORS_ORIGIN must be configured in production');
    }
}

function resolveCorsOrigin() {
    if (NODE_ENV !== 'production') return true;

    const origin = process.env.CORS_ORIGIN;
    if (origin.trim() === '*') {
        throw new Error('CORS_ORIGIN cannot be * in production');
    }
    return origin.split(',').map(o => o.trim()).filter(Boolean);
}

// Network safety helpers
const PRIVATE_IPV4 = [
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./
];
const PRIVATE_IPV6 = [/^fc/i, /^fd/i, /^fe80/i, /^::1$/];

function isPrivateIp(ip) {
    if (!ip) return false;
    if (net.isIP(ip) === 6) return PRIVATE_IPV6.some(re => re.test(ip));
    return PRIVATE_IPV4.some(re => re.test(ip));
}

async function isPrivateAddress(url) {
    try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) return true; // Disallow non-http(s)

        const hostname = urlObj.hostname;
        if (hostname === 'localhost') return true;
        if (net.isIP(hostname)) return isPrivateIp(hostname);

        const records = await dns.lookup(hostname, { all: true });
        return records.some(r => isPrivateIp(r.address));
    } catch (err) {
        // If resolution fails, be conservative in production
        return NODE_ENV === 'production';
    }
}

validateSecurityConfig();

// API key scope whitelist (method + path regex)
const API_KEY_WHITELIST = [
    { method: 'GET', path: /^\/api\/quick-search/ },
    { method: 'GET', path: /^\/api\/bookmarks\/?$/ },
    { method: 'POST', path: /^\/api\/bookmarks\/?$/ },
    { method: 'GET', path: /^\/api\/folders\/?$/ }
];

function isApiKeyAllowed(req) {
    return API_KEY_WHITELIST.some(rule => rule.method === req.method && rule.path.test(req.path));
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const ENABLE_BACKGROUND_JOBS = NODE_ENV !== 'test';
const ENABLE_FAVICON_BACKGROUND_JOBS = false; // Only fetch favicons on import/save

// Database path - use environment variable for production
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'anchormarks.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    api_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_id TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    favicon TEXT,
    favicon_local TEXT,
    tags TEXT,
    position INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    last_clicked DATETIME,
    is_dead INTEGER DEFAULT 0,
    last_checked DATETIME,
    content_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id);
  CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
  CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

  CREATE TABLE IF NOT EXISTS smart_collections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'filter',
    color TEXT DEFAULT '#6366f1',
    filters TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Ensure favicons directory exists
const FAVICONS_DIR = path.join(__dirname, '../public/favicons');
if (!fs.existsSync(FAVICONS_DIR)) {
    fs.mkdirSync(FAVICONS_DIR, { recursive: true });
}

// ============== FAVICON FETCHING ==============

// Cache for in-progress favicon fetches
const faviconFetchQueue = new Map();

async function fetchFavicon(url, bookmarkId) {
    try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) return null;

        // Block private/loopback targets in production to avoid SSRF
        if (NODE_ENV === 'production' && await isPrivateAddress(url)) {
            return null;
        }
        const domain = urlObj.hostname;
        const faviconFilename = `${domain.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        const localPath = path.join(FAVICONS_DIR, faviconFilename);
        const publicPath = `/favicons/${faviconFilename}`;

        // Check if already cached locally
        if (fs.existsSync(localPath)) {
            db.prepare('UPDATE bookmarks SET favicon_local = ?, favicon = ? WHERE id = ?')
                .run(publicPath, publicPath, bookmarkId);
            return publicPath;
        }

        // Check if already being fetched
        if (faviconFetchQueue.has(domain)) {
            return faviconFetchQueue.get(domain);
        }

        // Create fetch promise
        const fetchPromise = new Promise((resolve) => {
            // Try multiple favicon sources
            const sources = [
                `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
                `https://icons.duckduckgo.com/ip3/${domain}.ico`,
                `https://${domain}/favicon.ico`
            ];

            tryFetchFavicon(sources, 0, localPath, (success) => {
                faviconFetchQueue.delete(domain);
                if (success) {
                    db.prepare('UPDATE bookmarks SET favicon_local = ?, favicon = ? WHERE id = ?')
                        .run(publicPath, publicPath, bookmarkId);
                    resolve(publicPath);
                } else {
                    db.prepare('UPDATE bookmarks SET favicon_local = NULL, favicon = NULL WHERE id = ?')
                        .run(bookmarkId);
                    resolve(null);
                }
            });
        });

        faviconFetchQueue.set(domain, fetchPromise);
        return fetchPromise;
    } catch (err) {
        console.error('Favicon fetch error:', err);
        return null;
    }
}

function tryFetchFavicon(sources, index, localPath, callback) {
    if (index >= sources.length) {
        callback(false);
        return;
    }

    const url = sources[index];
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, { timeout: 5000 }, (response) => {
        if (response.statusCode === 200) {
            const fileStream = fs.createWriteStream(localPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                // Check if file is valid (has content)
                const stats = fs.statSync(localPath);
                if (stats.size > 100) {
                    callback(true);
                } else {
                    fs.unlinkSync(localPath);
                    tryFetchFavicon(sources, index + 1, localPath, callback);
                }
            });
        } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            // Follow redirect
            const redirectUrl = response.headers.location;
            const redirectSources = [redirectUrl, ...sources.slice(index + 1)];
            tryFetchFavicon(redirectSources, 0, localPath, callback);
        } else {
            tryFetchFavicon(sources, index + 1, localPath, callback);
        }
    });

    request.on('error', () => {
        tryFetchFavicon(sources, index + 1, localPath, callback);
    });

    request.on('timeout', () => {
        request.destroy();
        tryFetchFavicon(sources, index + 1, localPath, callback);
    });
}

// Background job to fetch missing favicons
function processFaviconQueue() {
    const bookmarks = db.prepare(`
    SELECT id, url FROM bookmarks 
    WHERE favicon_local IS NULL AND url IS NOT NULL 
    LIMIT 10
  `).all();

    for (const bookmark of bookmarks) {
        fetchFavicon(bookmark.url, bookmark.id).catch(console.error);
    }
}

if (ENABLE_BACKGROUND_JOBS && ENABLE_FAVICON_BACKGROUND_JOBS) {
    // Run favicon queue processor every 30 seconds
    setInterval(processFaviconQueue, 30000);
    // Initial run after 5 seconds
    setTimeout(processFaviconQueue, 5000);
}

// ============== MIDDLEWARE ==============

// Security headers for production
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"]
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: cspDirectives
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

if (NODE_ENV === 'production') {
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    });
}

// CORS configuration
const corsOptions = {
    origin: resolveCorsOrigin(),
    credentials: true
};
app.use(cors(corsOptions));

// Rate limiting for API
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per minute

function rateLimiter(req, res, next) {
    if (NODE_ENV !== 'production') return next();

    const key = req.ip;
    const now = Date.now();

    if (!requestCounts.has(key)) {
        requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
        const record = requestCounts.get(key);
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + RATE_LIMIT_WINDOW;
        } else {
            record.count++;
            if (record.count > RATE_LIMIT_MAX) {
                return res.status(429).json({ error: 'Too many requests' });
            }
        }
    }
    next();
}

app.use('/api', rateLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: NODE_ENV === 'production' ? '1d' : 0
}));

// Request logging
app.use((req, res, next) => {
    if (NODE_ENV === 'development') {
        console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    }
    next();
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];

    // Scoped API key support (Flow Launcher / extension)
    if (apiKey) {
        const user = db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
        if (user) {
            if (!isApiKeyAllowed(req)) {
                return res.status(403).json({ error: 'API key not permitted for this endpoint' });
            }
            req.user = user;
            req.authType = 'api-key';
            return next();
        }
    }

    // JWT bearer fallback
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (!req.user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.authType = 'jwt';
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ============== HEALTH CHECK ==============

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// ============== AUTH ROUTES ==============

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existingUser = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email, username);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = uuidv4();
        const apiKey = 'lv_' + uuidv4().replace(/-/g, '');

        db.prepare('INSERT INTO users (id, username, email, password, api_key) VALUES (?, ?, ?, ?, ?)')
            .run(userId, username, email.toLowerCase(), hashedPassword, apiKey);

        // Create default folder
        const defaultFolderId = uuidv4();
        db.prepare('INSERT INTO folders (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)')
            .run(defaultFolderId, userId, 'My Bookmarks', '#6366f1', 'folder');

        // Create example bookmarks in the default folder
        createExampleBookmarks(userId, defaultFolderId);

        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: userId, username, email, api_key: apiKey }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email, api_key: user.api_key }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            api_key: req.user.api_key
        }
    });
});

// Regenerate API key
app.post('/api/auth/regenerate-key', authenticateToken, (req, res) => {
    const newApiKey = 'lv_' + uuidv4().replace(/-/g, '');
    db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(newApiKey, req.user.id);
    res.json({ api_key: newApiKey });
});

// ============== USER SETTINGS ROUTES ==============

// Reset bookmarks to example bookmarks
app.post('/api/settings/reset-bookmarks', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;

        // Delete all existing bookmarks for this user
        db.prepare('DELETE FROM bookmarks WHERE user_id = ?').run(userId);

        // Delete all existing folders for this user
        db.prepare('DELETE FROM folders WHERE user_id = ?').run(userId);

        // Create default folder
        const defaultFolderId = uuidv4();
        db.prepare('INSERT INTO folders (id, user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)')
            .run(defaultFolderId, userId, 'My Bookmarks', '#6366f1', 'folder', 1);

        // Create example bookmarks
        const bookmarks = createExampleBookmarks(userId, defaultFolderId);

        res.json({
            success: true,
            message: 'Bookmarks reset to examples',
            bookmarks_created: bookmarks.length,
            folder_id: defaultFolderId
        });
    } catch (err) {
        console.error('Reset bookmarks error:', err);
        res.status(500).json({ error: 'Failed to reset bookmarks' });
    }
});

// ============== FOLDER ROUTES ==============

// Get all folders
app.get('/api/folders', authenticateToken, (req, res) => {
    const folders = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY position').all(req.user.id);
    res.json(folders);
});

// Create folder
app.post('/api/folders', authenticateToken, (req, res) => {
    const { name, parent_id, color, icon } = req.body;
    const id = uuidv4();

    const maxPos = db.prepare('SELECT MAX(position) as max FROM folders WHERE user_id = ?').get(req.user.id);
    const position = (maxPos.max || 0) + 1;

    db.prepare('INSERT INTO folders (id, user_id, parent_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.user.id, parent_id || null, name, color || '#6366f1', icon || 'folder', position);

    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    res.json(folder);
});

// Update folder
app.put('/api/folders/:id', authenticateToken, (req, res) => {
    const { name, parent_id, color, icon, position } = req.body;

    db.prepare(`
    UPDATE folders SET 
      name = COALESCE(?, name),
      parent_id = COALESCE(?, parent_id),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      position = COALESCE(?, position),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, parent_id, color, icon, position, req.params.id, req.user.id);

    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
    res.json(folder);
});

// Delete folder
app.delete('/api/folders/:id', authenticateToken, (req, res) => {
    db.prepare('UPDATE bookmarks SET folder_id = NULL WHERE folder_id = ? AND user_id = ?')
        .run(req.params.id, req.user.id);

    db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
});

// ============== SMART COLLECTIONS ==============

// Get all smart collections
app.get('/api/collections', authenticateToken, (req, res) => {
    const collections = db.prepare('SELECT * FROM smart_collections WHERE user_id = ? ORDER BY position').all(req.user.id);
    res.json(collections.map(c => ({ ...c, filters: JSON.parse(c.filters) })));
});

// Create smart collection
app.post('/api/collections', authenticateToken, (req, res) => {
    const { name, icon, color, filters } = req.body;
    const id = uuidv4();

    const maxPos = db.prepare('SELECT MAX(position) as max FROM smart_collections WHERE user_id = ?').get(req.user.id);
    const position = (maxPos.max || 0) + 1;

    db.prepare('INSERT INTO smart_collections (id, user_id, name, icon, color, filters, position) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.user.id, name, icon || 'filter', color || '#6366f1', JSON.stringify(filters), position);

    const collection = db.prepare('SELECT * FROM smart_collections WHERE id = ?').get(id);
    res.json({ ...collection, filters: JSON.parse(collection.filters) });
});

// Update smart collection
app.put('/api/collections/:id', authenticateToken, (req, res) => {
    const { name, icon, color, filters, position } = req.body;

    db.prepare(`
    UPDATE smart_collections SET 
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      color = COALESCE(?, color),
      filters = COALESCE(?, filters),
      position = COALESCE(?, position)
    WHERE id = ? AND user_id = ?
  `).run(name, icon, color, filters ? JSON.stringify(filters) : null, position, req.params.id, req.user.id);

    const collection = db.prepare('SELECT * FROM smart_collections WHERE id = ?').get(req.params.id);
    res.json({ ...collection, filters: JSON.parse(collection.filters) });
});

// Delete smart collection
app.delete('/api/collections/:id', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM smart_collections WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
});

// Get bookmarks matching a smart collection
app.get('/api/collections/:id/bookmarks', authenticateToken, (req, res) => {
    const collection = db.prepare('SELECT * FROM smart_collections WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!collection) {
        return res.status(404).json({ error: 'Collection not found' });
    }

    const filters = JSON.parse(collection.filters);
    let query = 'SELECT * FROM bookmarks WHERE user_id = ?';
    const params = [req.user.id];

    if (filters.tags && filters.tags.length > 0) {
        const tagConditions = filters.tags.map(() => 'tags LIKE ?').join(' OR ');
        query += ` AND (${tagConditions})`;
        filters.tags.forEach(tag => params.push(`%${tag}%`));
    }

    if (filters.search) {
        query += ' AND (title LIKE ? OR url LIKE ? OR description LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.domain) {
        query += ' AND url LIKE ?';
        params.push(`%${filters.domain}%`);
    }

    if (filters.favorites) {
        query += ' AND is_favorite = 1';
    }

    if (filters.untagged) {
        query += ' AND (tags IS NULL OR tags = "")';
    }

    query += ' ORDER BY created_at DESC';

    const bookmarks = db.prepare(query).all(...params);
    res.json(bookmarks);
});

// ============== BOOKMARK ROUTES ==============

// Get all bookmarks (with optional pagination)
app.get('/api/bookmarks', authenticateToken, (req, res) => {
    const { folder_id, search, favorites, tags, limit, offset } = req.query;

    let query = 'SELECT * FROM bookmarks WHERE user_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ?';
    const params = [req.user.id];

    if (folder_id) {
        query += ' AND folder_id = ?';
        countQuery += ' AND folder_id = ?';
        params.push(folder_id);
    }

    if (favorites === 'true') {
        query += ' AND is_favorite = 1';
        countQuery += ' AND is_favorite = 1';
    }

    if (search) {
        query += ' AND (title LIKE ? OR url LIKE ? OR description LIKE ? OR tags LIKE ?)';
        countQuery += ' AND (title LIKE ? OR url LIKE ? OR description LIKE ? OR tags LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (tags) {
        query += ' AND tags LIKE ?';
        countQuery += ' AND tags LIKE ?';
        params.push(`%${tags}%`);
    }

    query += ' ORDER BY position, created_at DESC';

    // If pagination requested, add LIMIT and OFFSET
    if (limit) {
        const total = db.prepare(countQuery).get(...params).total;
        query += ` LIMIT ${parseInt(limit)}`;
        if (offset) {
            query += ` OFFSET ${parseInt(offset)}`;
        }
        const bookmarks = db.prepare(query).all(...params);
        return res.json({ bookmarks, total, limit: parseInt(limit), offset: parseInt(offset) || 0 });
    }

    const bookmarks = db.prepare(query).all(...params);
    res.json(bookmarks);
});

// Get single bookmark
app.get('/api/bookmarks/:id', authenticateToken, (req, res) => {
    const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);

    if (!bookmark) {
        return res.status(404).json({ error: 'Bookmark not found' });
    }
    res.json(bookmark);
});

// Create bookmark
app.post('/api/bookmarks', authenticateToken, async (req, res) => {
    const { title, url, description, folder_id, tags } = req.body;
    const id = uuidv4();

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const maxPos = db.prepare('SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?').get(req.user.id);
    const position = (maxPos.max || 0) + 1;

    // Favicons are fetched asynchronously and served from the local cache
    const faviconUrl = null;

    // Auto-detect content type
    const contentType = detectContentType(url);

    db.prepare(`
    INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, tags, position, content_type) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, folder_id || null, title || url, url, description || null, faviconUrl, tags || null, position, contentType);

    // Trigger async favicon fetch
    fetchFavicon(url, id).catch(console.error);

    const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
    res.json(bookmark);
});

// Detect content type from URL
function detectContentType(url) {
    try {
        const urlLower = url.toLowerCase();
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;

        // Video platforms
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be') ||
            hostname.includes('vimeo.com') || hostname.includes('dailymotion.com') ||
            hostname.includes('twitch.tv')) {
            return 'video';
        }

        // Social/tweets
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return 'tweet';
        }

        // PDF
        if (pathname.endsWith('.pdf')) {
            return 'pdf';
        }

        // Images
        if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathname)) {
            return 'image';
        }

        // GitHub
        if (hostname.includes('github.com')) {
            return 'repo';
        }

        // News/articles
        if (hostname.includes('medium.com') || hostname.includes('dev.to') ||
            hostname.includes('substack.com') || hostname.includes('hackernews') ||
            hostname.includes('reddit.com')) {
            return 'article';
        }

        // Documentation
        if (hostname.includes('docs.') || pathname.includes('/docs/') ||
            pathname.includes('/documentation/')) {
            return 'docs';
        }

        // Default
        return 'link';
    } catch (e) {
        return 'link';
    }
}

// Tag helpers
function parseTags(tagsString) {
    if (!tagsString) return [];
    if (Array.isArray(tagsString)) return tagsString.map(t => String(t).trim()).filter(Boolean);
    return tagsString
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
}

function mergeTags(existing, incoming) {
    const set = new Set([...parseTags(existing), ...parseTags(incoming)]);
    return Array.from(set);
}

function stringifyTags(tagsArray) {
    return parseTags(tagsArray).join(', ');
}

// Update bookmark
app.put('/api/bookmarks/:id', authenticateToken, (req, res) => {
    const { title, url, description, folder_id, tags, is_favorite, position, favicon } = req.body;

    db.prepare(`
    UPDATE bookmarks SET 
      title = COALESCE(?, title),
      url = COALESCE(?, url),
      description = COALESCE(?, description),
      folder_id = COALESCE(?, folder_id),
      tags = COALESCE(?, tags),
      is_favorite = COALESCE(?, is_favorite),
      position = COALESCE(?, position),
      favicon = COALESCE(?, favicon),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(title, url, description, folder_id, tags, is_favorite, position, favicon, req.params.id, req.user.id);

    const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
    res.json(bookmark);
});

// Refresh favicon for a bookmark
app.post('/api/bookmarks/:id/refresh-favicon', authenticateToken, async (req, res) => {
    const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);

    if (!bookmark) {
        return res.status(404).json({ error: 'Bookmark not found' });
    }

    // Reset local favicon to trigger re-fetch
    db.prepare('UPDATE bookmarks SET favicon_local = NULL WHERE id = ?').run(bookmark.id);

    const newFavicon = await fetchFavicon(bookmark.url, bookmark.id);
    res.json({ favicon: newFavicon });
});

// Delete bookmark
app.delete('/api/bookmarks/:id', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
});

// ============== TAG ROUTES ==============

// List tags with counts (supports hierarchy by name delimiter e.g. parent/child)
app.get('/api/tags', authenticateToken, (req, res) => {
    const rows = db.prepare("SELECT tags FROM bookmarks WHERE user_id = ? AND tags IS NOT NULL AND tags != ''").all(req.user.id);
    const counts = {};

    rows.forEach(row => {
        parseTags(row.tags).forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });

    const tags = Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .map(name => ({
            name,
            count: counts[name],
            parent: name.includes('/') ? name.split('/').slice(0, -1).join('/') || null : null
        }));

    res.json(tags);
});

// Suggest tags from URL/domain and prior usage
app.get('/api/tags/suggest', authenticateToken, (req, res) => {
    const { url } = req.query;
    if (!url) return res.json([]);

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        const domainLike = `%${hostname}%`;
        const counts = {};
        const bump = (tag, weight = 1) => {
            if (!tag) return;
            const key = tag.toLowerCase();
            counts[key] = (counts[key] || 0) + weight;
        };

        // Fetch a slice of bookmarks for TF-IDF style scoring
        const allRows = db.prepare('SELECT title, tags, url FROM bookmarks WHERE user_id = ? LIMIT 800').all(req.user.id);

        // Existing tags on same domain + compute doc frequencies for title terms
        const docFreq = {};
        const tokenizer = (text) => {
            return (text || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s\-/]/g, ' ')
                .split(/\s+/)
                .map(t => t.trim())
                .filter(t => t.length > 2 && t.length < 30);
        };

        allRows.forEach(row => {
            const tokens = new Set(tokenizer(row.title));
            tokens.forEach(tok => { docFreq[tok] = (docFreq[tok] || 0) + 1; });
        });

        const totalDocs = allRows.length || 1;

        allRows.forEach(row => {
            const urlMatch = row.url && row.url.includes(hostname);
            if (urlMatch) {
                parseTags(row.tags).forEach(t => bump(t, 2.5));
                try {
                    const rowHost = new URL(row.url).hostname.replace(/^www\./, '');
                    if (rowHost === hostname) {
                        parseTags(row.tags).forEach(t => bump(t, 3.5));
                    }
                } catch { /* ignore */ }
            }

            // TF-IDF style weights from titles
            const tfCounts = {};
            tokenizer(row.title).forEach(tok => { tfCounts[tok] = (tfCounts[tok] || 0) + 1; });
            Object.entries(tfCounts).forEach(([tok, tf]) => {
                const df = docFreq[tok] || 1;
                const idf = Math.log((totalDocs + 1) / (df + 1)) + 1; // smoothed
                const weight = tf * idf;
                if (urlMatch) bump(tok, weight * 1.2); else bump(tok, weight * 0.6);
            });
        });

        // Domain-derived keywords
        const stopwords = new Set(['www', 'com', 'net', 'org', 'app', 'io', 'dev']);
        hostname.split('.').forEach(part => {
            if (part && part.length > 2 && !stopwords.has(part)) bump(part, 1.5);
        });

        // Path-derived keywords
        urlObj.pathname.split('/')
            .map(p => p.trim())
            .filter(p => p && p.length > 2 && p.length < 40)
            .slice(0, 4)
            .forEach(part => {
                const clean = part.replace(/[-_]+/g, ' ').toLowerCase();
                clean.split(' ').forEach(seg => {
                    if (seg && seg.length > 2) bump(seg, 1);
                });
            });

        const suggestions = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name)
            .slice(0, 15);

        res.json(suggestions);
    } catch (err) {
        res.json([]);
    }
});

// Bulk add tags to bookmarks
app.post('/api/tags/bulk-add', authenticateToken, (req, res) => {
    const { bookmark_ids, tags } = req.body;
    if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
        return res.status(400).json({ error: 'bookmark_ids and tags are required' });
    }

    const normalizedTags = parseTags(tags);
    const updated = [];
    const getBookmark = db.prepare('SELECT id, tags FROM bookmarks WHERE id = ? AND user_id = ?');
    const updateBookmark = db.prepare('UPDATE bookmarks SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');

    bookmark_ids.forEach(id => {
        const bm = getBookmark.get(id, req.user.id);
        if (!bm) return;
        const merged = mergeTags(bm.tags, normalizedTags);
        updateBookmark.run(stringifyTags(merged), id, req.user.id);
        updated.push(id);
    });

    res.json({ updated });
});

// Bulk remove tags from bookmarks
app.post('/api/tags/bulk-remove', authenticateToken, (req, res) => {
    const { bookmark_ids, tags } = req.body;
    if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
        return res.status(400).json({ error: 'bookmark_ids and tags are required' });
    }

    const removeSet = new Set(parseTags(tags).map(t => t.toLowerCase()));
    const updated = [];
    const getBookmark = db.prepare('SELECT id, tags FROM bookmarks WHERE id = ? AND user_id = ?');
    const updateBookmark = db.prepare('UPDATE bookmarks SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');

    bookmark_ids.forEach(id => {
        const bm = getBookmark.get(id, req.user.id);
        if (!bm || !bm.tags) return;
        const filtered = parseTags(bm.tags).filter(t => !removeSet.has(t.toLowerCase()));
        updateBookmark.run(filtered.length ? stringifyTags(filtered) : null, id, req.user.id);
        updated.push(id);
    });

    res.json({ updated });
});

// Rename/merge a tag across all bookmarks
app.post('/api/tags/rename', authenticateToken, (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) {
        return res.status(400).json({ error: 'from and to are required' });
    }

    const rows = db.prepare('SELECT id, tags FROM bookmarks WHERE user_id = ? AND tags LIKE ?').all(req.user.id, `%${from}%`);
    const updateBookmark = db.prepare('UPDATE bookmarks SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
    let updated = 0;

    rows.forEach(row => {
        const tagsArr = parseTags(row.tags);
        let changed = false;
        const renamed = tagsArr.map(t => {
            if (t === from) {
                changed = true;
                return to;
            }
            return t;
        });

        if (changed) {
            const merged = mergeTags(renamed, []);
            updateBookmark.run(stringifyTags(merged), row.id, req.user.id);
            updated += 1;
        }
    });

    res.json({ updated });
});

// Track bookmark click
app.post('/api/bookmarks/:id/click', authenticateToken, (req, res) => {
    db.prepare(`
    UPDATE bookmarks SET 
      click_count = click_count + 1,
      last_clicked = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

    res.json({ success: true });
});

// ============== IMPORT/EXPORT ROUTES ==============

app.post('/api/import/html', authenticateToken, (req, res) => {
    try {
        const { html } = req.body;
        const imported = parseBookmarkHtml(html, req.user.id);
        res.json({ imported: imported.length, bookmarks: imported });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Failed to parse bookmarks' });
    }
});

app.post('/api/import/json', authenticateToken, (req, res) => {
    try {
        const { bookmarks } = req.body;
        const imported = [];

        for (const bm of bookmarks) {
            const id = uuidv4();
            const faviconUrl = null;

            db.prepare(`
        INSERT INTO bookmarks (id, user_id, title, url, description, favicon, tags) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, bm.title || bm.url, bm.url, bm.description || null, faviconUrl, bm.tags || null);

            // Trigger async favicon fetch
            fetchFavicon(bm.url, id).catch(console.error);

            imported.push(db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id));
        }

        res.json({ imported: imported.length, bookmarks: imported });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Failed to import bookmarks' });
    }
});

app.get('/api/export', authenticateToken, (req, res) => {
    const { format } = req.query;
    const bookmarks = db.prepare('SELECT * FROM bookmarks WHERE user_id = ?').all(req.user.id);
    const folders = db.prepare('SELECT * FROM folders WHERE user_id = ?').all(req.user.id);

    if (format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', 'attachment; filename=anchormarks-bookmarks.html');
        res.send(generateBookmarkHtml(bookmarks, folders));
    } else {
        res.json({ bookmarks, folders });
    }
});

// ============== SYNC ROUTES ==============

app.get('/api/sync/status', authenticateToken, (req, res) => {
    const bookmarkCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?').get(req.user.id);
    const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders WHERE user_id = ?').get(req.user.id);
    const lastUpdated = db.prepare('SELECT MAX(updated_at) as last FROM bookmarks WHERE user_id = ?').get(req.user.id);

    res.json({
        bookmarks: bookmarkCount.count,
        folders: folderCount.count,
        last_updated: lastUpdated.last
    });
});

app.post('/api/sync/push', authenticateToken, (req, res) => {
    const { bookmarks, folders } = req.body;
    const results = { created: 0, updated: 0, errors: [] };

    if (folders && folders.length) {
        for (const folder of folders) {
            try {
                const existing = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?')
                    .get(folder.id, req.user.id);

                if (existing) {
                    db.prepare('UPDATE folders SET name = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .run(folder.name, folder.color, folder.parent_id, folder.id);
                    results.updated++;
                } else {
                    db.prepare('INSERT INTO folders (id, user_id, name, color, parent_id) VALUES (?, ?, ?, ?, ?)')
                        .run(folder.id || uuidv4(), req.user.id, folder.name, folder.color || '#6366f1', folder.parent_id);
                    results.created++;
                }
            } catch (err) {
                results.errors.push({ folder: folder.name, error: err.message });
            }
        }
    }

    if (bookmarks && bookmarks.length) {
        for (const bm of bookmarks) {
            try {
                const existing = db.prepare('SELECT * FROM bookmarks WHERE url = ? AND user_id = ?')
                    .get(bm.url, req.user.id);

                if (existing) {
                    db.prepare('UPDATE bookmarks SET title = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .run(bm.title, bm.folder_id, existing.id);
                    results.updated++;
                } else {
                    const id = uuidv4();
                    const faviconUrl = null;

                    db.prepare('INSERT INTO bookmarks (id, user_id, folder_id, title, url, favicon) VALUES (?, ?, ?, ?, ?, ?)')
                        .run(id, req.user.id, bm.folder_id, bm.title || bm.url, bm.url, faviconUrl);

                    // Trigger async favicon fetch
                    fetchFavicon(bm.url, id).catch(console.error);
                    results.created++;
                }
            } catch (err) {
                results.errors.push({ url: bm.url, error: err.message });
            }
        }
    }

    res.json(results);
});

app.get('/api/sync/pull', authenticateToken, (req, res) => {
    const bookmarks = db.prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY position').all(req.user.id);
    const folders = db.prepare('SELECT * FROM folders WHERE user_id = ? ORDER BY position').all(req.user.id);
    res.json({ bookmarks, folders });
});

// ============== QUICK SEARCH (Flow Launcher) ==============

app.get('/api/quick-search', authenticateToken, (req, res) => {
    const { q, limit = 10 } = req.query;

    if (!q) {
        const bookmarks = db.prepare(`
    SELECT id, title, url, favicon_local as favicon, click_count 
      FROM bookmarks 
      WHERE user_id = ? 
      ORDER BY click_count DESC, last_clicked DESC, created_at DESC 
      LIMIT ?
    `).all(req.user.id, parseInt(limit));
        return res.json(bookmarks);
    }

    const searchTerm = `%${q}%`;
    const bookmarks = db.prepare(`
    SELECT id, title, url, favicon_local as favicon, click_count 
    FROM bookmarks 
    WHERE user_id = ? AND (title LIKE ? OR url LIKE ? OR tags LIKE ?)
    ORDER BY 
      CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
      click_count DESC
    LIMIT ?
  `).all(req.user.id, searchTerm, searchTerm, searchTerm, `${q}%`, parseInt(limit));

    res.json(bookmarks);
});

// ============== STATS ==============

app.get('/api/stats', authenticateToken, (req, res) => {
    const bookmarkCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?').get(req.user.id);
    const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders WHERE user_id = ?').get(req.user.id);
    const favoriteCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_favorite = 1').get(req.user.id);
    const topClicked = db.prepare(`
    SELECT title, url, favicon_local as favicon, click_count 
    FROM bookmarks 
    WHERE user_id = ? AND click_count > 0 
    ORDER BY click_count DESC 
    LIMIT 5
  `).all(req.user.id);

    // Get tag stats
    const allBookmarks = db.prepare('SELECT tags FROM bookmarks WHERE user_id = ? AND tags IS NOT NULL').all(req.user.id);
    const tagCounts = {};
    allBookmarks.forEach(b => {
        if (b.tags) {
            b.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    res.json({
        total_bookmarks: bookmarkCount.count,
        total_folders: folderCount.count,
        total_tags: Object.keys(tagCounts).length,
        favorites: favoriteCount.count,
        top_clicked: topClicked,
        top_tags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    });
});

// ============== HEALTH CHECK / CLEANUP ==============

// Find duplicate bookmarks (same URL)
app.get('/api/health/duplicates', authenticateToken, (req, res) => {
    const duplicates = db.prepare(`
        SELECT url, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(title, '|||') as titles
        FROM bookmarks 
        WHERE user_id = ?
        GROUP BY url 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    `).all(req.user.id);

    res.json({
        total_duplicates: duplicates.length,
        duplicates: duplicates.map(d => ({
            url: d.url,
            count: d.count,
            ids: d.ids.split(','),
            titles: d.titles.split('|||')
        }))
    });
});

// Delete duplicate bookmarks (keep the first one)
app.post('/api/health/duplicates/cleanup', authenticateToken, (req, res) => {
    const duplicates = db.prepare(`
        SELECT url, GROUP_CONCAT(id) as ids
        FROM bookmarks 
        WHERE user_id = ?
        GROUP BY url 
        HAVING COUNT(*) > 1
    `).all(req.user.id);

    let deleted = 0;
    for (const dup of duplicates) {
        const ids = dup.ids.split(',');
        // Keep first, delete rest
        for (let i = 1; i < ids.length; i++) {
            db.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?').run(ids[i], req.user.id);
            deleted++;
        }
    }

    res.json({ deleted, message: `Removed ${deleted} duplicate bookmarks` });
});

// Check for dead links (async - returns job status)
app.get('/api/health/deadlinks', authenticateToken, async (req, res) => {
    const { check } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    // Get bookmarks that haven't been checked recently or never checked
    const bookmarks = db.prepare(`
        SELECT id, url, title, last_checked, is_dead
        FROM bookmarks 
        WHERE user_id = ?
        ORDER BY last_checked ASC NULLS FIRST
        LIMIT ?
    `).all(req.user.id, limit);

    if (check !== 'true') {
        // Just return current status
        const deadCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_dead = 1').get(req.user.id);
        return res.json({
            dead_links: deadCount.count,
            unchecked: bookmarks.filter(b => !b.last_checked).length,
            bookmarks: bookmarks.filter(b => b.is_dead === 1).map(b => ({ id: b.id, url: b.url, title: b.title }))
        });
    }

    // Actually check the links
    const results = [];
    const https = require('https');
    const http = require('http');

    for (const bookmark of bookmarks.slice(0, 20)) { // Check max 20 at a time
        try {
            const urlObj = new URL(bookmark.url);
            if (NODE_ENV === 'production' && await isPrivateAddress(bookmark.url)) {
                continue;
            }
            const protocol = urlObj.protocol === 'https:' ? https : http;

            const isDead = await new Promise((resolve) => {
                const req = protocol.request(bookmark.url, { method: 'HEAD', timeout: 5000 }, (response) => {
                    resolve(response.statusCode >= 400);
                });
                req.on('error', () => resolve(true));
                req.on('timeout', () => { req.destroy(); resolve(true); });
                req.end();
            });

            db.prepare('UPDATE bookmarks SET is_dead = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?')
                .run(isDead ? 1 : 0, bookmark.id);

            if (isDead) {
                results.push({ id: bookmark.id, url: bookmark.url, title: bookmark.title });
            }
        } catch (e) {
            // Invalid URL, mark as dead
            db.prepare('UPDATE bookmarks SET is_dead = 1, last_checked = CURRENT_TIMESTAMP WHERE id = ?')
                .run(bookmark.id);
            results.push({ id: bookmark.id, url: bookmark.url, title: bookmark.title, error: e.message });
        }
    }

    res.json({
        checked: Math.min(20, bookmarks.length),
        dead_links_found: results.length,
        dead_links: results
    });
});

// Get bookmarks by domain
app.get('/api/bookmarks/by-domain', authenticateToken, (req, res) => {
    const bookmarks = db.prepare('SELECT url FROM bookmarks WHERE user_id = ?').all(req.user.id);

    const domainCounts = {};
    bookmarks.forEach(b => {
        try {
            const domain = new URL(b.url).hostname.replace('www.', '');
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        } catch (e) { }
    });

    const sorted = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([domain, count]) => ({ domain, count }));

    res.json(sorted);
});

// ============== EXAMPLE BOOKMARKS ==============

const EXAMPLE_BOOKMARKS = [
    // Productivity
    { title: 'Google', url: 'https://www.google.com', description: 'Search the web', tags: 'search,productivity' },
    { title: 'Gmail', url: 'https://mail.google.com', description: 'Google email service', tags: 'email,productivity' },
    { title: 'Google Calendar', url: 'https://calendar.google.com', description: 'Manage your schedule', tags: 'calendar,productivity' },
    { title: 'Google Drive', url: 'https://drive.google.com', description: 'Cloud storage and collaboration', tags: 'storage,productivity' },
    { title: 'Notion', url: 'https://www.notion.so', description: 'All-in-one workspace', tags: 'notes,productivity' },

    // Development
    { title: 'GitHub', url: 'https://github.com', description: 'Code hosting and collaboration', tags: 'development,git' },
    { title: 'Stack Overflow', url: 'https://stackoverflow.com', description: 'Programming Q&A community', tags: 'development,help' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', description: 'Web development documentation', tags: 'development,docs' },
    { title: 'CodePen', url: 'https://codepen.io', description: 'Frontend code playground', tags: 'development,sandbox' },

    // Learning
    { title: 'Wikipedia', url: 'https://www.wikipedia.org', description: 'Free encyclopedia', tags: 'learning,reference' },
    { title: 'YouTube', url: 'https://www.youtube.com', description: 'Video streaming platform', tags: 'learning,entertainment' },
    { title: 'Coursera', url: 'https://www.coursera.org', description: 'Online courses and degrees', tags: 'learning,education' },

    // News & Social
    { title: 'Reddit', url: 'https://www.reddit.com', description: 'Social news and discussion', tags: 'social,news' },
    { title: 'Hacker News', url: 'https://news.ycombinator.com', description: 'Tech news and discussion', tags: 'news,tech' },
    { title: 'Twitter / X', url: 'https://twitter.com', description: 'Social microblogging', tags: 'social,news' }
];

// Create example bookmarks for a user
function createExampleBookmarks(userId, folderId = null) {
    const created = [];

    for (let i = 0; i < EXAMPLE_BOOKMARKS.length; i++) {
        const bm = EXAMPLE_BOOKMARKS[i];
        const id = uuidv4();
        const faviconUrl = null;

        db.prepare(`
            INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, tags, position) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, folderId, bm.title, bm.url, bm.description, faviconUrl, bm.tags, i + 1);

        // Trigger async favicon fetch
        fetchFavicon(bm.url, id).catch(console.error);

        created.push({ id, ...bm, favicon: faviconUrl });
    }

    return created;
}

// ============== HELPER FUNCTIONS ==============

// const cheerio = require('cheerio'); // Removed as not available
// Since we don't have cheerio, we'll stick to regex/parsing but handle nesting.
// The previous logic flatten import.
// To support nesting, we need to respect the <DL> hierarchy.
// Netscape bookmark file format uses recursive <DL><p><DT><H3>...</H3><DL>...</DL></DT> ... </DL>

function parseBookmarkHtml(html, userId) {
    const imported = [];

    // Using simple regex for flat structure wasn't enough.
    // Let's implement a recursive parser or simulate a DOM parser.
    // Given the constraints and likely input size, a stateful parser is safer.

    // However, writing a full HTML parser in one block is error-prone.
    // Let's refine the regex approach to be recursive if possible, or use a stack-based parser.
    // Or simpler: Use a library if available. Assuming no external libs besides what's in package.json.
    // package.json likely has no cheerio.

    // Let's try a stack-based approach assuming valid Netscape format
    // Tokens: <DT>, <H3>, <A>, <DL>, </DL>

    // Helper to create folder
    function createFolder(name, parentId) {
        const id = uuidv4();
        // Check duplicate name in same parent not strictly required but polite.
        // For simpler logic, just creates new one or returns existing if identical name/parent exists?
        // Let's create new to avoid merging mess unless name match in same parent.

        const existing = db.prepare('SELECT id FROM folders WHERE user_id = ? AND name = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))')
            .get(userId, name, parentId || null, parentId || null);

        if (existing) return existing.id;

        const maxPos = db.prepare('SELECT MAX(position) as max FROM folders WHERE user_id = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))')
            .get(userId, parentId || null, parentId || null);
        const position = (maxPos.max || 0) + 1;

        db.prepare('INSERT INTO folders (id, user_id, name, color, icon, position, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, userId, name, '#6366f1', 'folder', position, parentId || null);

        return id;
    }

    // We will simple-parse line by line or tag by tag?
    // Regex-based recursive parser for specific structure:

    // 1. Normalize
    let content = html.replace(/[\r\n]+/g, ' ').replace(/>\s+</g, '><');

    // 2. We need to find <DT><H3...>(.*?)</H3>...<DL>(.*?)</DL> pattern and <DT><A...>(.*?)</A> pattern.
    // The previous implementation was too greedy.

    // Let's use a scanning function that processes a string and recursively calls itself for DL blocks

    function parseBlock(blockHtml, currentParentId) {
        // Regex to find items in this block.
        // Items are either <DT><H3>...<DL>...</DL> (Folder) or <DT><A>...</A> (Bookmark)
        // Since regex doesn't support balanced tags easily, this is hard.

        // Alternative: Use 'cheerio' if available? No.
        // Let's use a makeshift parser index-based.

        let i = 0;
        const len = blockHtml.length;

        while (i < len) {
            // Find next <DT>
            const dtIndex = blockHtml.indexOf('<DT>', i);
            if (dtIndex === -1) break;

            i = dtIndex + 4; // Past <DT>

            // Check if it's an H3 (Folder) or A (Bookmark)
            if (blockHtml.startsWith('<H3', i)) {
                // Folder
                const h3End = blockHtml.indexOf('</H3>', i);
                const h3Start = blockHtml.indexOf('>', i) + 1;
                const folderName = blockHtml.substring(h3Start, h3End);

                const dlStart = blockHtml.indexOf('<DL>', h3End);
                const dlEnd = findClosingTag(blockHtml, dlStart, 'DL'); // Helpers needed

                if (dlStart !== -1 && dlEnd !== -1) {
                    const folderId = createFolder(folderName, currentParentId);
                    // Recurse inner DL content
                    const innerHtml = blockHtml.substring(dlStart + 4, dlEnd); // +4 skip <p> usually? Netscape adds <p> after DL or inside? 
                    // Usually <DL><p>...
                    parseBlock(innerHtml, folderId);
                    i = dlEnd + 5; // Past </DL>
                } else {
                    i = h3End + 5;
                }

            } else if (blockHtml.startsWith('<A', i)) {
                // Bookmark
                const aEnd = blockHtml.indexOf('</A>', i);
                const aTagEnd = blockHtml.indexOf('>', i);
                const aHtml = blockHtml.substring(i, aEnd + 4); // Full <A...>...</A>

                // Parse attributes
                const attributes = blockHtml.substring(i, aTagEnd);
                const title = blockHtml.substring(aTagEnd + 1, aEnd);

                // Extract HREF
                const hrefMatch = attributes.match(/HREF="([^"]+)"/i);
                if (hrefMatch) {
                    const url = hrefMatch[1];
                    // Extract TAGS
                    const tagsMatch = attributes.match(/TAGS=["']([^"']+)["']/i);
                    const tags = tagsMatch ? tagsMatch[1] : null;

                    if (!url.startsWith('javascript:') && !url.startsWith('place:')) {
                        const id = uuidv4();
                        const faviconUrl = null;

                        db.prepare('INSERT INTO bookmarks (id, user_id, folder_id, title, url, favicon, tags) VALUES (?, ?, ?, ?, ?, ?, ?)')
                            .run(id, userId, currentParentId, title, url, faviconUrl, tags);

                        fetchFavicon(url, id).catch(console.error);
                        imported.push({ id });
                    }
                }
                i = aEnd + 4;
            } else {
                i++;
            }
        }
    }

    // Helper to find balancing </DL>
    function findClosingTag(str, start, tagName) {
        let depth = 1;
        let pos = start + tagName.length + 2; // Past <DL>
        const openTag = `<${tagName}`;
        const closeTag = `</${tagName}>`;

        while (depth > 0 && pos < str.length) {
            const nextOpen = str.indexOf(openTag, pos);
            const nextClose = str.indexOf(closeTag, pos);

            if (nextClose === -1) return -1; // Malformed

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++;
                pos = nextOpen + openTag.length;
            } else {
                depth--;
                pos = nextClose + closeTag.length;
            }
            if (depth === 0) return nextClose;
        }
        return -1;
    }

    // Strip DOCTYPE/HTML wrapper if possible or just search body
    parseBlock(html, null);

    return imported;
}

function generateBookmarkHtml(bookmarks, folders) {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>AnchorMarks Bookmarks</TITLE>
<H1>AnchorMarks Bookmarks</H1>
<DL><p>\n`;

    for (const bm of bookmarks) {
        const tagsAttr = bm.tags ? ` TAGS="${bm.tags}"` : '';
        html += `    <DT><A HREF="${bm.url}"${tagsAttr}>${bm.title}</A>\n`;
    }

    html += `</DL><p>`;
    return html;
}

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nClosing database connection...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nClosing database connection...');
    db.close();
    process.exit(0);
});

// Start server
if (NODE_ENV !== 'test') {
    app.listen(PORT, HOST, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   AnchorMarks v1.0.0                                      ║
║                                                           ║
║   Server:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}                          ║
║   API:     http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api                      ║
║   Mode:    ${NODE_ENV.padEnd(15)}                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    });
}

// Expose helpers for tests
app._isPrivateAddress = isPrivateAddress;

module.exports = app;
