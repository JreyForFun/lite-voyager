import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, extname } from 'node:path';
import { promisify } from 'node:util';

const requireLocal = createRequire(import.meta.url);
const { memorySample, parseProcessTable } = requireLocal('../out/integration/test/sqlite-memory-support.js') as typeof import('../src/test/sqlite-memory-support');
const { ProcessMemoryCache, parseNativeCounters } = requireLocal('../out/integration/test/csv-memory-cache.js') as typeof import('../src/test/csv-memory-cache');
const { observeProcessLines } = requireLocal('../out/integration/test/sqlite-memory-observer.js') as typeof import('../src/test/sqlite-memory-observer');
const { windowsCsvMemoryScript } = requireLocal('../out/integration/test/csv-memory-windows.js') as typeof import('../src/test/csv-memory-windows');
const raw = process.argv[2]; const hostPid = Number(raw);
if (process.argv.length !== 3 || raw === undefined || !/^\d+$/u.test(raw) || !Number.isSafeInteger(hostPid) || hostPid <= 0) { throw new Error('Usage: node scripts/csv-memory.mts <extension-host-pid>'); }
const abort = new AbortController(); process.stdin.resume(); process.stdin.on('end', () => { abort.abort(); });
const started = performance.now(); const execute = promisify(execFile);
// Refreshed native counters, not cached RSS. Metadata is queried only for a new
// PID/start-time pair. Same executable as the host includes all bundled helpers
// and Windows renderers. Other executables cannot be Lite Voyager workers.
// https://learn.microsoft.com/dotnet/api/system.diagnostics.process.workingset64
// https://learn.microsoft.com/dotnet/api/system.diagnostics.process.getprocessesbyname
const name = basename(process.execPath, extname(process.execPath));
try {
  if (process.platform === 'win32') {
    const cache = new ProcessMemoryCache();
    const native = windowsCsvMemoryScript(name);
    await observeProcessLines('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(native, 'utf16le').toString('base64')], async (line) => {
      const counters = parseNativeCounters(line);
      const rows = await cache.merge(counters, (items) => Promise.resolve(counters.filter((counter) => items.some((item) => item.pid === counter.pid && item.stamp === counter.stamp))));
      process.stdout.write(`${JSON.stringify(memorySample(rows, hostPid, performance.now() - started))}\n`);
    }, abort.signal, 20000, 3000, true);
  } else {
    while (!abort.signal.aborted) {
      const result = await execute('ps', ['-axo', 'pid=,ppid=,rss=,command='], { timeout: 3000, maxBuffer: 4 * 1024 * 1024, signal: abort.signal });
      if (result.stderr !== '') { throw new Error(`OS memory diagnostic: ${result.stderr}`); }
      process.stdout.write(`${JSON.stringify(memorySample(parseProcessTable(result.stdout), hostPid, performance.now() - started))}\n`);
      await new Promise<void>((accept) => { setTimeout(accept, 100); });
    }
  }
} catch (error: unknown) {
  const expectedAbort = abort.signal.aborted && error instanceof Error && error.name === 'AbortError';
  if (!expectedAbort) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
} finally { process.stdin.pause(); }
