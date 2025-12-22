/**
 * Unit Tests for utils helper
 * Tests for isPrivateIp, isPrivateAddress, and fetchFavicon edge cases
 */

describe("utils.js - Unit Tests", () => {
  let originalNodeEnv;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("isPrivateIp (internal function tested via isPrivateAddress)", () => {
    it("should detect private IPv4 10.x.x.x", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://10.0.0.1")).resolves.toBe(true);
      await expect(isPrivateAddress("http://10.255.255.255")).resolves.toBe(
        true,
      );
    });

    it("should detect private IPv4 172.16-31.x.x", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://172.16.0.1")).resolves.toBe(true);
      await expect(isPrivateAddress("http://172.31.255.255")).resolves.toBe(
        true,
      );
    });

    it("should detect private IPv4 192.168.x.x", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://192.168.1.1")).resolves.toBe(true);
      await expect(isPrivateAddress("http://192.168.255.255")).resolves.toBe(
        true,
      );
    });

    it("should detect loopback IPv4 127.x.x.x", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://127.0.0.1")).resolves.toBe(true);
      await expect(isPrivateAddress("http://127.255.255.255")).resolves.toBe(
        true,
      );
    });

    it("should detect link-local IPv4 169.254.x.x", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://169.254.1.1")).resolves.toBe(true);
      await expect(isPrivateAddress("http://169.254.255.255")).resolves.toBe(
        true,
      );
    });

    it("should allow public IPv4 addresses", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://8.8.8.8")).resolves.toBe(false);
      await expect(isPrivateAddress("http://1.1.1.1")).resolves.toBe(false);
      await expect(isPrivateAddress("http://93.184.216.34")).resolves.toBe(
        false,
      );
    });

    it("should detect private IPv6 fc00::/7", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("http://[fc00::1234:5678:90ab:cdef]"),
      ).resolves.toBe(true);
      await expect(
        isPrivateAddress("http://[fd12:3456:789a:bcde::1]"),
      ).resolves.toBe(true);
    });

    it("should detect link-local IPv6 fe80::/10", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("http://[fe80::1234:5678:90ab:cdef]"),
      ).resolves.toBe(true);
    });

    it("should detect IPv6 loopback ::1", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://[::1]")).resolves.toBe(true);
    });

    it("should allow public IPv6 addresses", async () => {
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => [{ address: "2001:4860:4860::8888" }]),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://example.com")).resolves.toBe(false);
      jest.dontMock("dns");
    });
  });

  describe("isPrivateAddress - URL parsing", () => {
    it("should handle URLs with brackets for IPv6", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://[::1]")).resolves.toBe(true);
      await expect(
        isPrivateAddress("http://[fe80::1]:8080/path"),
      ).resolves.toBe(true);
    });

    it("should handle localhost as private", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://localhost")).resolves.toBe(true);
      await expect(isPrivateAddress("https://localhost:3000")).resolves.toBe(
        true,
      );
    });

    it("should block non-http(s) protocols", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("ftp://example.com")).resolves.toBe(true);
      await expect(isPrivateAddress("file:///etc/passwd")).resolves.toBe(true);
      await expect(isPrivateAddress("javascript:alert(1)")).resolves.toBe(true);
      await expect(isPrivateAddress("data:text/html,<script>")).resolves.toBe(
        true,
      );
    });

    it("should handle DNS resolution failures conservatively", async () => {
      process.env.NODE_ENV = "production";
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => {
            throw new Error("DNS lookup failed");
          }),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("https://nonexistent-domain-12345.com"),
      ).resolves.toBe(true);

      jest.dontMock("dns");
    });

    it("should allow DNS resolution failures in non-production", async () => {
      process.env.NODE_ENV = "test";
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => {
            throw new Error("DNS lookup failed");
          }),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("https://nonexistent-domain-12345.com"),
      ).resolves.toBe(false);

      jest.dontMock("dns");
    });

    it("should detect private IPs resolved via DNS", async () => {
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => [
            { address: "192.168.1.1" },
            { address: "10.0.0.1" },
          ]),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("https://internal.example.com"),
      ).resolves.toBe(true);

      jest.dontMock("dns");
    });

    it("should allow public IPs resolved via DNS", async () => {
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => [
            { address: "93.184.216.34" },
            { address: "93.184.216.35" },
          ]),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("https://example.com")).resolves.toBe(
        false,
      );

      jest.dontMock("dns");
    });

    it("should reject if any resolved IP is private", async () => {
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => [
            { address: "93.184.216.34" },
            { address: "10.0.0.1" }, // One private IP in the list
          ]),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("https://mixed.example.com")).resolves.toBe(
        true,
      );

      jest.dontMock("dns");
    });

    it("should handle malformed URLs gracefully", async () => {
      process.env.NODE_ENV = "test";
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("not-a-url")).resolves.toBe(false);
      await expect(isPrivateAddress("")).resolves.toBe(false);
    });

    it("should handle malformed URLs in production conservatively", async () => {
      process.env.NODE_ENV = "production";
      jest.resetModules();
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("not-a-url")).resolves.toBe(true);
      await expect(isPrivateAddress("")).resolves.toBe(true);
    });
  });

  describe("fetchFavicon - Edge Cases", () => {
    it("should return null for non-http protocols", async () => {
      const { fetchFavicon } = require("../helpers/utils");
      const db = { prepare: () => ({ run: () => {} }) };

      await expect(
        fetchFavicon("ftp://example.com", "id", db, "/tmp", "test"),
      ).resolves.toBeNull();
      await expect(
        fetchFavicon("file:///path/to/file", "id", db, "/tmp", "test"),
      ).resolves.toBeNull();
      await expect(
        fetchFavicon("javascript:alert(1)", "id", db, "/tmp", "test"),
      ).resolves.toBeNull();
    });

    it("should block private targets in production (SSRF prevention)", async () => {
      const { fetchFavicon } = require("../helpers/utils");
      const db = { prepare: () => ({ run: () => {} }) };

      await expect(
        fetchFavicon("http://127.0.0.1", "id", db, "/tmp", "production"),
      ).resolves.toBeNull();
      await expect(
        fetchFavicon("http://10.0.0.1", "id", db, "/tmp", "production"),
      ).resolves.toBeNull();
      await expect(
        fetchFavicon("http://192.168.1.1", "id", db, "/tmp", "production"),
      ).resolves.toBeNull();
      await expect(
        fetchFavicon("http://localhost", "id", db, "/tmp", "production"),
      ).resolves.toBeNull();
    });

    it("should return cached favicon if file exists", async () => {
      jest.resetModules();
      jest.doMock("fs", () => ({
        existsSync: jest.fn(() => true),
      }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/page",
        "bm-123",
        db,
        "/var/favicons",
        "test",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(db.prepare).toHaveBeenCalled();
      expect(updateRun).toHaveBeenCalledWith(
        "/favicons/example_com.png",
        "/favicons/example_com.png",
        "bm-123",
      );

      jest.dontMock("fs");
    });

    it("should return null in test mode if file doesn't exist", async () => {
      jest.resetModules();
      jest.doMock("fs", () => ({
        existsSync: jest.fn(() => false),
      }));

      const db = { prepare: () => ({ run: () => {} }) };
      const { fetchFavicon } = require("../helpers/utils");

      const result = await fetchFavicon(
        "https://example.com/page",
        "bm-123",
        db,
        "/var/favicons",
        "test",
      );

      expect(result).toBeNull();
      jest.dontMock("fs");
    });

    it("should sanitize domain name for filename", async () => {
      jest.resetModules();
      jest.doMock("fs", () => ({
        existsSync: jest.fn(() => true),
      }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");

      await fetchFavicon(
        "https://sub-domain.example.com:8080/path",
        "bm-123",
        db,
        "/var/favicons",
        "test",
      );

      expect(updateRun).toHaveBeenCalledWith(
        "/favicons/sub_domain_example_com.png",
        "/favicons/sub_domain_example_com.png",
        "bm-123",
      );

      jest.dontMock("fs");
    });

    it("should handle invalid URL gracefully", async () => {
      const { fetchFavicon } = require("../helpers/utils");
      const db = { prepare: () => ({ run: () => {} }) };

      await expect(
        fetchFavicon("not-a-url", "id", db, "/tmp", "test"),
      ).resolves.toBeNull();
      await expect(
        fetchFavicon("", "id", db, "/tmp", "test"),
      ).resolves.toBeNull();
    });

    it("should deduplicate concurrent requests for same domain", async () => {
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);
      const createWriteStream = jest.fn(() => {
        const stream = new EventEmitter();
        stream.close = jest.fn();
        return stream;
      });

      let callCount = 0;
      const req = new EventEmitter();
      req.destroy = jest.fn();

      let savedCallback = null;
      const get = jest.fn((source, opts, cb) => {
        callCount++;
        savedCallback = cb;
        return req;
      });

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");

      // Start two concurrent fetches for the same domain
      const p1 = fetchFavicon(
        "https://example.com/page1",
        "bm-1",
        db,
        "/tmp/favicons",
        "development",
      );
      const p2 = fetchFavicon(
        "https://example.com/page2",
        "bm-2",
        db,
        "/tmp/favicons",
        "development",
      );

      // Should only make one network call
      expect(callCount).toBe(1);

      // Resolve the fetch
      savedCallback({
        statusCode: 200,
        pipe: (fileStream) => process.nextTick(() => fileStream.emit("finish")),
      });

      const results = await Promise.all([p1, p2]);

      // Both should return the same result
      expect(results[0]).toBe("/favicons/example_com.png");
      expect(results[1]).toBe("/favicons/example_com.png");

      // DB should only be updated once
      expect(updateRun).toHaveBeenCalledTimes(1);

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });

    it("should try multiple sources and fallback on failure", async () => {
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);
      const createWriteStream = jest.fn(() => {
        const stream = new EventEmitter();
        stream.close = jest.fn();
        return stream;
      });

      let callCount = 0;
      const get = jest.fn((source, opts, cb) => {
        callCount++;
        const req = new EventEmitter();
        req.destroy = jest.fn();

        // First two sources fail, third succeeds
        if (callCount <= 2) {
          cb({ statusCode: 404 });
        } else {
          cb({
            statusCode: 200,
            pipe: (fileStream) =>
              process.nextTick(() => fileStream.emit("finish")),
          });
        }

        return req;
      });

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/page",
        "bm-123",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(callCount).toBe(3); // Tried 3 sources
      expect(updateRun).toHaveBeenCalled();

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });

    it("should return null if all sources fail", async () => {
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);

      const get = jest.fn((source, opts, cb) => {
        const req = new EventEmitter();
        req.destroy = jest.fn();
        cb({ statusCode: 404 }); // All sources fail
        return req;
      });

      jest.doMock("fs", () => ({ existsSync }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/page",
        "bm-123",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBeNull();
      expect(updateRun).not.toHaveBeenCalled();

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });

    it("should handle network errors gracefully", async () => {
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);

      let callCount = 0;
      const get = jest.fn((source, opts, cb) => {
        callCount++;
        const req = new EventEmitter();
        req.destroy = jest.fn();

        // First source has network error, second succeeds
        if (callCount === 1) {
          process.nextTick(() => req.emit("error", new Error("Network error")));
        } else {
          cb({
            statusCode: 200,
            pipe: (fileStream) =>
              process.nextTick(() => fileStream.emit("finish")),
          });
        }

        return req;
      });

      const createWriteStream = jest.fn(() => {
        const stream = new EventEmitter();
        stream.close = jest.fn();
        return stream;
      });

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/page",
        "bm-123",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(callCount).toBeGreaterThanOrEqual(2);

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });

    it("should handle file write errors gracefully", async () => {
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);

      let callCount = 0;
      const get = jest.fn((source, opts, cb) => {
        callCount++;
        const req = new EventEmitter();
        req.destroy = jest.fn();

        cb({
          statusCode: 200,
          pipe: (fileStream) => {
            if (callCount === 1) {
              // First write fails
              process.nextTick(() =>
                fileStream.emit("error", new Error("Write error")),
              );
            } else {
              // Second write succeeds
              process.nextTick(() => fileStream.emit("finish"));
            }
          },
        });

        return req;
      });

      const createWriteStream = jest.fn(() => {
        const stream = new EventEmitter();
        stream.close = jest.fn();
        return stream;
      });

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/page",
        "bm-123",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(callCount).toBeGreaterThanOrEqual(2);

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });
  });
});
