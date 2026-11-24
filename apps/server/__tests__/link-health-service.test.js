const http = require("http");
const {
  checkUrlHealth,
  statusForResponse,
} = require("../services/linkHealthService");

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
      }),
    );
  });
}

describe("linkHealthService", () => {
  it("classifies representative response codes", () => {
    expect(statusForResponse(200, false)).toBe("ok");
    expect(statusForResponse(204, true)).toBe("redirect");
    expect(statusForResponse(403, false)).toBe("blocked");
    expect(statusForResponse(404, false)).toBe("dead");
  });

  it("follows redirects and retries HEAD with GET", async () => {
    const { server, url } = await listen((req, res) => {
      if (req.url === "/redirect") {
        res.writeHead(302, { Location: "/target" });
        return res.end();
      }
      if (req.method === "HEAD") {
        res.writeHead(405);
        return res.end();
      }
      res.writeHead(200);
      res.end("ok");
    });

    try {
      const result = await checkUrlHealth(`${url}/redirect`);
      expect(result.status).toBe("redirect");
      expect(result.httpCode).toBe(200);
      expect(result.redirected).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("rejects unsupported protocols without making a request", async () => {
    await expect(
      checkUrlHealth("bookmark-view:missing"),
    ).resolves.toMatchObject({ status: "dead", error: "invalid-url" });
  });
});
