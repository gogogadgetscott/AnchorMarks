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
      jest.resetModules();
      jest.doMock("dns", () => ({
        promises: {
          lookup: jest.fn(async () => [{ address: "10.0.0.1" }]),
        },
      }));

      const { isPrivateAddress } = require("../helpers/utils");
      await expect(isPrivateAddress("https://example.com")).resolves.toBe(true);

      jest.dontMock("dns");
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

      jest.dontMock("fs");
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
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);
      const createWriteStream = jest.fn(() => {
        const stream = new EventEmitter();
        stream.close = jest.fn();
        return stream;
      });

      let callCount = 0;
      const makeReq = () => {
        const req = new EventEmitter();
        req.destroy = jest.fn();
        return req;
      };

      const httpsGet = jest.fn((source, opts, cb) => {
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
      });

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get: httpsGet }));
      jest.doMock("http", () => ({ get: httpsGet }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
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

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });

    it("returns the same in-flight promise for concurrent requests (queue)", async () => {
      jest.resetModules();

      const { EventEmitter } = require("events");
      const existsSync = jest.fn(() => false);
      const createWriteStream = jest.fn(() => {
        const stream = new EventEmitter();
        stream.close = jest.fn();
        return stream;
      });

      let pendingCallback = null;
      const req = new EventEmitter();
      req.destroy = jest.fn();

      const get = jest.fn((source, opts, cb) => {
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

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
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
      expect(get).toHaveBeenCalledTimes(1);

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

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });

    it("handles request timeout by trying the next source (mocked)", async () => {
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
        callCount += 1;
        const req = new EventEmitter();
        req.destroy = jest.fn();

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

      jest.doMock("fs", () => ({ existsSync, createWriteStream }));
      jest.doMock("https", () => ({ get }));
      jest.doMock("http", () => ({ get }));

      const updateRun = jest.fn();
      const db = {
        prepare: jest.fn(() => ({ run: updateRun })),
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

      jest.dontMock("fs");
      jest.dontMock("https");
      jest.dontMock("http");
    });
  });
});
