import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { runCheck, runChecks } from '../../scripts/checks.mts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('verification gate', () => {
  test('T-006: Given a successful command, When checked, Then ordinary output is accepted', async () => {
    await expect(runCheck({ name: 'success', command: process.execPath, args: ['-e', 'console.log("ok")'] }, { echo: false })).resolves.toBeUndefined();
  });

  test('T-006: Given a failing command, When checked, Then its nonzero exit rejects verification', async () => {
    await expect(runCheck({ name: 'failure', command: process.execPath, args: ['-e', 'process.exit(7)'] }, { echo: false })).rejects.toThrow('exit code 7');
  });

  test.each([
    'console.warn("Warning: fixture diagnostic")',
    'console.log("WARN fixture diagnostic")',
    'process.emitWarning("fixture diagnostic", "DeprecationWarning")',
  ])('T-006: Given a zero-exit command emitting a diagnostic, When checked, Then verification rejects it (%s)', async (source) => {
    await expect(runCheck({ name: 'diagnostic', command: process.execPath, args: ['-e', source] }, { echo: false })).rejects.toThrow('emitted a warning');
  });

  test('T-006: Given a missing executable, When checked, Then verification reports the launch failure', async () => {
    await expect(runCheck({ name: 'missing', command: 'lite-voyager-nonexistent-test-executable', args: [] }, { echo: false })).rejects.toThrow('could not start');
  });

  test('T-006: Given a zero-exit command emitting an error, When checked, Then verification rejects it', async () => {
    await expect(runCheck({ name: 'error diagnostic', command: process.execPath, args: ['-e', 'console.error("ERROR fixture diagnostic")'] }, { echo: false })).rejects.toThrow('emitted an error');
  });

  test.each([
    ['warning', 'process.stdout.write("\\u001b["); setTimeout(() => process.stdout.write("33mWarning: fixture diagnostic\\u001b[0m\\n"), 10);', 'emitted a warning'],
    ['error', 'process.stderr.write("\\u001b["); setTimeout(() => process.stderr.write("31mERROR fixture diagnostic\\u001b[0m\\n"), 10);', 'emitted an error'],
  ])('T-009: Given a %s with segmented terminal formatting, When checked, Then assembled output still rejects the diagnostic', async (_label, source, message) => {
    await expect(runCheck({ name: 'segmented diagnostic', command: process.execPath, args: ['-e', source] }, { echo: false })).rejects.toThrow(message);
  });

  test('T-006: Given a failed stage, When verification runs, Then later stages never run', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-gate-'));
    temporaryDirectories.push(directory);
    const marker = join(directory, 'later-stage.txt');
    await expect(runChecks([
      { name: 'failure', command: process.execPath, args: ['-e', 'process.exit(2)'] },
      { name: 'later', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "ran")', marker] },
    ], { echo: false })).rejects.toThrow('exit code 2');
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('unit-test reporter through the verification gate', () => {
  async function checkFixture(body: string, title = 'T-009: diagnostic fixture', agent = false, colors = true): Promise<void> {
    const root = resolve('.');
    const output = join(root, 'out');
    await mkdir(output, { recursive: true });
    const directory = await mkdtemp(join(output, 'reporter-fixture-'));
    temporaryDirectories.push(directory);
    const tests = join(directory, 'test', 'unit');
    await mkdir(tests, { recursive: true });
    await writeFile(join(tests, 'fixture.test.ts'),
      `import { setTimeout as delay } from 'node:timers/promises';\nimport { expect, test } from 'vitest';\ntest(${JSON.stringify(title)}, async () => { ${body} });\n`);
    await runCheck({
      name: 'fixture unit tests',
      command: process.execPath,
      args: [join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run',
        '--config', join(root, 'vitest.config.mts'), '--root', directory],
    }, { cwd: root, echo: false, env: {
      ...process.env, CI: 'true', GITHUB_ACTIONS: 'true',
      AI_AGENT: agent ? 'fixture' : undefined,
      CODEX_THREAD_ID: undefined, CODEX_SANDBOX: undefined,
      NO_COLOR: colors ? undefined : '1', FORCE_COLOR: colors ? '1' : undefined,
      NODE_DISABLE_COLORS: undefined, TERM: 'xterm',
    } });
  }

  test('T-009: Given successful tests mentioning error and warning, When the CI reporter is checked, Then descriptions do not become diagnostics', async () => {
    // The default reporter prints slow successful titles; Ubuntu hit its 300-ms threshold.
    await expect(checkFixture('await delay(350); expect(1).toBe(1);',
      'FR-001: Given truncated.sqlite, When opened, Then a clear error permits recovery without warning diagnostics')).resolves.toBeUndefined();
  });

  describe.each([false, true])('agent environment: %s', (agent) => {
    describe.each([false, true])('terminal colors: %s', (colors) => {
      test.each([
        ['stdout severity warning', 'console.log("Warning: fixture diagnostic");', 'emitted a warning'],
        ['stderr severity warning', 'console.warn("Warning: fixture diagnostic");', 'emitted a warning'],
        ['stdout severity error', 'console.log("ERROR fixture diagnostic");', 'emitted an error'],
        ['stderr severity error', 'console.error("ERROR fixture diagnostic");', 'emitted an error'],
      ])('T-009: Given a passing test emitting %s, When the reporter is checked, Then verification still rejects the diagnostic', async (_label, body, message) => {
        await expect(checkFixture(body, undefined, agent, colors)).rejects.toThrow(message);
      });
    });
  });

  test('T-009: Given a failed assertion, When the CI reporter is checked, Then verification still rejects the nonzero test exit', async () => {
    await expect(checkFixture('expect(1).toBe(2);')).rejects.toThrow('exit code 1');
  });
});
