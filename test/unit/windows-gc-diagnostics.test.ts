import { expect, test, vi } from 'vitest';
import { captureWindowsGcContext } from '../../src/test/windows-gc-diagnostics';
import { HostIntervalTrace } from '../../src/test/host-interval-diagnostics';

const heap = { used_heap_size: 24000000, total_heap_size: 30000000, external_memory: 7000000,
  malloced_memory: 540000, number_of_native_contexts: 2, number_of_detached_contexts: 0 };

test.each(['darwin', 'linux'] as const)('NFR-005: Given the passing %s diagnostic path, When optional GC context is requested, Then neither event detail nor native heap or clock is read', (platform) => {
  const detail = vi.fn(() => { throw new Error('Non-Windows event detail must not be read'); });
  const entry = Object.defineProperty({}, 'detail', { get: detail });
  const readHeap = vi.fn(() => heap); const now = vi.fn(() => 500);
  expect(captureWindowsGcContext(platform, entry, readHeap, now)).toBeUndefined();
  expect(detail).not.toHaveBeenCalled(); expect(readHeap).not.toHaveBeenCalled(); expect(now).not.toHaveBeenCalled();
});

test('NFR-010: Given a Windows GC event and heap with extra private properties, When context is captured, Then only fixed numeric fields survive and delivery time is explicit', () => {
  const context = captureWindowsGcContext('win32', { detail: { kind: 4, flags: 32, privateData: 'secret.csv SELECT password' } },
    () => ({ ...heap, source: 'secret.csv' }), () => 501.25);
  expect(context).toEqual({ kind: 4, flags: 32, deliveredAtMs: 501.25,
    heapAtDelivery: { usedBytes: 24000000, totalBytes: 30000000, externalBytes: 7000000, mallocedBytes: 540000, nativeContexts: 2, detachedContexts: 0 } });
  expect(JSON.stringify(context)).not.toContain('secret');
});

test.each([undefined, null, {}, { detail: null }, { detail: { kind: '4', flags: 32 } },
  { detail: { kind: 4.5, flags: 32 } }, { detail: { kind: 4, flags: -1 } }, { detail: { kind: NaN, flags: 0 } }])(
  'NFR-005: Given unavailable or malformed GC metadata %j, When capturing context, Then no kind or flag is invented', (entry) => {
    const readHeap = vi.fn(() => heap);
    expect(captureWindowsGcContext('win32', entry, readHeap, () => 10)).toBeUndefined();
    expect(readHeap).not.toHaveBeenCalled();
  },
);

test.each([{ ...heap, used_heap_size: -1 }, { ...heap, external_memory: Infinity }, { ...heap, number_of_native_contexts: '2' }])(
  'NFR-005: Given invalid native heap evidence %j, When capturing context, Then it is unavailable rather than retained as valid memory data', (invalid) => {
    expect(captureWindowsGcContext('win32', { detail: { kind: 4, flags: 0 } }, () => invalid, () => 10)).toBeUndefined();
  },
);

test('NFR-005: Given a failed native observation, When capturing diagnostic context, Then unavailable evidence cannot throw from the GC observer and hide the raw interval', () => {
  expect(captureWindowsGcContext('win32', { detail: { kind: 4, flags: 0 } }, () => { throw new Error('Native observation unavailable'); }, () => 10)).toBeUndefined();
});

test('NFR-005: Given the reported Windows raw interval and overlapping GC, When enriched bounded evidence is retained, Then elapsed time and every original span are unchanged', () => {
  const trace = new HostIntervalTrace(() => ({ user: 0, system: 0 }), 2);
  trace.sample(334287.7364, 334390.1901, 'importing/none', 'importing/none');
  const context = captureWindowsGcContext('win32', { detail: { kind: 4, flags: 32 } }, () => heap, () => 334391);
  trace.gc(334287.8878, 102.14139999996405, context);
  expect(trace.result().largest?.milliseconds).toBe(102.45370000001276);
  expect(trace.result().gc).toEqual([{ from: 334287.8878, to: 334390.0292, milliseconds: 102.14139999996405, windows: context }]);
  for (let index = 0; index < 10; index++) { trace.gc(334288 + index, 1, context); }
  expect(trace.result().gc).toHaveLength(2);
  expect(trace.result().droppedGc).toBe(9);
  expect(trace.result().truncated).toBe(true);
});
