import { expect, test, vi } from 'vitest';
import { hostTimingBreach } from '../../src/test/host-timing-breach';

test('NFR-005: Given disabled native tracing, When a timer reporter is requested, Then no callback or output is added', () => {
  const report = vi.fn(); expect(hostTimingBreach(false, 'export/json', report)).toBeUndefined(); expect(report).not.toHaveBeenCalled();
});
test('NFR-005: Given original timer endpoints, When the first raw interval exceeds 100ms, Then one immediate marker retains exact endpoints and later intervals cannot replace it', () => {
  const report = vi.fn<(line: string) => void>(); const sample = hostTimingBreach(true, 'export/json', report); expect(sample).toBeDefined();
  sample?.(100, 200, 'exporting'); expect(report).not.toHaveBeenCalled(); sample?.(200, 486.739084, 'exporting');
  sample?.(500, 900, 'exporting'); expect(report).toHaveBeenCalledOnce();
  const line = report.mock.calls[0]?.[0]; expect(line).toBeDefined(); if (line === undefined) { throw new Error('Missing marker'); }
  expect(line).toMatch(/^T-030 first host timing breach: /u);
  expect(JSON.parse(line.slice('T-030 first host timing breach: '.length))).toMatchObject({ label: 'export/json', from: 200, to: 486.739084, maxGapMs: 486.739084 - 200, phase: 'exporting', pid: process.pid });
});
