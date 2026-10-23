import { performance } from 'node:perf_hooks';
import { expect, test, vi } from 'vitest';
import { HostIntervalTrace, startHostIntervalDiagnostics } from '../../src/test/host-interval-diagnostics';

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
