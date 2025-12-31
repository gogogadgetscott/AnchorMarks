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
    vi.resetModules();
    vi.restoreAllMocks();
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
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi
        .spyOn(dns.promises, "lookup")
        .mockResolvedValue([{ address: "2001:4860:4860::8888" }]);

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://example.com")).resolves.toBe(false);
      lookupSpy.mockRestore();
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
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi
        .spyOn(dns.promises, "lookup")
        .mockRejectedValue(new Error("DNS lookup failed"));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("https://nonexistent-domain-12345.com"),
      ).resolves.toBe(true);

      lookupSpy.mockRestore();
    });

    it("should allow DNS resolution failures in non-production", async () => {
      process.env.NODE_ENV = "test";
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi
        .spyOn(dns.promises, "lookup")
        .mockRejectedValue(new Error("DNS lookup failed"));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("https://nonexistent-domain-12345.com"),
      ).resolves.toBe(false);

      lookupSpy.mockRestore();
    });

    it("should detect private IPs resolved via DNS", async () => {
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi
        .spyOn(dns.promises, "lookup")
        .mockResolvedValue([
          { address: "192.168.1.1" },
          { address: "10.0.0.1" },
        ]);

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(
        isPrivateAddress("https://internal.example.com"),
      ).resolves.toBe(true);

      lookupSpy.mockRestore();
    });

    it("should allow public IPs resolved via DNS", async () => {
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi
        .spyOn(dns.promises, "lookup")
        .mockResolvedValue([
          { address: "93.184.216.34" },
          { address: "93.184.216.35" },
        ]);

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("https://example.com")).resolves.toBe(
        false,
      );

      lookupSpy.mockRestore();
    });

    it("should reject if any resolved IP is private", async () => {
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi.spyOn(dns.promises, "lookup").mockResolvedValue([
        { address: "93.184.216.34" },
        { address: "10.0.0.1" }, // One private IP in the list
      ]);

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("https://mixed.example.com")).resolves.toBe(
        true,
      );

      lookupSpy.mockRestore();
    });

    it("should handle malformed URLs gracefully", async () => {
      process.env.NODE_ENV = "test";
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("not-a-url")).resolves.toBe(false);
      await expect(isPrivateAddress("")).resolves.toBe(false);
    });

    it("should handle malformed URLs in production conservatively", async () => {
      process.env.NODE_ENV = "production";
      vi.resetModules();
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
      vi.resetModules();
      const fs = require("fs");
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
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

      existsSpy.mockRestore();
    });

    it("should return null in test mode if file doesn't exist", async () => {
      vi.resetModules();
      const fs = require("fs");
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

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
      existsSpy.mockRestore();
    });

    it("should sanitize domain name for filename", async () => {
      vi.resetModules();
      const fs = require("fs");
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
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

      existsSpy.mockRestore();
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
      vi.resetModules();

      const { EventEmitter } = require("events");
      const fs = require("fs");
      const https = require("https");
      const http = require("http");

      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const createStreamSpy = vi
        .spyOn(fs, "createWriteStream")
        .mockImplementation(() => {
          const stream = new EventEmitter();
          stream.close = vi.fn();
          return stream;
        });

      let callCount = 0;
      const req = new EventEmitter();
      req.destroy = vi.fn();

      let savedCallback = null;
      const getMock = (source, opts, cb) => {
        callCount++;
        savedCallback = cb;
        return req;
      };

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
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

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });

    it("should try multiple sources and fallback on failure", async () => {
      vi.resetModules();

      const { EventEmitter } = require("events");
      const fs = require("fs");
      const https = require("https");
      const http = require("http");

      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const createStreamSpy = vi
        .spyOn(fs, "createWriteStream")
        .mockImplementation(() => {
          const stream = new EventEmitter();
          stream.close = vi.fn();
          return stream;
        });

      let callCount = 0;
      const getMock = (source, opts, cb) => {
        callCount++;
        const req = new EventEmitter();
        req.destroy = vi.fn();

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
      };

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
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

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });

    it("should return null if all sources fail", async () => {
      vi.resetModules();

      const { EventEmitter } = require("events");
      const fs = require("fs");
      const https = require("https");
      const http = require("http");

      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

      const getMock = (source, opts, cb) => {
        const req = new EventEmitter();
        req.destroy = vi.fn();
        cb({ statusCode: 404 }); // All sources fail
        return req;
      };

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
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

      existsSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });

    it("should handle network errors gracefully", async () => {
      vi.resetModules();

      const { EventEmitter } = require("events");
      const fs = require("fs");
      const https = require("https");
      const http = require("http");

      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const createStreamSpy = vi
        .spyOn(fs, "createWriteStream")
        .mockImplementation(() => {
          const stream = new EventEmitter();
          stream.close = vi.fn();
          return stream;
        });

      let callCount = 0;
      const getMock = (source, opts, cb) => {
        callCount++;
        const req = new EventEmitter();
        req.destroy = vi.fn();

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
      };

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://network-error.com/page",
        "bm-123",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/network_error_com.png");
      expect(callCount).toBeGreaterThanOrEqual(2);

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });

    it("should handle file write errors gracefully", async () => {
      vi.resetModules();

      const { EventEmitter } = require("events");
      const fs = require("fs");
      const https = require("https");
      const http = require("http");

      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

      const createStreamSpy = vi
        .spyOn(fs, "createWriteStream")
        .mockImplementation(() => {
          const stream = new EventEmitter();
          stream.close = vi.fn();
          return stream;
        });

      let callCount = 0;
      const getMock = (source, opts, cb) => {
        callCount++;
        const req = new EventEmitter();
        req.destroy = vi.fn();

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
      };

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://write-error.com/page",
        "bm-123",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/write_error_com.png");
      expect(callCount).toBeGreaterThanOrEqual(2);

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });
  });
});
