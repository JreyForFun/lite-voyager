import { channel } from 'node:diagnostics_channel';
import { beforeEach, expect, test, vi } from 'vitest';
import { startHostIntervalDiagnostics } from '../../src/test/host-interval-diagnostics';
import { IMPORT_HOST_CHANNEL } from '../../src/import-host-diagnostics';

const controls = vi.hoisted(() => ({
  callbacks: [] as ((entries: { getEntries: () => unknown[] }) => void)[], queued: [] as unknown[],
  observe: vi.fn(), disconnect: vi.fn(), takeRecords: vi.fn(),
  heap: vi.fn(() => ({ used_heap_size: 24, total_heap_size: 30, external_memory: 7, malloced_memory: 5,
    number_of_native_contexts: 2, number_of_detached_contexts: 0 })),
}));
vi.mock('node:v8', () => ({ getHeapStatistics: controls.heap }));
vi.mock('node:perf_hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:perf_hooks')>(),
  PerformanceObserver: class {
    constructor(callback: (entries: { getEntries: () => unknown[] }) => void) { controls.callbacks.push(callback); }
    observe(): void { controls.observe(); }
    takeRecords(): unknown[] { controls.takeRecords(); return controls.queued.splice(0); }
    disconnect(): void { controls.disconnect(); }
  },
}));
beforeEach(() => { vi.clearAllMocks(); controls.callbacks.splice(0); controls.queued.splice(0); });

test('NFR-005: Given Windows callback and queued GC entries plus missing metadata, When the observer stops, Then all raw spans survive, both valid entries are enriched and unavailable context is counted', () => {
  const live = startHostIntervalDiagnostics(true, 'win32'); expect(live).toBeDefined();
  try {
    live?.sample(0, 200, 'reading', 'reading');
    controls.callbacks[0]?.({ getEntries: () => [
      { startTime: 20, duration: 60, detail: { kind: 4, flags: 32 } }, { startTime: 90, duration: 10 },
    ] });
    controls.queued.push({ startTime: 110, duration: 20, detail: { kind: 1, flags: 0 } });
    const result = live?.stop();
    expect(result?.largest?.milliseconds).toBe(200);
    expect(result?.gc.map(({ from, to, milliseconds }) => ({ from, to, milliseconds }))).toEqual([
      { from: 20, to: 80, milliseconds: 60 }, { from: 90, to: 100, milliseconds: 10 }, { from: 110, to: 130, milliseconds: 20 },
    ]);
    expect(result?.gc[0]?.windows).toMatchObject({ kind: 4, flags: 32, heapAtDelivery: { usedBytes: 24 } });
    expect(result?.gc[1]?.windows).toBeUndefined();
    expect(result?.gc[2]?.windows).toMatchObject({ kind: 1, flags: 0, heapAtDelivery: { usedBytes: 24 } });
    expect(result?.untrackedResources).toBeGreaterThanOrEqual(1);
    expect(result?.truncated).toBe(true);
    expect(controls.heap).toHaveBeenCalledTimes(2);
    expect(live?.stop()).toBe(result);
    expect(controls.takeRecords).toHaveBeenCalledTimes(1); expect(controls.disconnect).toHaveBeenCalledTimes(1);
    expect(channel(IMPORT_HOST_CHANNEL).hasSubscribers).toBe(false);
  } finally { live?.stop(); }
});

test.each(['darwin', 'linux'] as const)('NFR-005: Given the existing %s observer, When callback and drained GC entries arrive, Then their original plain shape survives without Windows observation', (platform) => {
  const live = startHostIntervalDiagnostics(true, platform);
  const detail = vi.fn(() => { throw new Error('Windows-only detail must not be read'); });
  const entry = Object.defineProperty({ startTime: 20, duration: 60 }, 'detail', { get: detail });
  try {
    live?.sample(0, 200, 'reading', 'reading'); controls.callbacks[0]?.({ getEntries: () => [entry] }); controls.queued.push(entry);
    expect(live?.stop().gc).toEqual([{ from: 20, to: 80, milliseconds: 60 }, { from: 20, to: 80, milliseconds: 60 }]);
    expect(detail).not.toHaveBeenCalled(); expect(controls.heap).not.toHaveBeenCalled();
  } finally { live?.stop(); }
});

test('NFR-005: Given disabled Windows diagnostics, When initialized, Then neither the observer nor heap sampling starts', () => {
  expect(startHostIntervalDiagnostics(false, 'win32')).toBeUndefined();
  expect(controls.callbacks).toHaveLength(0); expect(controls.heap).not.toHaveBeenCalled(); expect(controls.observe).not.toHaveBeenCalled();
});
