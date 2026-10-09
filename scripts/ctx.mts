import { resolve } from 'node:path';
import { buildContext, readText } from './spec-tools.mts';

try {
  const args = process.argv.slice(2);
  const task = args[0];
  if (args.length !== 1 || task === undefined || !/^T-\d{3}$/u.test(task)) {
    throw new Error('Usage: npm run ctx -- T-012 (one task ID in T-000 format).');
  }
  const root = resolve(import.meta.dirname, '..');
  const [tasks, specification, constitution] = await Promise.all([
    readText(resolve(root, 'specs/TASKS.md')),
    readText(resolve(root, 'specs/SPEC.md')),
    readText(resolve(root, 'specs/CONSTITUTION.md')),
  ]);
  process.stdout.write(buildContext(tasks, specification, constitution, task));
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
