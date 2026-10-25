import { performance } from 'node:perf_hooks';
import { channel } from 'node:diagnostics_channel';
import { IMPORT_HOST_CHANNEL, traceHostSync } from '../../src/import-host-diagnostics';
import { expect, test, vi } from 'vitest';
import { HostIntervalTrace, startHostIntervalDiagnostics } from '../../src/test/host-interval-diagnostics';

test('NFR-005: Given named synchronous and await spans around an over-limit interval, When the bounded trace is sampled, Then original raw time and both distinct scopes remain intact', () => {
  const trace = new HostIntervalTrace(() => ({ user: 0, system: 0 }), 2);
  const span = { stage: 'import-helper-fork' as const, kind: 'sync' as const, from: 3, to: 104, milliseconds: 101, processCpuUserUs: 0, processCpuSystemUs: 0 };
  trace.operation(span); trace.operation({ ...span, stage: 'storage-initialize', kind: 'await' });
  trace.sample(0, 105, 'ready/none', 'importing/none');
  trace.operation({ ...span, stage: 'import-helper-send', from: 200, to: 201, milliseconds: 1 });
  expect(trace.result().largest?.milliseconds).toBe(105);
  expect(trace.result().operations.map((value) => [value.stage, value.kind, value.milliseconds])).toEqual([
    ['import-helper-fork', 'sync', 101], ['storage-initialize', 'await', 101],
  ]);
  expect(trace.result().droppedOperations).toBe(1); expect(trace.result().truncated).toBe(true);
});

test('NFR-005: Given a live named-operation subscriber, When diagnostics stop, Then spans are captured with fixed labels and the listener is removed', () => {
  const sink = channel(IMPORT_HOST_CHANNEL); expect(sink.hasSubscribers).toBe(false);
  const live = startHostIntervalDiagnostics(true); const from = performance.now(); traceHostSync('lifecycle-output', () => 1);
  live?.sample(from, performance.now(), 'ready', 'importing');
  const result = live?.stop(); expect(result?.operations.some((value) => value.stage === 'lifecycle-output')).toBe(true);
  expect(sink.hasSubscribers).toBe(false); expect(live?.stop()).toBe(result);
});

test('NFR-010: Given malformed or extra channel fields, When retaining named host evidence, Then untrusted labels are counted and unrelated private fields cannot enter logs', () => {
  const sink = channel(IMPORT_HOST_CHANNEL); const live = startHostIntervalDiagnostics(true);
  const span = { stage: 'webview-state', kind: 'sync', from: 10, to: 12, milliseconds: 2, processCpuUserUs: 0, processCpuSystemUs: 0 };
  sink.publish({ ...span, privateData: 'secret.csv SELECT password' }); sink.publish({ ...span, stage: 'secret.csv' });
  live?.sample(0, 20, 'ready', 'importing'); const result = live?.stop();
  expect(result?.operations).toEqual([span]); expect(JSON.stringify(result)).not.toContain('secret');
  expect(result?.untrackedResources).toBeGreaterThanOrEqual(1);
});

test('NFR-005: Given an over-limit raw interval, When diagnostic CPU and callback evidence is recorded, Then the original elapsed time and phase boundaries are unchanged', () => {
  const cpu = [{ user: 100, system: 20 }, { user: 130, system: 25 }, { user: 140, system: 29 }];
  const trace = new HostIntervalTrace(() => cpu.shift() ?? { user: 140, system: 29 });
  trace.sample(10, 20, 'ready/none', 'importing/none');
  trace.callback('PIPEWRAP', 30, 90); trace.callback('Timeout', 1, 5);
  trace.gc(40, 15); trace.gc(200, 20);
  trace.sample(20, 121.417375, 'importing/reading', 'importing/reading');
  const result = trace.result();
  expect(result.intervals).toBe(2);
  expect(result.largest).toEqual({ from: 20, to: 121.417375, milliseconds: 101.417375, fromPhase: 'importing/reading', toPhase: 'importing/reading', processCpuUserUs: 10, processCpuSystemUs: 4 });
  expect(result.callbacks).toEqual([{ type: 'PIPEWRAP', from: 30, to: 90, milliseconds: 60 }]);
  expect(result.gc).toEqual([{ from: 40, to: 55, milliseconds: 15 }]);
});

test('NFR-005: Given GC delivered after a long interval, When evidence is finalized, Then overlapping late entries remain visible without subtracting their duration', () => {
  const trace = new HostIntervalTrace(() => ({ user: 0, system: 0 }));
  trace.sample(1, 102, 'reading', 'reading'); trace.gc(20, 60);
  expect(trace.result().largest?.milliseconds).toBe(101);
  expect(trace.result().gc).toEqual([{ from: 20, to: 80, milliseconds: 60 }]);
});

test('NFR-005: Given bounded traces, When capacity is exceeded, Then dropped observations are explicitly counted and stored evidence stays bounded', () => {
  const trace = new HostIntervalTrace(() => ({ user: 0, system: 0 }), 2);
  trace.sample(0, 200, 'reading', 'reading');
  for (let index = 0; index < 6; index++) { trace.callback('FSREQCALLBACK', index, index + 2); trace.gc(index, 3); }
  const result = trace.result();
  expect(result.callbacks).toHaveLength(2); expect(result.gc).toHaveLength(2);
  expect(result.droppedCallbacks).toBe(4); expect(result.droppedGc).toBe(4);
  expect(result.truncated).toBe(true); expect(result.largest?.milliseconds).toBe(200);
});

test('NFR-005: Given disabled diagnostics, When the ordinary import path initializes, Then no CPU sampler or native hook is created', () => {
  const cpu = vi.spyOn(process, 'cpuUsage');
  try { expect(startHostIntervalDiagnostics(false)).toBeUndefined(); expect(cpu).not.toHaveBeenCalled(); }
  finally { cpu.mockRestore(); }
});

test('NFR-005: Given a live diagnostic observer, When one raw timer interval is sampled and stopped twice, Then native observation cleans up and the evidence is stable', async () => {
  const live = startHostIntervalDiagnostics(true); expect(live).toBeDefined();
  const from = performance.now();
  await new Promise<void>((accept) => { setImmediate(accept); });
  live?.sample(from, performance.now(), 'reading', 'reading');
  const result = live?.stop(); expect(result?.intervals).toBe(1);
  expect(result?.largest?.processCpuUserUs).toBeGreaterThanOrEqual(0);
  expect(live?.stop()).toEqual(result);
});
