import { createHook } from 'node:async_hooks';
import { performance, PerformanceObserver } from 'node:perf_hooks';

interface Span { from: number; to: number; milliseconds: number; }
interface CallbackSpan extends Span { type: string; }
interface IntervalSpan extends Span { fromPhase: string; toPhase: string; processCpuUserUs: number; processCpuSystemUs: number; }
interface Cpu { user: number; system: number; }

/** Evidence only: callers supply the same raw timestamps used by their guard. */
export class HostIntervalTrace {
  private previousCpu: Cpu;
  private intervals = 0;
  private largest: IntervalSpan | undefined;
  private readonly callbacks: CallbackSpan[] = [];
  private readonly collections: Span[] = [];
  private matchingCallbacks: CallbackSpan[] = [];
  private matchingGc: Span[] = [];
  private droppedCallbacks = 0;
  private droppedGc = 0;
  private untrackedResources = 0;
  constructor(private readonly cpu: () => Cpu, private readonly capacity = 128) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 128) { throw new Error('Invalid diagnostic trace capacity.'); }
    this.previousCpu = cpu();
  }
  sample(from: number, to: number, fromPhase: string, toPhase: string): void {
    const current = this.cpu();
    const interval = { from, to, milliseconds: to - from, fromPhase, toPhase,
      processCpuUserUs: current.user - this.previousCpu.user, processCpuSystemUs: current.system - this.previousCpu.system };
    this.previousCpu = current; this.intervals++;
    if (this.largest === undefined || interval.milliseconds > this.largest.milliseconds) {
      this.largest = interval;
      this.matchingCallbacks = this.callbacks.filter((entry) => this.overlaps(entry));
      this.matchingGc = this.collections.filter((entry) => this.overlaps(entry));
    }
  }
  callback(type: string, from: number, to: number): void {
    // Short callbacks are outside this trace's explicit >=1-ms scope.
    if (to - from < 1) { return; }
    if (type.length > 128) { this.untrackedResources++; }
    const entry = { type: type.slice(0, 128), from, to, milliseconds: to - from };
    if (this.callbacks.length === this.capacity) { this.callbacks.shift(); this.droppedCallbacks++; }
    this.callbacks.push(entry);
    if (this.overlaps(entry) && this.matchingCallbacks.length < this.capacity) { this.matchingCallbacks.push(entry); }
  }
  gc(from: number, milliseconds: number): void {
    const entry = { from, to: from + milliseconds, milliseconds };
    if (this.collections.length === this.capacity) { this.collections.shift(); this.droppedGc++; }
    this.collections.push(entry);
    if (this.overlaps(entry) && this.matchingGc.length < this.capacity) { this.matchingGc.push(entry); }
  }
  noteUntrackedResources(count: number): void { this.untrackedResources += count; }
  private overlaps(entry: Span): boolean { return this.largest !== undefined && entry.from < this.largest.to && entry.to > this.largest.from; }
  result() {
    return { intervals: this.intervals, largest: this.largest, callbacks: [...this.matchingCallbacks], gc: [...this.matchingGc],
      capacity: this.capacity, droppedCallbacks: this.droppedCallbacks, droppedGc: this.droppedGc, untrackedResources: this.untrackedResources,
      truncated: this.droppedCallbacks > 0 || this.droppedGc > 0 || this.untrackedResources > 0,
      scope: 'Raw timer intervals; process-wide CPU deltas; overlapping GC and >=1-ms async callbacks. Bounded diagnostic evidence, no duration subtraction or cause attribution.' };
  }
}

export function startHostIntervalDiagnostics(enabled: boolean) {
  if (!enabled) { return undefined; }
  const trace = new HostIntervalTrace(() => process.cpuUsage());
  const resources = new Map<number, string>(); const active = new Map<number, { type: string; at: number }>();
  let untracked = 0;
  const hook = createHook({
    init(id, type) { if (resources.size < 4096) { resources.set(id, type); } else { untracked++; } },
    destroy(id) { resources.delete(id); active.delete(id); },
    before(id) {
      const type = resources.get(id); if (type === undefined) { untracked++; }
      if (active.size < 4096) { active.set(id, { type: type ?? 'untracked', at: performance.now() }); } else { untracked++; }
    },
    after(id) { const value = active.get(id); if (value !== undefined) { active.delete(id); trace.callback(value.type, value.at, performance.now()); } },
  });
  const observer = new PerformanceObserver((entries) => { for (const entry of entries.getEntries()) { trace.gc(entry.startTime, entry.duration); } });
  observer.observe({ entryTypes: ['gc'] }); hook.enable();
  let stopped: ReturnType<HostIntervalTrace['result']> | undefined;
  return {
    sample: (from: number, to: number, fromPhase: string, toPhase: string) => { trace.sample(from, to, fromPhase, toPhase); },
    stop: () => {
      if (stopped === undefined) {
        hook.disable();
        for (const entry of observer.takeRecords()) { trace.gc(entry.startTime, entry.duration); }
        observer.disconnect(); resources.clear(); active.clear(); trace.noteUntrackedResources(untracked); stopped = trace.result();
      }
      return stopped;
    },
  };
}
