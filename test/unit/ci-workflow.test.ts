import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

const workflow = (): Promise<string> => readFile('.github/workflows/ci.yml', 'utf8');

// These contract checks guard the gate's wiring. GitHub Actions must still run
// the workflow; text checks cannot establish runner compatibility or YAML validity.
test('T-007: Given a push or pull request, When CI is configured, Then verification has no branch or path exclusions', async () => {
  const text = await workflow();
  expect(text).toMatch(/^on:\s*\[push, pull_request, workflow_dispatch\]\s*$/m);
  expect(text).not.toMatch(/^\s*(?:branches(?:-ignore)?|paths(?:-ignore)?):/m);
});

test('T-007: Given the platform matrix, When one platform fails, Then all three platforms still report their results', async () => {
  const text = await workflow();
  expect(text).toMatch(/^    runs-on: \$\{\{ matrix\.os \}\}\s*$/m);
  expect(text).toMatch(/^    strategy:\s*\r?\n      fail-fast: false\s*\r?\n      matrix:\s*\r?\n        os: \[ubuntu-latest, windows-latest, macos-latest\]\s*$/m);
});

test('T-007: Given a fresh runner, When dependencies install, Then CI uses the tested Node runtime and the lockfile before verification', async () => {
  const text = await workflow();
  expect(text).toMatch(/^      - name: Set up Node\.js\s*\r?\n        uses: actions\/setup-node@\S+\s*\r?\n        with:\s*\r?\n          node-version: '26\.5\.0'\s*$/m);
  expect(text).toMatch(/^        run: npm ci\s*$/m);
  expect(text.indexOf('npm run verify:full')).toBeGreaterThan(text.indexOf('run: npm ci'));
  expect(text).not.toMatch(/npm install|npm update/);
});

test('T-007: Given a Linux runner, When verification executes, Then the entire full gate runs inside xvfb', async () => {
  const text = await workflow();
  expect(text).toMatch(/^        if: runner\.os == 'Linux'\s*\r?\n        run: dbus-run-session -- xvfb-run -a npm run verify:full\s*$/m);
});

test('T-007: Given a runner without a usable session bus, When Linux verification starts, Then a fresh D-Bus session supplies the address', async () => {
  const text = await workflow();
  expect(text).toMatch(/^        run: dbus-run-session -- /m);
  expect(text).not.toMatch(/DBUS_SESSION_BUS_ADDRESS\s*[:=]/);
});

test('T-007: Given a Windows or macOS runner, When verification executes, Then the full gate runs and failures cannot be ignored', async () => {
  const text = await workflow();
  expect(text).toMatch(/^        if: runner\.os != 'Linux'\s*\r?\n        run: npm run verify:full\s*$/m);
  expect(text).not.toMatch(/continue-on-error|NODE_NO_WARNINGS|--disable-warning|--no-warnings|\|\|\s*true|\bexit\s+0\b/);
  expect(text.match(/^        run:/gm)).toHaveLength(3);
});
