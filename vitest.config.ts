import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.spec.ts"],
    testTimeout: 15_000,
    coverage: { provider: "v8" },
  },
});
