const app = require('../index');

const isPrivateAddress = app._isPrivateAddress;

describe('network safety helpers', () => {
    it('treats loopback as private', async () => {
        expect(await isPrivateAddress('http://127.0.0.1')).toBe(true);
        expect(await isPrivateAddress('http://localhost')).toBe(true);
    });

    it('allows public hosts', async () => {
        // example.com IP (public) to avoid DNS dependence
        expect(await isPrivateAddress('http://93.184.216.34')).toBe(false);
    });

    it('blocks non-http protocols', async () => {
        expect(await isPrivateAddress('ftp://example.com')).toBe(true);
    });
});
