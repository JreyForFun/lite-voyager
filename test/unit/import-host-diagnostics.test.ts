import { channel } from 'node:diagnostics_channel';
import { performance } from 'node:perf_hooks';
import { expect, test, vi } from 'vitest';
import { IMPORT_HOST_CHANNEL, traceHostAwait, traceHostSync } from '../../src/import-host-diagnostics';

test('NFR-005: Given no diagnostic subscriber, When a host operation runs, Then its exact return/promise/error is preserved without sampling clocks or CPU', () => {
  const clock = vi.spyOn(performance, 'now'); const cpu = vi.spyOn(process, 'cpuUsage'); const value = Promise.resolve(1); const failure = new Error('private source');
  try {
    expect(traceHostSync('webview-state', () => value)).toBe(value);
    expect(traceHostAwait('storage-initialize', () => value)).toBe(value);
    expect(() => traceHostSync('import-helper-fork', () => { throw failure; })).toThrow(failure);
    expect(clock).not.toHaveBeenCalled(); expect(cpu).not.toHaveBeenCalled();
  } finally { clock.mockRestore(); cpu.mockRestore(); }
});

test('NFR-005: Given an observed slow synchronous launch, When it throws, Then a fixed-label raw span is recorded and the original error survives without logging its contents', () => {
  const sink = channel(IMPORT_HOST_CHANNEL); const records: unknown[] = []; const listener = (value: unknown): void => { records.push(value); };
  const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(130.5);
  const cpu = vi.spyOn(process, 'cpuUsage').mockReturnValueOnce({ user: 100, system: 10 }).mockReturnValueOnce({ user: 110, system: 12 });
  const failure = new Error('secret.csv SELECT password'); sink.subscribe(listener);
  try {
    expect(() => traceHostSync('import-helper-fork', () => { throw failure; })).toThrow(failure);
    expect(records).toEqual([{ stage: 'import-helper-fork', kind: 'sync', from: 10, to: 130.5, milliseconds: 120.5, processCpuUserUs: 10, processCpuSystemUs: 2 }]);
    expect(JSON.stringify(records)).not.toContain('secret');
  } finally { sink.unsubscribe(listener); clock.mockRestore(); cpu.mockRestore(); }
});

test('NFR-005: Given asynchronous preflight and cancellation, When the operation rejects, Then elapsed evidence is labelled await rather than synchronous blocking and preserves the rejection', async () => {
  const sink = channel(IMPORT_HOST_CHANNEL); const records: unknown[] = []; const listener = (value: unknown): void => { records.push(value); };
  const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(20).mockReturnValueOnce(250);
  const failure = new Error('cancelled'); sink.subscribe(listener);
  try {
    await expect(traceHostAwait('source-snapshot', () => Promise.reject(failure))).rejects.toBe(failure);
    expect(records).toEqual([expect.objectContaining({ stage: 'source-snapshot', kind: 'await', from: 20, to: 250, milliseconds: 230 })]);
  } finally { sink.unsubscribe(listener); clock.mockRestore(); }
});
