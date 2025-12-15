const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Use an isolated database for integration tests
const TEST_DB_PATH = path.join(__dirname, 'anchormarks-test.db');
process.env.NODE_ENV = 'test';
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = 'test-secret-key';
process.env.CORS_ORIGIN = 'http://localhost';

const app = require('../index');

let token;
let csrfToken;
let apiKey;
let apiKeyBookmarkId;
let agent; // HTTP agent to maintain cookies

beforeAll(async () => {
    agent = request.agent(app); // Create persistent agent for cookie handling
    const unique = Date.now();
    const user = {
        email: `tester${unique}@example.com`,
        password: 'password123'
    };

    const register = await agent
        .post('/api/auth/register')
        .send(user);

    if (register.status !== 200) {
        console.error('Register failed:', register.status, register.body);
        throw new Error(`Register failed: ${register.status}`);
    }

    // Cookies are now automatically managed by the agent
    csrfToken = register.body.csrfToken;
    apiKey = register.body.user.api_key;
});

afterAll(() => {
    // Clean up SQLite files generated during tests
    if (app.db) app.db.close();
    [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]
        .forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
});

describe('AnchorMarks API', () => {
    it('responds with health status', async () => {
        const res = await request(app).get('/api/health');

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.environment).toBe('test');
    });

    it('returns current profile with JWT', async () => {
        const me = await agent
            .get('/api/auth/me')
            .set('X-CSRF-Token', csrfToken);

        expect(me.statusCode).toBe(200);
        expect(me.body.user.api_key).toBeTruthy();
    });

    it('supports bookmarks CRUD with JWT', async () => {
        const create = await agent
            .post('/api/bookmarks')
            .set('X-CSRF-Token', csrfToken)
            .send({ url: 'https://example.com', title: 'Example' });

        expect(create.statusCode).toBe(200);
        const bookmarkId = create.body.id;

        const list = await agent
            .get('/api/bookmarks')
            .set('X-CSRF-Token', csrfToken);

        expect(list.statusCode).toBe(200);
        expect(list.body.find(b => b.id === bookmarkId)).toBeTruthy();

        const update = await agent
            .put(`/api/bookmarks/${bookmarkId}`)
            .set('X-CSRF-Token', csrfToken)
            .send({ title: 'Updated Title', tags: 'test' });

        expect(update.statusCode).toBe(200);
        expect(update.body.title).toBe('Updated Title');

        const remove = await agent
            .delete(`/api/bookmarks/${bookmarkId}`)
            .set('X-CSRF-Token', csrfToken);

        expect(remove.statusCode).toBe(200);
    });

    it('imports and exports bookmarks', async () => {
        const importRes = await agent
            .post('/api/import/json')
            .set('X-CSRF-Token', csrfToken)
            .send({ bookmarks: [{ url: 'https://example.org', title: 'Example Org' }] });

        expect(importRes.statusCode).toBe(200);
        expect(importRes.body.imported).toBe(1);

        const exportRes = await agent
            .get('/api/export')
            .set('X-CSRF-Token', csrfToken);

        expect(exportRes.statusCode).toBe(200);
        expect(Array.isArray(exportRes.body.bookmarks)).toBe(true);
        expect(exportRes.body.bookmarks.length).toBeGreaterThan(0);
    });

    it('allows API key on whitelisted endpoints', async () => {
        const search = await request(app)
            .get('/api/quick-search')
            .set('X-API-Key', apiKey);

        expect(search.statusCode).toBe(200);

        const createWithKey = await request(app)
            .post('/api/bookmarks')
            .set('X-API-Key', apiKey)
            .send({ url: 'https://key-allowed.test', title: 'Key Allowed' });

        expect(createWithKey.statusCode).toBe(200);
        apiKeyBookmarkId = createWithKey.body.id;
    });

    it('blocks API key on restricted endpoints', async () => {
        const attemptDelete = await request(app)
            .delete(`/api/bookmarks/${apiKeyBookmarkId}`)
            .set('X-API-Key', apiKey);

        expect(attemptDelete.statusCode).toBe(403);
        expect(attemptDelete.body.error).toMatch(/not permitted/i);
    });
});
