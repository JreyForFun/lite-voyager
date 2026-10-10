import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    // Keep passing titles out of diagnostic scans and passing console output visible.
    reporters: ['dot'],
  },
});
