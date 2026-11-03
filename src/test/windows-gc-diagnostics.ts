import { performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';

export interface WindowsGcContext {
  kind: number;
  flags: number;
  deliveredAtMs: number;
  heapAtDelivery: { usedBytes: number; totalBytes: number; externalBytes: number; mallocedBytes: number; nativeContexts: number; detachedContexts: number };
}

function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
const monotonicNow = (): number => performance.now();

/** Test-only Windows context. Delivery heap is not GC-start heap or allocation provenance. */
export function captureWindowsGcContext(platform: NodeJS.Platform, entry: unknown,
  readHeap: () => unknown = getHeapStatistics, now: () => number = monotonicNow): WindowsGcContext | undefined {
  if (platform !== 'win32') { return undefined; }
  try {
    if (!record(entry)) { return undefined; }
    const detail: unknown = entry['detail'];
    if (!record(detail) || !integer(detail['kind']) || !integer(detail['flags'])) { return undefined; }
    const heap = readHeap(); if (!record(heap)) { return undefined; }
    const used = heap['used_heap_size']; const total = heap['total_heap_size']; const external = heap['external_memory'];
    const malloced = heap['malloced_memory']; const native = heap['number_of_native_contexts']; const detached = heap['number_of_detached_contexts'];
    if (!integer(used) || !integer(total) || !integer(external) || !integer(malloced) || !integer(native) || !integer(detached)) { return undefined; }
    const deliveredAtMs = now(); if (!Number.isFinite(deliveredAtMs) || deliveredAtMs < 0) { return undefined; }
    return { kind: detail['kind'], flags: detail['flags'], deliveredAtMs,
      heapAtDelivery: { usedBytes: used, totalBytes: total, externalBytes: external, mallocedBytes: malloced, nativeContexts: native, detachedContexts: detached } };
  } catch { return undefined; }
}
