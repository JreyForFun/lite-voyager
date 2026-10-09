import { resolve } from 'node:path';
import { findUntestedRequirements, readTestSources, readText } from './spec-tools.mts';

try {
  if (process.argv.length !== 2) { throw new Error('Usage: npm run trace (no arguments).'); }
  const root = resolve(import.meta.dirname, '..');
  const [specification, sources] = await Promise.all([
    readText(resolve(root, 'specs/SPEC.md')),
    readTestSources(root),
  ]);
  const gaps = findUntestedRequirements(specification, sources);
  process.stdout.write(gaps.length === 0 ? 'All FR/NFR requirements have a matching named test.\n' :
    `Requirements without a matching named test:\n${gaps.join('\n')}\n`);
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
