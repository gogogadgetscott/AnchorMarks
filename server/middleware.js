const jwt = require('jsonwebtoken');
const { JWT_SECRET, isApiKeyAllowed } = require('./config');

function authenticateToken(db) {
    return (req, res, next) => {
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

        // JWT from HTTP-only cookie
        const token = req.cookies.token;
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
            res.clearCookie('token');
            return res.status(403).json({ error: 'Invalid token' });
        }
    };
}

function validateCsrfToken(db) {
    return (req, res, next) => {
        // Skip CSRF check for safe methods
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        
        // Check if using API key auth - skip CSRF for API keys
        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            const user = db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
            if (user) {
                return next(); // API key bypass CSRF
            }
        }

        const csrfToken = req.headers['x-csrf-token'] || req.body?.csrfToken;
        const sessionCsrf = req.cookies.csrfToken;

        if (!csrfToken || !sessionCsrf || csrfToken !== sessionCsrf) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    validateCsrfToken
};