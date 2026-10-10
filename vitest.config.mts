import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    // Engine/packaging/reporter suites start their own helpers. Bound competing
    // file workers so nested runner startup keeps its existing 5 s deadline.
    // All tests, workloads, diagnostic assertions and timeouts are unchanged.
    maxWorkers: 2,
    // Keep passing titles out of diagnostic scans and passing console output visible.
    reporters: ['dot'],
  },
});
