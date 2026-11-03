import { performance } from 'node:perf_hooks';
import { channel } from 'node:diagnostics_channel';
import { IMPORT_HOST_CHANNEL, traceHostSync } from '../../src/import-host-diagnostics';
import { expect, test, vi } from 'vitest';
import { describeEventLoopCounters, HostIntervalTrace, startHostIntervalDiagnostics } from '../../src/test/host-interval-diagnostics';

test.each([-1, 0])('NFR-005: Given an unset loop-start marker %s and zero counters, When describing runtime evidence, Then zeros are labelled uninitialized rather than idle', (loopStartMs) => {
  expect(describeEventLoopCounters(loopStartMs, 0, 0)).toEqual({ status: 'loop-start-unset', loopStartMs, activeMs: 0, idleMs: 0, invalidFields: [] });
});

test('NFR-005: Given initialized but zero counters, When describing runtime evidence, Then valid zero observations remain reported without inferring runtime support or idleness', () => {
  expect(describeEventLoopCounters(1, 0, 0)).toEqual({ status: 'reported', loopStartMs: 1, activeMs: 0, idleMs: 0, invalidFields: [] });
});

test.each([
  [undefined, 2, 3, 'loopStartMs'], [Number.NaN, 2, 3, 'loopStartMs'], [1, Number.POSITIVE_INFINITY, 3, 'activeMs'],
  [1, -1, 3, 'activeMs'], [1, 2, Number.NEGATIVE_INFINITY, 'idleMs'], [1, 2, -1, 'idleMs'],
])('NFR-005: Given invalid runtime counter values (%s,%s,%s), When describing evidence, Then the invalid field is explicit and never replaced with zero', (loopStartMs, activeMs, idleMs, field) => {
  const evidence = describeEventLoopCounters(loopStartMs, activeMs, idleMs);
  expect(evidence.status).toBe('invalid'); expect(evidence.invalidFields).toEqual([field]);
  expect(evidence).toHaveProperty(field, null); expect(JSON.stringify(evidence)).toContain('null');
});

test('NFR-010: Given several malformed capability values containing private text, When evidence is described, Then only fixed field names and explicit nulls can be retained', () => {
  const evidence = describeEventLoopCounters('private.csv SELECT password', undefined, Number.NaN);
  expect(evidence).toEqual({ status: 'invalid', loopStartMs: null, activeMs: null, idleMs: null, invalidFields: ['loopStartMs', 'activeMs', 'idleMs'] });
  expect(JSON.stringify(evidence)).not.toContain('private');
});

test('NFR-005: Given disabled macOS diagnostics, When initialized, Then no event-loop observation occurs and an observation failure is never converted into a clean result', () => {
  const loop = vi.spyOn(performance, 'eventLoopUtilization').mockImplementation(() => { throw new Error('capability read failed'); });
  try {
    expect(startHostIntervalDiagnostics(false, 'darwin')).toBeUndefined(); expect(loop).not.toHaveBeenCalled();
    expect(() => startHostIntervalDiagnostics(true, 'darwin')).toThrow('capability read failed');
  } finally { loop.mockRestore(); }
});

test('NFR-005: Given raw cumulative endpoints around several intervals, When the largest changes, Then only its adjacent endpoints are retained with the original duration and deltas', () => {
  const snapshots = [
    { active: 10, idle: 20, voluntary: 1, involuntary: 2, eventLoop: { status: 'reported' as const, loopStartMs: 1, activeMs: 10, idleMs: 20, invalidFields: [] } },
    { active: 15, idle: 126, voluntary: 2, involuntary: 3, eventLoop: { status: 'reported' as const, loopStartMs: 1, activeMs: 15, idleMs: 126, invalidFields: [] } },
    { active: 18, idle: 132, voluntary: 3, involuntary: 4, eventLoop: { status: 'reported' as const, loopStartMs: 1, activeMs: 18, idleMs: 132, invalidFields: [] } },
    { active: 23, idle: 277, voluntary: 4, involuntary: 6, eventLoop: { status: 'reported' as const, loopStartMs: 1, activeMs: 23, idleMs: 277, invalidFields: [] } },
  ] as const;
  const [first, second, third, fourth] = snapshots; let index = 0;
  const trace = new HostIntervalTrace(() => ({ user: 0, system: 0 }), 2, () => snapshots[index++] ?? snapshots[3]);
  trace.sample(10, 121, 'reading', 'reading'); trace.sample(121, 130, 'reading', 'reading');
  expect(trace.result().largest?.scheduling).toMatchObject({ eventLoop: { from: first?.eventLoop, to: second?.eventLoop } });
  trace.sample(130, 280, 'reading', 'reading');
  expect(trace.result().largest).toMatchObject({ from: 130, to: 280, milliseconds: 150,
    scheduling: { eventLoopActiveMs: 5, eventLoopIdleMs: 145, voluntaryContextSwitches: 1, involuntaryContextSwitches: 2,
      eventLoop: { from: third?.eventLoop, to: fourth?.eventLoop } } });
});

