import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import { expect, test } from 'vitest';
import { startExportProbe } from './export-memory-probe';

test('FR-014: Given one million generated rows, When streaming to a discard sink in an isolated process, Then output exceeds 100 MB with bounded chunks and measured memory', async ({ signal, onTestFinished }) => {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, 'lite-voyager-t015-memory-'));
  let probe: ReturnType<typeof startExportProbe> | undefined;
  let cleaning: Promise<void> | undefined;
  const cleanup = (): Promise<void> => {
    cleaning ??= (async () => {
      await probe?.stop(); expect(dirname(directory)).toBe(parent);
      await rm(directory, { recursive: true, force: true });
    })();
    return cleaning;
  };
  onTestFinished(cleanup);
  const started = performance.now();
  const stage = (phase: string): void => { console.log(`T-025 export probe stage: ${JSON.stringify({ phase, milliseconds: performance.now() - started })}`); };
  stage('setup');
  try {
    const input = join(directory, 'probe.ts'); const output = join(directory, 'probe.cjs');
    await writeFile(input, `import { serializeResults } from ${JSON.stringify(resolve('src/worker/result-export.ts'))};
      const baseline = process.memoryUsage().rss; let peak = baseline; let maximumChunk = 0; let chunks = 0;
      const text = 'x'.repeat(128); const started = performance.now();
      const cursor = { columns: ['id', 'value'], rows: (function* () { for (let i = 0; i < 1000000; ++i) yield [BigInt(i), text]; })(), close() {} };
      serializeResults(cursor, 'json', (chunk) => {
        peak = Math.max(peak, process.memoryUsage().rss); maximumChunk = Math.max(maximumChunk, chunk.byteLength); ++chunks;
        return Promise.resolve();
      }).then((report) => process.stdout.write(JSON.stringify({ ...report, baseline, peak, maximumChunk, chunks, milliseconds: performance.now()-started })),
        () => { process.exitCode = 1; });
    `);
    stage('build:start');
    const built = await build({ entryPoints: [input], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
    expect(built.warnings).toEqual([]);
    stage('build:complete');
    probe = startExportProbe(output, signal); stage('child:start');
    const execution = await probe.result; stage('child:complete'); expect(execution.stderr).toBe('');
    const evidence: unknown = JSON.parse(execution.stdout);
    expect(evidence).toMatchObject({ rows: '1000000', blobs: '0', maximumChunk: 65536 });
    if (typeof evidence !== 'object' || evidence === null || !('bytes' in evidence) || typeof evidence.bytes !== 'string'
      || !('baseline' in evidence) || typeof evidence.baseline !== 'number' || !('peak' in evidence) || typeof evidence.peak !== 'number') { throw new Error('Missing export memory evidence'); }
    expect(BigInt(evidence.bytes)).toBeGreaterThan(100000000n);
    expect(evidence.peak - evidence.baseline).toBeLessThan(128 * 1024 * 1024);
    console.log(`T-015 serializer memory evidence: ${execution.stdout}`);
  } finally { stage('body:finished'); await cleanup(); }
}, 60000);
