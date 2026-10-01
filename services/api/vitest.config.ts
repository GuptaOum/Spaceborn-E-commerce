import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one Postgres and run three files in parallel; on a busy laptop a
    // single checkout can take a few seconds, which is not a failure.
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
