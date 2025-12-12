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
let apiKey;
let apiKeyBookmarkId;

beforeAll(async () => {
    const unique = Date.now();
    const user = {
        username: `tester-${unique}`,
        email: `tester${unique}@example.com`,
        password: 'password123'
    };

    const register = await request(app)
        .post('/api/auth/register')
        .send(user);

    token = register.body.token;
    apiKey = register.body.user.api_key;
});

afterAll(() => {
    // Clean up SQLite files generated during tests
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
        const me = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(me.statusCode).toBe(200);
        expect(me.body.user.api_key).toBeTruthy();
    });

    it('supports bookmarks CRUD with JWT', async () => {
        const create = await request(app)
            .post('/api/bookmarks')
            .set('Authorization', `Bearer ${token}`)
            .send({ url: 'https://example.com', title: 'Example' });

        expect(create.statusCode).toBe(200);
        const bookmarkId = create.body.id;

        const list = await request(app)
            .get('/api/bookmarks')
            .set('Authorization', `Bearer ${token}`);

        expect(list.statusCode).toBe(200);
        expect(list.body.find(b => b.id === bookmarkId)).toBeTruthy();

        const update = await request(app)
            .put(`/api/bookmarks/${bookmarkId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Updated Title', tags: 'test' });

        expect(update.statusCode).toBe(200);
        expect(update.body.title).toBe('Updated Title');

        const remove = await request(app)
            .delete(`/api/bookmarks/${bookmarkId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(remove.statusCode).toBe(200);
    });

    it('imports and exports bookmarks', async () => {
        const importRes = await request(app)
            .post('/api/import/json')
            .set('Authorization', `Bearer ${token}`)
            .send({ bookmarks: [{ url: 'https://example.org', title: 'Example Org' }] });

        expect(importRes.statusCode).toBe(200);
        expect(importRes.body.imported).toBe(1);

        const exportRes = await request(app)
            .get('/api/export')
            .set('Authorization', `Bearer ${token}`);

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
