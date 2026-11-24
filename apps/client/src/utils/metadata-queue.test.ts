import { describe, expect, it, vi } from "vitest";
import { clearMetadataQueueCaches, enqueueMetadata } from "./metadata-queue";

describe("metadata queue", () => {
  it("deduplicates concurrent requests for the same URL", async () => {
    clearMetadataQueueCaches();
    let release!: () => void;
    const loader = vi.fn(
      () =>
        new Promise<{ title: string }>((resolve) => {
          release = () => resolve({ title: "Example" });
        }),
    );

    const first = enqueueMetadata("https://example.com/article", loader);
    const second = enqueueMetadata("https://example.com/article", loader);
    release();

    await expect(first).resolves.toEqual({ title: "Example" });
    await expect(second).resolves.toEqual({ title: "Example" });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("returns a safe fallback for private addresses", async () => {
    clearMetadataQueueCaches();
    const loader = vi.fn(async () => ({ title: "Should not run" }));
    await expect(
      enqueueMetadata("http://192.168.1.46/", loader),
    ).resolves.toMatchObject({ title: "192.168.1.46" });
    expect(loader).not.toHaveBeenCalled();
  });
});
