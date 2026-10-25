import { channel } from 'node:diagnostics_channel';
import { performance } from 'node:perf_hooks';

export const IMPORT_HOST_CHANNEL = 'lite-voyager.import.host';
const stages = ['webview-state', 'lifecycle-output', 'storage-initialize', 'source-snapshot', 'space-check', 'storage-create',
  'import-work-directory', 'import-helper-fork', 'import-helper-register', 'import-helper-send'] as const;
type Stage = typeof stages[number];
export interface ImportHostSpan {
  stage: Stage; kind: 'sync' | 'await'; from: number; to: number; milliseconds: number;
  processCpuUserUs: number; processCpuSystemUs: number;
}
const sink = channel(IMPORT_HOST_CHANNEL);
function started() { return { from: performance.now(), cpu: process.cpuUsage() }; }
function finished(stage: Stage, kind: ImportHostSpan['kind'], start: ReturnType<typeof started>): void {
  const to = performance.now(); const cpu = process.cpuUsage();
  sink.publish({ stage, kind, from: start.from, to, milliseconds: to - start.from,
    processCpuUserUs: cpu.user - start.cpu.user, processCpuSystemUs: cpu.system - start.cpu.system } satisfies ImportHostSpan);
}
/** Fixed-label, opt-in evidence only. No subscriber means no clock/CPU sampling. */
export function traceHostSync<T>(stage: Stage, operation: () => T): T {
  if (!sink.hasSubscribers) { return operation(); }
  const start = started();
  try { return operation(); } finally { finished(stage, 'sync', start); }
}
/** Await spans include yielded time; they are not synchronous blocking measurements. */
export function traceHostAwait<T>(stage: Stage, operation: () => Promise<T>): Promise<T> {
  if (!sink.hasSubscribers) { return operation(); }
  const start = started();
  try {
    return operation().then((value) => { finished(stage, 'await', start); return value; },
      (error: unknown) => { finished(stage, 'await', start); throw error; });
  } catch (error: unknown) { finished(stage, 'await', start); throw error; }
}
export function isImportHostSpan(value: unknown): value is ImportHostSpan {
  if (typeof value !== 'object' || value === null) { return false; }
  const span = value as Record<string, unknown>;
  return stages.some((stage) => stage === span['stage']) && (span['kind'] === 'sync' || span['kind'] === 'await')
    && ['from', 'to', 'milliseconds', 'processCpuUserUs', 'processCpuSystemUs'].every((key) => typeof span[key] === 'number' && Number.isFinite(span[key]) && span[key] >= 0)
    && typeof span['to'] === 'number' && typeof span['from'] === 'number' && span['to'] >= span['from'] && span['milliseconds'] === span['to'] - span['from'];
}
