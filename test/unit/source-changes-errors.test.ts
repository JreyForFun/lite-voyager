import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceChanges } from '../../src/editor/source-changes';

// Fail the next N metadata reads the way a briefly locked file does on Windows (EBUSY).
const failures = vi.hoisted(() => ({ stat: 0 }));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  const stat = (async (...args: Parameters<typeof fs.stat>) => {
    if (failures.stat > 0) { failures.stat--; throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' }); }
    return fs.stat(...args);
  }) as typeof fs.stat;
  return { ...fs, stat };
});

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { failures.stat = 0; for (const cleanup of cleanups.splice(0).reverse()) { await cleanup(); } });
async function source(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lv-t033-errors-')); cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'source.data'); await writeFile(path, 'original'); return path;
}
function monitor(path: string): SourceChanges {
  const created = new SourceChanges(path, false, { refresh: () => Promise.resolve(), dirty: () => true, available: () => true, confirm: () => Promise.resolve(true), changed: () => {} },
    { watch: false, intervalMs: 600000 });
  cleanups.push(() => { created.dispose(); return Promise.resolve(); }); return created;
}

test('FR-040: Given one transient metadata read failure, When the next check reads the unchanged source, Then the warning clears without offering refresh', async () => {
  const path = await source(); const changes = monitor(path); await changes.ready;
  failures.stat = 1; await changes.check();
  expect(changes.state).toMatchObject({ changed: true, offered: true }); expect(changes.state.message).toMatch(/Unable to inspect/u);
  await changes.check();
  expect(changes.state).toMatchObject({ changed: false, offered: false, message: '' });
});

test('FR-040: Given the first metadata read fails, When a later check succeeds without any change, Then no external change is reported and later changes still are', async () => {
  const path = await source(); failures.stat = 1; const changes = monitor(path); await changes.ready;
  expect(changes.state.message).toMatch(/could not read file metadata/u);
  await changes.check();
  expect(changes.state).toMatchObject({ changed: false, offered: false, message: '' });
  await writeFile(path, 'external change'); await changes.check();
  expect(changes.state).toMatchObject({ changed: true, offered: true });
});
