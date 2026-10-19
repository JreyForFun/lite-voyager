import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    // Engine/packaging/reporter suites start their own helpers. Serialize files
    // so helper builds do not overlap full-library parsing in another suite.
    // Concurrency exercised within individual tests remains intact.
    // All tests, workloads, diagnostic assertions and timeouts are unchanged.
    // Fresh thread workers retain per-file isolation without an OS-fork
    // bootstrap for each file. Database/export helpers remain real processes.
    pool: 'threads',
    isolate: true,
    maxWorkers: 1,
    // Keep passing titles out of diagnostic scans and passing console output visible.
    reporters: ['dot'],
  },
});