test.each(['win32', 'linux'] as const)('NFR-005: Given %s diagnostics, When sampling and stopping, Then the established scheduling record has no added macOS capability fields', (platform) => {
  const live = startHostIntervalDiagnostics(true, platform); live?.sample(0, 1, 'reading', 'reading');
  expect(live?.stop().largest?.scheduling).not.toHaveProperty('eventLoop');
});

test('NFR-005: Given macOS diagnostics, When sampling and stopping, Then the largest interval includes the raw runtime capability endpoints', () => {
  const live = startHostIntervalDiagnostics(true, 'darwin'); live?.sample(0, 1, 'reading', 'reading');
  const evidence = live?.stop().largest?.scheduling;
  expect(evidence).toHaveProperty('eventLoop.from.loopStartMs'); expect(evidence).toHaveProperty('eventLoop.to.loopStartMs');
});

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

test('NFR-005: Given a low-CPU over-limit interval and cumulative scheduling counters, When the largest raw gap is retained, Then endpoint deltas remain bounded evidence without changing the failure duration', () => {
  const observations = [
    { active: 10, idle: 100, voluntary: 20, involuntary: 4 },
    { active: 13, idle: 363, voluntary: 21, involuntary: 6 },
    { active: 14, idle: 371, voluntary: 22, involuntary: 6 },
  ];
  const trace = new HostIntervalTrace(() => ({ user: 0, system: 0 }), 2,
    () => observations.shift() ?? { active: 14, idle: 371, voluntary: 22, involuntary: 6 });
  trace.sample(100, 366.67525, 'importing/reading', 'importing/reading');
  trace.sample(366.67525, 376, 'importing/reading', 'importing/reading');
  expect(trace.result().largest).toMatchObject({ milliseconds: 266.67525,
    scheduling: { eventLoopActiveMs: 3, eventLoopIdleMs: 263, voluntaryContextSwitches: 1, involuntaryContextSwitches: 2 } });
  expect(trace.result().intervals).toBe(2);
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
  const usage = vi.spyOn(process, 'resourceUsage'); const loop = vi.spyOn(performance, 'eventLoopUtilization');
  try {
    expect(startHostIntervalDiagnostics(false)).toBeUndefined(); expect(cpu).not.toHaveBeenCalled();
    expect(usage).not.toHaveBeenCalled(); expect(loop).not.toHaveBeenCalled();
  } finally { cpu.mockRestore(); usage.mockRestore(); loop.mockRestore(); }
});

test('NFR-005: Given a live diagnostic observer, When one raw timer interval is sampled and stopped twice, Then native observation cleans up and the evidence is stable', async () => {
  const live = startHostIntervalDiagnostics(true); expect(live).toBeDefined();
  const from = performance.now();
  await new Promise<void>((accept) => { setImmediate(accept); });
  live?.sample(from, performance.now(), 'reading', 'reading');
  const result = live?.stop(); expect(result?.intervals).toBe(1);
  expect(result?.largest?.processCpuUserUs).toBeGreaterThanOrEqual(0);
  expect(result?.largest?.scheduling?.eventLoopActiveMs).toBeGreaterThanOrEqual(0);
  expect(result?.largest?.scheduling?.eventLoopIdleMs).toBeGreaterThanOrEqual(0);
  expect(live?.stop()).toEqual(result);
});
