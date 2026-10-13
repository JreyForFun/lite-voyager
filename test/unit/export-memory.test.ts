import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { expect, test } from 'vitest';

test('FR-014: Given one million generated rows, When streaming to a discard sink in an isolated process, Then output exceeds 100 MB with bounded chunks and measured memory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-memory-'));
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
    const built = await build({ entryPoints: [input], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
    expect(built.warnings).toEqual([]);
    const execution = await promisify(execFile)(process.execPath, [output]); expect(execution.stderr).toBe('');
    const evidence: unknown = JSON.parse(execution.stdout);
    expect(evidence).toMatchObject({ rows: '1000000', blobs: '0', maximumChunk: 65536 });
    if (typeof evidence !== 'object' || evidence === null || !('bytes' in evidence) || typeof evidence.bytes !== 'string'
      || !('baseline' in evidence) || typeof evidence.baseline !== 'number' || !('peak' in evidence) || typeof evidence.peak !== 'number') { throw new Error('Missing export memory evidence'); }
    expect(BigInt(evidence.bytes)).toBeGreaterThan(100000000n);
    expect(evidence.peak - evidence.baseline).toBeLessThan(128 * 1024 * 1024);
    console.log(`T-015 serializer memory evidence: ${execution.stdout}`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 60000);
