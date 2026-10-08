import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createSmallFixtures, generateLargeFixtures, generateStressFixtures, positiveInteger } from './fixtures.mts';

function options(args: string[]): Map<string, string> {
  const allowed = new Set(['--output', '--rows', '--payload-bytes', '--csv-bytes']);
  const result = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (key === undefined || !allowed.has(key) || value === undefined || value.startsWith('--') || result.has(key)) {
      throw new Error('Use small|large|stress followed by unique --output, --rows, --payload-bytes, or --csv-bytes value pairs.');
    }
    result.set(key, value);
  }
  return result;
}

function numberOption(values: Map<string, string>, key: string, fallback: number): number {
  const raw = values.get(key);
  const value = raw === undefined ? fallback : /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  positiveInteger(value, key);
  return value;
}

try {
  const mode = process.argv[2];
  if (mode !== 'small' && mode !== 'large' && mode !== 'stress') { throw new Error('Choose a fixture profile: small, large, or stress.'); }
  const values = options(process.argv.slice(3));
  if (mode !== 'large' && [...values.keys()].some((key) => key !== '--output')) { throw new Error('Row, payload, and byte options apply only to the large profile.'); }
  const output = resolve(values.get('--output') ?? `test/fixtures/generated/${mode}-${randomUUID()}`);
  const start = performance.now();
  if (mode === 'small') { await createSmallFixtures(output); }
  else if (mode === 'stress') { await generateStressFixtures(output); }
  else {
    const result = await generateLargeFixtures(output, {
      rows: numberOption(values, '--rows', 10_000_000),
      payloadBytes: numberOption(values, '--payload-bytes', 96),
      ...(values.has('--csv-bytes') ? { csvBytes: numberOption(values, '--csv-bytes', 1) } : {}),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
  process.stdout.write(`Fixture profile ${mode} completed in ${String(Math.round(performance.now() - start))} ms. Output: ${output}\n`);
} catch (error: unknown) {
  process.stderr.write(`Fixture generation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
