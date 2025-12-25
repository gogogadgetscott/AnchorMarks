describe("server/utils.js", () => {
  describe("isPrivateAddress", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("treats localhost as private", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://localhost")).resolves.toBe(true);
    });

    it("treats loopback ip as private", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://127.0.0.1")).resolves.toBe(true);
    });

    it("allows public IPs without DNS lookup", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://93.184.216.34")).resolves.toBe(
        false,
      );
    });

    it("treats IPv6 loopback as private", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("http://[::1]")).resolves.toBe(true);
    });

    it("blocks non-http(s) protocols", async () => {
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("ftp://example.com")).resolves.toBe(true);
    });

    it("returns false for invalid URL in non-production", async () => {
      process.env.NODE_ENV = "test";
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("not-a-url")).resolves.toBe(false);
    });

    it("returns true for invalid URL in production (conservative)", async () => {
      process.env.NODE_ENV = "production";
      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("not-a-url")).resolves.toBe(true);
    });

    it("treats DNS-resolved private IPs as private", async () => {
      vi.resetModules();
      const dns = require("dns");
      const lookupSpy = vi
        .spyOn(dns.promises, "lookup")
        .mockResolvedValue([{ address: "10.0.0.1" }]);

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("https://example.com")).resolves.toBe(true);

      lookupSpy.mockRestore();
    });
  });

  describe("fetchFavicon", () => {
    it("returns null for non-http(s) bookmark URL", async () => {
      const { fetchFavicon } = require("../helpers/utils");
      const db = { prepare: () => ({ run: () => {} }) };
      await expect(
        fetchFavicon("ftp://example.com", "id", db, "/tmp", "test"),
      ).resolves.toBeNull();
    });

    it("returns null for private targets in production (SSRF guard)", async () => {
      const { fetchFavicon } = require("../helpers/utils");
      const db = { prepare: () => ({ run: () => {} }) };
      await expect(
        fetchFavicon("http://127.0.0.1", "id", db, "/tmp", "production"),
      ).resolves.toBeNull();
    });

    it("returns cached favicon path when file already exists", async () => {
      const originalNodeEnv = process.env.NODE_ENV;

      vi.resetModules();
      const fs = require("fs");
      const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");

      const result = await fetchFavicon(
        "https://example.com/some/path",
        "bookmark-id",
        db,
        "/tmp/favicons",
        "test",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(db.prepare).toHaveBeenCalled();
      expect(updateRun).toHaveBeenCalledWith(
        "/favicons/example_com.png",
        "/favicons/example_com.png",
        "bookmark-id",
      );

      existsSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("returns null for invalid URL input", async () => {
      const { fetchFavicon } = require("../helpers/utils");
      const db = { prepare: () => ({ run: () => {} }) };
      await expect(
        fetchFavicon("not-a-url", "id", db, "/tmp", "development"),
      ).resolves.toBeNull();
    });

    it("falls back between sources and updates DB on success (mocked network)", async () => {
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
      const makeReq = () => {
        const req = new EventEmitter();
        req.destroy = vi.fn();
        return req;
      };

      const httpsGet = (source, opts, cb) => {
        callCount += 1;
        const req = makeReq();

        if (callCount === 1) {
          cb({ statusCode: 404 });
          return req;
        }

        cb({
          statusCode: 200,
          pipe: (fileStream) =>
            process.nextTick(() => fileStream.emit("finish")),
        });

        return req;
      };

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(httpsGet);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(httpsGet);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/some/path",
        "bookmark-id",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(updateRun).toHaveBeenCalledWith(
        "/favicons/example_com.png",
        "/favicons/example_com.png",
        "bookmark-id",
      );
      expect(callCount).toBeGreaterThanOrEqual(2);

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });

    it("returns the same in-flight promise for concurrent requests (queue)", async () => {
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

      let pendingCallback = null;
      const req = new EventEmitter();
      req.destroy = vi.fn();

      const getMock = vi.fn((source, opts, cb) => {
        if (!pendingCallback) {
          pendingCallback = cb;
          return req;
        }

        cb({
          statusCode: 200,
          pipe: (fileStream) =>
            process.nextTick(() => fileStream.emit("finish")),
        });
        return req;
      });

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");

      const p1 = fetchFavicon(
        "https://example.com/one",
        "bookmark-id",
        db,
        "/tmp/favicons",
        "development",
      );
      const p2 = fetchFavicon(
        "https://example.com/two",
        "bookmark-id",
        db,
        "/tmp/favicons",
        "development",
      );

      // Second request should reuse the in-flight fetch (no additional network call).
      expect(getMock).toHaveBeenCalledTimes(1);

      // Resolve the pending request by letting the first source succeed.
      pendingCallback({
        statusCode: 200,
        pipe: (fileStream) => process.nextTick(() => fileStream.emit("finish")),
      });

      const results = await Promise.all([p1, p2]);
      expect(results).toEqual([
        "/favicons/example_com.png",
        "/favicons/example_com.png",
      ]);
      expect(updateRun).toHaveBeenCalledTimes(1);

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });

    it("handles request timeout by trying the next source (mocked)", async () => {
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
      const getMock = vi.fn((source, opts, cb) => {
        callCount += 1;
        const req = new EventEmitter();
        req.destroy = vi.fn();

        if (callCount === 1) {
          // Simulate a timeout on the first attempt.
          process.nextTick(() => req.emit("timeout"));
          return req;
        }

        cb({
          statusCode: 200,
          pipe: (fileStream) =>
            process.nextTick(() => fileStream.emit("finish")),
        });
        return req;
      });

      const httpsSpy = vi.spyOn(https, "get").mockImplementation(getMock);
      const httpSpy = vi.spyOn(http, "get").mockImplementation(getMock);

      const updateRun = vi.fn();
      const db = {
        prepare: vi.fn(() => ({ run: updateRun })),
      };

      const { fetchFavicon } = require("../helpers/utils");
      const result = await fetchFavicon(
        "https://example.com/some/path",
        "bookmark-id",
        db,
        "/tmp/favicons",
        "development",
      );

      expect(result).toBe("/favicons/example_com.png");
      expect(callCount).toBeGreaterThanOrEqual(2);

      existsSpy.mockRestore();
      createStreamSpy.mockRestore();
      httpsSpy.mockRestore();
      httpSpy.mockRestore();
    });
  });
});
