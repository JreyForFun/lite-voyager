import { expect, test, vi } from 'vitest';
import { hostDiagnosticStage, hostTimingBreach } from '../../src/test/host-timing-breach';

test('NFR-005: Given disabled action diagnostics, When a fixture reaches a stage, Then no diagnostic output is emitted', () => {
  const report = vi.fn(); hostDiagnosticStage(false, 'completion/csv/native', 'dispose/start', report); expect(report).not.toHaveBeenCalled();
});

test('NFR-005: Given an enabled fixture action, When reporting its boundaries, Then the context, stage, process and raw clock are retained without changing action order', () => {
  const report = vi.fn<(line: string) => void>();
  hostDiagnosticStage(true, 'completion/csv/native', 'dispose/start', report);
  hostDiagnosticStage(true, 'completion/csv/native', 'dispose/end', report);
  const values = report.mock.calls.map(([line]) => JSON.parse(line.slice('T-030 host diagnostic stage: '.length)) as Record<string, unknown>);
  expect(values.map(value => value['stage'])).toEqual(['dispose/start', 'dispose/end']);
  expect(values[0]).toMatchObject({ label: 'completion/csv/native', pid: process.pid });
  expect(typeof values[0]?.['atMs']).toBe('number'); expect(typeof values[0]?.['utc']).toBe('string');
});

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
