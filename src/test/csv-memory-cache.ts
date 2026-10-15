import type { ProcessMemory } from './sqlite-memory-support';
export interface ProcessIdentity { pid: number; stamp: string; }
export interface NativeCounter extends ProcessIdentity { rss: number; }
export interface ProcessMetadata extends ProcessIdentity { parent: number; command: string; }
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function identity(value: unknown): value is ProcessIdentity {
  return typeof value === 'object' && value !== null && 'pid' in value && natural(value.pid) && value.pid > 0
    && 'stamp' in value && typeof value.stamp === 'string' && /^[1-9]\d{0,29}$/u.test(value.stamp);
}
export function parseNativeCounters(text: string): NativeCounter[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || !Array.from(value).every((item: unknown) => identity(item) && 'rss' in item && natural(item.rss))) { throw new Error('Invalid native OS counters.'); }
  return value as NativeCounter[];
}
function metadata(value: unknown): value is ProcessMetadata {
  return identity(value) && 'parent' in value && natural(value.parent) && 'command' in value && typeof value.command === 'string' && value.command.length <= 1024 * 1024;
}
/** Cache only immutable identity/parent/command metadata, never memory counters. */
export class ProcessMemoryCache {
  private readonly entries = new Map<number, ProcessMetadata>();
  async merge(counters: NativeCounter[], discover: (items: ProcessIdentity[]) => Promise<unknown>): Promise<ProcessMemory[]> {
    if (new Set(counters.map((item) => item.pid)).size !== counters.length) { throw new Error('Duplicate native process IDs.'); }
    const alive = new Set(counters.map((item) => item.pid));
    for (const pid of this.entries.keys()) { if (!alive.has(pid)) { this.entries.delete(pid); } }
    const missing = counters.filter((item) => this.entries.get(item.pid)?.stamp !== item.stamp).map(({ pid, stamp }) => ({ pid, stamp }));
    if (missing.length > 0) {
      const found: unknown = await discover(missing);
      if (!Array.isArray(found) || !Array.from(found).every(metadata) || found.length !== missing.length) { throw new Error('Missing or invalid process metadata.'); }
      const rows = found as ProcessMetadata[];
      if (new Set(rows.map((item) => item.pid)).size !== rows.length) { throw new Error('Duplicate process metadata.'); }
      for (const item of missing) {
        if (!rows.some((row) => row.pid === item.pid && row.stamp === item.stamp)) { throw new Error('OS process identity changed during metadata discovery.'); }
      }
      for (const row of rows) { this.entries.set(row.pid, row); }
    }
    return counters.map((counter) => {
      const entry = this.entries.get(counter.pid);
      if (entry === undefined || entry.stamp !== counter.stamp) { throw new Error('Missing current process identity metadata.'); }
      return { pid: counter.pid, parent: entry.parent, command: entry.command, rss: counter.rss };
    });
  }
}
