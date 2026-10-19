import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { startExportProbe } from './export-memory-probe';

async function fixture(onFinished: (cleanup: () => Promise<void>) => void) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, 'lite-voyager-export-cancel-'));
  const script = join(directory, 'probe.cjs'); const ready = join(directory, 'ready');
  let probe: ReturnType<typeof startExportProbe> | undefined;
  onFinished(async () => {
    await probe?.stop(); expect(dirname(directory)).toBe(parent);
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(script, `require('node:fs').writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 1000);`);
  return { ready, script, start(signal: AbortSignal) { probe = startExportProbe(script, signal); return probe; } };
}

test('FR-014: Given a running isolated export probe, When the test is cancelled, Then it rejects only after the child closes and cleanup can remove its files', async ({ onTestFinished }) => {
  const files = await fixture(onTestFinished); const controller = new AbortController();
  const probe = files.start(controller.signal);
  const started = performance.now();
  let pid: number | undefined;
  while (pid === undefined) {
    try { pid = Number(await readFile(files.ready, 'utf8')); }
    catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') { throw error; }
      if (performance.now() - started >= 5000) { throw new Error('Export probe did not report ready'); }
      await new Promise<void>((resolve) => { setTimeout(resolve, 20); });
    }
  }
  expect(Number.isSafeInteger(pid)).toBe(true);
  let closed = false; void probe.closed.then(() => { closed = true; });
  controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      probe.result.then(() => 'unexpected success', (error: unknown) => error),
      new Promise<string>((resolve) => { timer = setTimeout(() => { resolve('child still running'); }, 1000); }),
    ]);
    expect(outcome).toMatchObject({ name: 'AbortError' });
    expect(closed).toBe(true);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally { clearTimeout(timer); }
}, 15000);

test('FR-014: Given an already cancelled test, When starting an isolated export probe, Then cancellation is raised before a child is launched', async ({ onTestFinished }) => {
  const files = await fixture(onTestFinished); const controller = new AbortController(); controller.abort();
  expect(() => files.start(controller.signal)).toThrow();
  await expect(readFile(files.ready)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('FR-014: Given a failing export probe with partial diagnostics, When it closes unsuccessfully, Then its exit status and both captured streams remain available', async ({ signal, onTestFinished }) => {
  const files = await fixture(onTestFinished);
  await writeFile(files.script, "process.stdout.write('partial probe output'); process.stderr.write('probe diagnostic'); process.exitCode = 7;");
  const probe = files.start(signal);
  await expect(probe.result).rejects.toMatchObject({ code: 7, stdout: 'partial probe output', stderr: 'probe diagnostic' });
});
