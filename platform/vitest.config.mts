import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each database test file starts its own in-process Postgres (PGlite).
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
