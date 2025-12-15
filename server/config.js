require('dotenv').config();
const path = require('path');

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

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'anchormarks.db');
const ENABLE_BACKGROUND_JOBS = NODE_ENV !== 'test';
const ENABLE_FAVICON_BACKGROUND_JOBS = false; // Only fetch favicons on import/save

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

module.exports = {
    NODE_ENV,
    PORT,
    HOST,
    JWT_SECRET,
    DB_PATH,
    ENABLE_BACKGROUND_JOBS,
    ENABLE_FAVICON_BACKGROUND_JOBS,
    validateSecurityConfig,
    resolveCorsOrigin,
    isApiKeyAllowed
};