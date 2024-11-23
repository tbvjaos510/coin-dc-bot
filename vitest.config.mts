// @ts-ignore
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ['./mongodb-test.ts'],
    coverage: {
      include: ["src/**/*.ts"],
    }
  },
});
