import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

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
let diagnostics: Awaited<ReturnType<typeof import('../src/test/csv-native-diagnostics')['createCsvNativeDiagnostics']>>;
try {
  if (process.platform === 'win32') {
    const cache = new ProcessMemoryCache();
    let native = windowsCsvMemoryScript(name);
    if (process.env['LITE_VOYAGER_INTERVAL_DIAGNOSTICS'] === '1') {
      const { createCsvNativeDiagnostics, instrumentCsvNativeScript } = requireLocal('../out/integration/test/csv-native-diagnostics.js') as typeof import('../src/test/csv-native-diagnostics');
      diagnostics = await createCsvNativeDiagnostics(resolve(dirname(fileURLToPath(import.meta.url)), '../out'), process.platform, '1');
      if (diagnostics !== undefined) { native = instrumentCsvNativeScript(native, diagnostics.path); }
    }
    await observeProcessLines('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(native, 'utf16le').toString('base64')], async (line) => {
      const counters = parseNativeCounters(line);
      const rows = await cache.merge(counters, (items) => Promise.resolve(counters.filter((counter) => items.some((item) => item.pid === counter.pid && item.stamp === counter.stamp))));
      process.stdout.write(`${JSON.stringify(memorySample(rows, hostPid, performance.now() - started))}\n`);
    }, abort.signal, 20000, 3000, true, diagnostics !== undefined);
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
  if (!expectedAbort) {
    const message = error instanceof Error ? error.message : String(error);
    if (diagnostics === undefined) { process.stderr.write(`${message}\n`); }
    else {
      const { reportCsvNativeFailure } = requireLocal('../out/integration/test/csv-native-diagnostics.js') as typeof import('../src/test/csv-native-diagnostics');
      await reportCsvNativeFailure(message, diagnostics);
    }
    process.exitCode = 1;
  }
} finally { process.stdin.pause(); }
