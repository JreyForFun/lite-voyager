import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { afterEach, expect, test, vi } from 'vitest';
import { ImportHelper, UnconfirmedImportExitError } from '../../src/loaders/import-helper';
import { runCsvImport } from '../../src/loaders/csv-import-client';

const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) { await rm(path, { recursive: true, force: true }); } });

async function fixture(mode: 'slow' | 'failure' | 'spawn-error' = 'slow'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t030-launch-')); directories.push(directory);
  await writeFile(join(directory, 'csv-import-process.js'), `
    const {writeFileSync} = require('node:fs');
    writeFileSync(__dirname + '/helper-pid', String(process.pid));
    process.on('disconnect', () => process.exit(0));
    process.on('message', value => { writeFileSync(__dirname + '/request-started', 'yes'); process.send({echo:value, pid:process.pid}); });
    setTimeout(() => process.exit(2), 10000).unref();
  `);
  await build({ entryPoints: [resolve('src/worker/csv-import-launch-worker.ts')], outfile: join(directory, 'csv-import-launch-worker.js'),
    bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', plugins: [{ name: 'owned-slow-fork-fixture', setup(context) {
      context.onResolve({ filter: /^node:child_process$/ }, () => ({ path: 'fork', namespace: 'owned-launch-fixture' }));
      context.onResolve({ filter: /^native-child-process$/ }, () => ({ path: 'node:child_process', external: true }));
      context.onLoad({ filter: /.*/, namespace: 'owned-launch-fixture' }, () => ({ contents: `
        import {fork as original} from 'native-child-process';
        export function fork(...args) {
          ${mode === 'failure' ? "throw new Error('owned spawn failure');" : mode === 'spawn-error' ? "return original(args[0], args[1], {...args[2],execPath:args[0] + '.nonexistent'});" : 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,350); return original(...args);'}
        }
      `, loader: 'js' }));
    } }] });
  return directory;
}

test('NFR-005: Given an actual helper fork stalled for 350 ms in its launcher, When awaiting startup, Then the original host timer keeps ticking below 100 ms and IPC and confirmed shutdown remain intact', async () => {
  const directory = await fixture(); let last = performance.now(); let maximum = 0; let ticks = 0;
  const timer = setInterval(() => { const now = performance.now(); maximum = Math.max(maximum, now - last); last = now; ticks++; }, 10);
  const started = performance.now(); const helper = new ImportHelper(directory);
  try {
    await helper.ready;
    const now = performance.now(); maximum = Math.max(maximum, now - last);
    expect(now - started).toBeGreaterThanOrEqual(350); expect(ticks).toBeGreaterThan(5); expect(maximum).toBeLessThanOrEqual(100);
    expect(helper.pid).toBeGreaterThan(0); expect(helper.connected).toBe(true);
    const reply = once(helper, 'message');
    await new Promise<void>((accept, reject) => { helper.send({ value: 'exact \u0000 🚀', integer: 9223372036854775807n }, error => { if (error === null) { accept(); } else { reject(error); } }); });
    expect((await reply)[0]).toEqual({ echo: { value: 'exact \u0000 🚀', integer: 9223372036854775807n }, pid: helper.pid });
    const received: unknown[] = []; helper.on('message', (value: unknown) => { received.push(value); });
    await Promise.all([1, 2, 3].map(value => new Promise<void>((accept, reject) => {
      helper.send(value, error => { if (error === null) { accept(); } else { reject(error); } });
    })));
    await vi.waitFor(() => { expect(received).toEqual([1, 2, 3].map(value => ({ echo: value, pid: helper.pid }))); });
  } finally { clearInterval(timer); helper.kill('SIGKILL'); await helper.closed; }
  expect(helper.connected).toBe(false); expect(() => process.kill(helper.pid!, 0)).toThrow();
});

test('FR-007: Given cancellation while the launcher is blocked before returning a PID, When stopping it, Then its eventual helper exits before closure resolves and no request starts', async () => {
  const directory = await fixture(); const helper = new ImportHelper(directory);
  const ready = helper.ready.catch((error: unknown) => error);
  helper.kill('SIGKILL'); await helper.closed; await ready;
  expect(helper.connected).toBe(false);
  expect(await readFile(join(directory, 'request-started'), 'utf8').catch(() => 'absent')).toBe('absent');
  const pid = Number(await readFile(join(directory, 'helper-pid'), 'utf8').catch(() => '0'));
  if (pid > 0) { expect(() => process.kill(pid, 0)).toThrow(); }
});

test('FR-007: Given a launcher fork failure, When startup rejects, Then closure confirms no live helper and the original actionable error is retained', async () => {
  const helper = new ImportHelper(await fixture('failure'));
  await expect(helper.ready).rejects.toThrow('owned spawn failure'); await helper.closed;
  expect(helper.pid).toBeUndefined(); expect(helper.connected).toBe(false);
});

test('FR-007: Given an asynchronous OS spawn failure, When the child emits its error and close, Then startup fails and confirmed closure completes', async () => {
  const helper = new ImportHelper(await fixture('spawn-error'));
  await expect(helper.ready).rejects.toThrow(/CSV import helper failed.*ENOENT/u); await helper.closed;
  expect(helper.pid).toBeUndefined(); expect(helper.connected).toBe(false);
});

test('FR-007: Given a launcher exiting without confirming child closure, When awaiting shutdown, Then it rejects instead of claiming that private storage is safe to remove', async () => {
  const directory = await fixture('failure');
  await writeFile(join(directory, 'csv-import-launch-worker.js'), 'process.exit(0);');
  const helper = new ImportHelper(directory);
  await expect(helper.ready).rejects.toThrow('without confirmed helper closure');
  await expect(helper.closed).rejects.toBeInstanceOf(UnconfirmedImportExitError);
  await expect(helper.closed).rejects.toThrow('Private import storage was retained');
  const source = join(directory, 'source.csv'); await writeFile(source, 'a\n1\n');
  const failed = runCsvImport(directory, source, { path: join(directory, 'output.sqlite'), engine: 'node:sqlite' }, {}, () => {}, new AbortController().signal);
  await expect(failed).rejects.toBeInstanceOf(UnconfirmedImportExitError);
  await expect(failed).rejects.toThrow('without confirmed helper closure');
  const files = await readdir(directory);
  expect(files.filter(name => name.startsWith('.lv-import-'))).toHaveLength(1);
  expect(files).not.toContain('output.sqlite'); expect(await readFile(source, 'utf8')).toBe('a\n1\n');
});
