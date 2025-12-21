const dns = require("dns");
const fs = require("fs");

const {
  isPrivateIp,
  isPrivateAddress,
  fetchFavicon,
} = require("../helpers/utils");

describe("helpers/utils (unit)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isPrivateIp", () => {
    it("identifies private IPv4 addresses", () => {
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("192.168.1.5")).toBe(true);
    });

    it("identifies non-private addresses", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
    });

    it("handles IPv6 private loopback", () => {
      expect(isPrivateIp("::1")).toBe(true);
    });

    it("returns false for falsy input", () => {
      expect(isPrivateIp(null)).toBe(false);
      expect(isPrivateIp("")).toBe(false);
    });
  });

  describe("isPrivateAddress", () => {
    afterEach(() => {
      jest.restoreAllMocks();
      process.env.NODE_ENV = process.env.NODE_ENV || "test";
    });

    it("treats localhost and loopback as private", async () => {
      expect(await isPrivateAddress("http://localhost")).toBe(true);
      expect(await isPrivateAddress("http://127.0.0.1")).toBe(true);
      expect(await isPrivateAddress("http://[::1]")).toBe(true);
    });

    it("returns false for a public IP without DNS lookup", async () => {
      expect(await isPrivateAddress("http://93.184.216.34")).toBe(false);
    });

    it("resolves hostnames via dns and respects private IPs", async () => {
      // mock dns.lookup to return a private IP
      jest
        .spyOn(dns.promises, "lookup")
        .mockResolvedValue([{ address: "10.0.0.2" }]);

      expect(await isPrivateAddress("https://example.com")).toBe(true);

      dns.promises.lookup.mockRestore();
    });

    it("is conservative on invalid URLs in production", async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      expect(await isPrivateAddress("not-a-url")).toBe(true);
      process.env.NODE_ENV = original;
    });

    it("is permissive on invalid URLs in test mode", async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";
      expect(await isPrivateAddress("not-a-url")).toBe(false);
      process.env.NODE_ENV = original;
    });
  });

  describe("fetchFavicon", () => {
    it("returns null for non-http(s) URLs", async () => {
      const fakeDb = { prepare: () => ({ run: () => {} }) };
      const res = await fetchFavicon("ftp://example.com", "id", fakeDb, "/tmp", "test");
      expect(res).toBeNull();
    });

    it("returns cached favicon path when local file exists and updates DB", async () => {
      const fakeDb = {
        prepare: jest.fn(() => ({ run: jest.fn() })),
      };

      // Ensure fs.existsSync returns true (cached)
      const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);

      const publicPath = await fetchFavicon(
        "https://example.com",
        "bookmark-id",
        fakeDb,
        "/tmp/favicons",
        "production",
      );

      // Domain 'example.com' becomes filename example_com.png
      expect(publicPath).toBe("/favicons/example_com.png");
      expect(fakeDb.prepare).toHaveBeenCalled();
      existsSpy.mockRestore();
    });

    it("in test env returns null when not cached (avoids network)", async () => {
      const fakeDb = { prepare: () => ({ run: () => {} }) };
      const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);

      const res = await fetchFavicon(
        "https://noncached.example",
        "id",
        fakeDb,
        "/tmp/favicons",
        "test",
      );

      expect(res).toBeNull();
      existsSpy.mockRestore();
    });
  });
});
