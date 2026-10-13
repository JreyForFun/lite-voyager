export interface ProcessMemory { pid: number; parent: number; rss: number; command: string; }
export interface MemorySample {
  at: number; hostBytes: number; helperBytes: number; rendererBytes: number;
  helperIds: number[]; rendererIds: number[];
}
export interface MemoryReport {
  peakBytes: number; hostPeakBytes: number; helperPeakBytes: number;
  rendererPeakBytes: number; samples: number; helperSamples: number;
  maxGapMs: number; pagingGrowthBytes: number;
}
function natural(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function processRow(value: unknown): value is ProcessMemory {
  return typeof value === 'object' && value !== null
    // Windows includes the legitimate PID-zero System Idle Process. It is
    // never an observed host/helper, but must not invalidate the OS inventory.
    && 'pid' in value && natural(value.pid) && 'parent' in value && natural(value.parent)
    && 'rss' in value && natural(value.rss) && 'command' in value && typeof value.command === 'string';
}
export function parseProcessJson(text: string): ProcessMemory[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value) || value.length === 0 || !value.every(processRow)) { throw new Error('Invalid OS process memory snapshot.'); }
  return value;
}
/** ps RSS is KiB; Win32_Process WorkingSetSize is already bytes. */
export function parseProcessTable(text: string): ProcessMemory[] {
  return parseProcessJson(JSON.stringify(text.trim().split(/\r?\n/u).map((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    if (match === null) { throw new Error('Invalid ps memory snapshot.'); }
    return { pid: Number(match[1]), parent: Number(match[2]), rss: Number(match[3]) * 1024, command: match[4] };
  })));
}
function descendant(pid: number, root: number, processes: Map<number, ProcessMemory>): boolean {
  const seen = new Set<number>();
  while (pid !== 0 && !seen.has(pid)) {
    if (pid === root) { return true; }
    seen.add(pid); pid = processes.get(pid)?.parent ?? 0;
  }
  return false;
}
export function memorySample(rows: ProcessMemory[], hostPid: number, at: number): MemorySample {
  const processes = new Map(rows.map((row) => [row.pid, row]));
  if (processes.size !== rows.length) { throw new Error('Duplicate OS process IDs.'); }
  const host = processes.get(hostPid);
  if (host === undefined || host.rss === 0) { throw new Error('The extension host memory could not be observed.'); }
  const helpers = rows.filter((row) => row.pid !== hostPid && descendant(row.pid, hostPid, processes)
    && /(?:^|[\\/])db-process\.js(?:["']?\s|["']?$)/u.test(row.command));
  const renderers = rows.filter((row) => /(?:^|\s)--type=renderer(?:\s|$)/u.test(row.command)
    && descendant(row.pid, host.parent, processes));
  if (renderers.length === 0 || renderers.some((row) => row.rss === 0)) { throw new Error('The test-host renderer memory could not be observed.'); }
  if (helpers.some((row) => row.rss === 0)) { throw new Error('The database helper memory could not be observed.'); }
  return { at, hostBytes: host.rss, helperBytes: helpers.reduce((sum, row) => sum + row.rss, 0),
    rendererBytes: renderers.reduce((sum, row) => sum + row.rss, 0),
    helperIds: helpers.map((row) => row.pid), rendererIds: renderers.map((row) => row.pid) };
}
export function parseMemorySample(text: string): MemorySample {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || !('at' in value) || typeof value.at !== 'number' || !Number.isFinite(value.at) || value.at < 0
    || !('hostBytes' in value) || !natural(value.hostBytes) || value.hostBytes === 0
    || !('helperBytes' in value) || !natural(value.helperBytes)
    || !('rendererBytes' in value) || !natural(value.rendererBytes) || value.rendererBytes === 0
    || !('helperIds' in value) || !Array.isArray(value.helperIds) || !value.helperIds.every((pid: unknown) => natural(pid) && pid > 0)
    || !('rendererIds' in value) || !Array.isArray(value.rendererIds) || value.rendererIds.length === 0
    || !value.rendererIds.every((pid: unknown) => natural(pid) && pid > 0)) { throw new Error('Invalid sampled memory evidence.'); }
  return value as MemorySample;
}
const combined = (sample: MemorySample): number => sample.hostBytes + sample.helperBytes;
export function checkMemoryRun(samples: MemorySample[], helperPid: number, settledAt = 0): MemoryReport {
  if (samples.length < 5) { throw new Error('At least five memory samples are required.'); }
  const observed = samples.filter((sample) => sample.helperIds.includes(helperPid));
  if (observed.length < 5 || observed.some((sample) => sample.helperBytes === 0)) { throw new Error('At least five actual helper samples are required.'); }
  let maxGapMs = 0;
  for (let i = 1; i < samples.length; i++) {
    const gap = (samples[i]?.at ?? 0) - (samples[i - 1]?.at ?? 0);
    if (gap <= 0) { throw new Error('Memory observations must be monotonic.'); }
    maxGapMs = Math.max(maxGapMs, gap);
  }
  if (maxGapMs > 3000) { throw new Error('The memory observation gap exceeds 3,000 ms.'); }
  const peakBytes = Math.max(...samples.map(combined));
  if (peakBytes >= 500_000_000) { throw new Error(`The combined memory peak ${String(peakBytes)} must be below 500 MB.`); }
  const settled = observed.filter((sample) => sample.at >= settledAt);
  if (settled.length < 5) { throw new Error('At least five settled helper samples are required.'); }
  const initial = Math.max(...settled.slice(0, 3).map(combined));
  const late = Math.max(...settled.slice(-3).map(combined));
  const pagingGrowthBytes = Math.max(0, late - initial);
  if (pagingGrowthBytes > 50_000_000) { throw new Error(`Repeated-paging memory growth ${String(pagingGrowthBytes)} exceeds 50 MB.`); }
  return { peakBytes, hostPeakBytes: Math.max(...samples.map((sample) => sample.hostBytes)),
    helperPeakBytes: Math.max(...samples.map((sample) => sample.helperBytes)),
    rendererPeakBytes: Math.max(...samples.map((sample) => sample.rendererBytes)),
    samples: samples.length, helperSamples: observed.length, maxGapMs, pagingGrowthBytes };
}
export function checkMemoryComparison(smaller: MemoryReport, larger: MemoryReport): void {
  if (larger.peakBytes - smaller.peakBytes > 50_000_000) { throw new Error('File-size memory growth exceeds 50 MB.'); }
}
