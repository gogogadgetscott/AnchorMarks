import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true, // This allows using describe, it, expect without importing them
    fileParallelism: false, // Run test files sequentially to avoid DB corruption
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
