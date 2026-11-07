/**
 * Metadata queue resilience tests.
 *
 * A failure outside the per-item guards (e.g. db.prepare when the database
 * is closing) used to reject inside setInterval and leave isProcessing=true
 * forever, permanently stalling metadata processing until restart. Enqueue
 * dedupe was an O(n) queue rebuild and the queue was unbounded.
 */
const {
  initialize,
  queueMetadataFetch,
  processBatch,
  getStatus,
  clearQueue,
} = require("../services/metadataQueueService");

afterEach(() => {
  clearQueue();
  initialize(null, null);
});

describe("metadata queue resilience", () => {
  it("recovers when db.prepare throws mid-batch (no permanent stall)", async () => {
    initialize(
      {
        prepare: () => {
          throw new Error("database is closing");
        },
      },
      async () => {},
    );
    queueMetadataFetch(["b1", "b2"], "user-1");
    expect(getStatus().queueLength).toBe(2);

    await expect(processBatch()).resolves.not.toThrow();

    const status = getStatus();
    expect(status.isProcessing).toBe(false);
    expect(status.queueLength).toBe(0);

    // Dedupe keys were released in finally → the same work can be re-queued
    queueMetadataFetch(["b1"], "user-1");
    expect(getStatus().queueLength).toBe(1);
  });

  it("recovers when the favicon fetcher rejects", async () => {
    const db = {
      prepare: () => ({
        get: () => ({ id: "b1", url: "https://example.com" }),
      }),
    };
    initialize(db, async () => {
      throw new Error("network down");
    });
    queueMetadataFetch(["b1"], "user-1");

    await expect(processBatch()).resolves.not.toThrow();

    expect(getStatus().isProcessing).toBe(false);
    expect(getStatus().queueLength).toBe(0);
  });

  it("deduplicates enqueues by bookmark+user", () => {
    initialize({ prepare: () => ({}) }, async () => {});
    queueMetadataFetch(["b1", "b1", "b2"], "user-1");
    queueMetadataFetch(["b1"], "user-1");
    expect(getStatus().queueLength).toBe(2);
    // Same bookmark, different owner → distinct work
    queueMetadataFetch(["b1"], "user-2");
    expect(getStatus().queueLength).toBe(3);
  });

  it("caps the queue so bulk imports cannot grow it without bound", () => {
    initialize({ prepare: () => ({}) }, async () => {});
    const ids = Array.from({ length: 5001 }, (_, i) => `bm-${i}`);
    queueMetadataFetch(ids, "user-1");
    expect(getStatus().queueLength).toBe(5000);
  });

  it("does nothing when not initialized", async () => {
    initialize(null, null);
    queueMetadataFetch(["b1"], "user-1");
    await processBatch();
    expect(getStatus().isProcessing).toBe(false);
    expect(getStatus().queueLength).toBe(1);
  });
});
