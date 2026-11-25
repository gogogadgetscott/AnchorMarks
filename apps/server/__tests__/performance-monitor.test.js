const { monitor } = require("../utils/performanceMonitor");

describe("performanceMonitor critical stats", () => {
  beforeEach(() => {
    monitor.metrics.apiRequests = [];
    monitor.metrics.dbQueries = [];
    monitor.metrics.errors = [];
    monitor.metrics.slowQueries = [];
    monitor.metrics.clientTelemetry = [];
  });

  it("reports critical endpoint latency and client timeout telemetry", () => {
    const baseReq = {
      user: { id: "user-1" },
      headers: {},
    };
    const res = { statusCode: 200 };
    monitor.trackRequest(
      { ...baseReq, method: "GET", path: "/api/bookmarks" },
      res,
      120,
    );
    monitor.trackRequest(
      {
        ...baseReq,
        method: "GET",
        path: "/api/tags",
        headers: { "x-client-telemetry": "r=40;t=2" },
      },
      res,
      60,
    );
    monitor.trackRequest(
      { ...baseReq, method: "GET", path: "/api/bookmarks/counts" },
      res,
      30,
    );

    const stats = monitor.getStats(60_000);
    expect(stats.criticalEndpoints["GET /api/bookmarks"].total).toBeGreaterThan(
      0,
    );
    expect(stats.criticalEndpoints["GET /api/tags"].avgDuration).toBeGreaterThan(
      0,
    );
    expect(stats.clientTelemetry.samples).toBeGreaterThan(0);
    expect(stats.clientTelemetry.avgTimeoutRatePct).toBeGreaterThan(0);
  });
});
