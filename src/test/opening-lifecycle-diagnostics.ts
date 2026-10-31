import { performance } from 'node:perf_hooks';

interface Stamp { utc: string; monotonicMs: number; timezoneOffsetMinutes: number; }
interface Scope { fallback: boolean; format: string; kind: string; view: number; }
const formats = ['csv', 'tsv', 'json', 'jsonl', 'xlsx', 'all'];
const kinds = ['tabular', 'sqlite', 'cleanup'];
const stages = ['text:start', 'text:complete', 'open:start', 'open:complete', 'preview:ready',
  'import:start', 'import:complete', 'browser:ready', 'hide:start', 'hide:complete',
  'reveal:start', 'reveal:complete', 'close:start', 'tab:closed', 'session:closed', 'close:complete', 'cleanup:start', 'cleanup:complete'] as const;
type Stage = typeof stages[number];
function isScope(value: unknown): value is Scope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) { return false; }
  const scope = value as Record<string, unknown>;
  return typeof scope['fallback'] === 'boolean' && formats.some((format) => format === scope['format'])
    && kinds.some((kind) => kind === scope['kind']) && typeof scope['view'] === 'number'
    && Number.isInteger(scope['view']) && scope['view'] >= 0 && scope['view'] <= 10;
}
function now(): Stamp {
  const date = new Date();
  return { utc: date.toISOString(), monotonicMs: performance.now(), timezoneOffsetMinutes: date.getTimezoneOffset() };
}

/** Test-only passive evidence; no source data, waits, renderer calls or timer adjustment. */
export class OpeningLifecycleTrace {
  private sequence = 0;
  constructor(private readonly enabled: boolean, private readonly clock: () => Stamp = now,
    private readonly report: (line: string) => void = (line) => { console.log(line); }, private readonly capacity = 256) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 256) { throw new Error('Invalid opening lifecycle diagnostic capacity'); }
  }
  record(scope: unknown, stage: Stage): void {
    if (!this.enabled) { return; }
    if (!isScope(scope) || !stages.some((allowed) => allowed === stage)) { throw new Error('Invalid opening lifecycle scope'); }
    if (this.sequence === this.capacity) { throw new Error('Opening lifecycle diagnostic capacity exceeded'); }
    const stamp = this.clock();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp.utc) || !Number.isFinite(Date.parse(stamp.utc))
      || !Number.isFinite(stamp.monotonicMs) || stamp.monotonicMs < 0 || !Number.isInteger(stamp.timezoneOffsetMinutes)
      || Math.abs(stamp.timezoneOffsetMinutes) > 840) { throw new Error('Invalid opening lifecycle timestamp'); }
    this.report(`T030 opening lifecycle: ${JSON.stringify({ sequence: ++this.sequence, fallback: scope.fallback,
      format: scope.format, kind: scope.kind, view: scope.view, stage, utc: stamp.utc,
      monotonicMs: stamp.monotonicMs, timezoneOffsetMinutes: stamp.timezoneOffsetMinutes })}`);
  }
}
