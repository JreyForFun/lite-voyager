import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ExportService } from '../../src/editor/export-service';
import type { Engine, EngineOpened } from '../../src/engine/engine';
import { SqliteSession } from '../../src/editor/sqlite-session';

vi.mock('node:fs/promises', async (importOriginal) => {
  const files = await importOriginal<typeof import('node:fs/promises')>();
  return { ...files, rename: vi.fn(files.rename), rm: vi.fn(files.rm) };
});

test.each([false, true])('FR-014: Given editor closure during atomic Saving and rename success=%s, When publication settles, Then save failure stays visible and successful saves do not become errors', async (succeeds) => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-closed-save-'));
  const files = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  try {
    const source = join(directory, 'source'); const output = join(directory, 'output'); await writeFile(source, 'original'); await writeFile(output, 'old');
    const page = { columns: ['v'], rows: [['1']], hasMore: false };
    const opened: EngineOpened = { engine: 'node:sqlite', memoryLimited: false, bytes: '8', needsConsent: false, notice: 'Primary engine', threadId: 1, processId: 1, sqlite: 'test' };
    const engine: Engine = {
      open: () => Promise.resolve(opened), close: () => Promise.resolve(), cancel: () => Promise.resolve(),
      query: () => Promise.resolve(page), schema: () => Promise.resolve(page), columns: () => Promise.resolve(page),
      indexes: () => Promise.resolve(page), indexColumns: () => Promise.resolve(page), page: () => Promise.resolve(page), grid: () => Promise.resolve(page),
      exportResults: async (_sql, _format, path) => { await writeFile(path, 'complete'); return { rows: '1', bytes: '8', blobs: '0' }; },
    };
    const session = new SqliteSession(source, engine); await session.start(() => Promise.resolve(true));
    session.configureExport(() => Promise.resolve(output));
    await session.browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT 1', offset: 0, limit: 1 }, () => {});
    let began!: () => void; const saving = new Promise<void>((resolveStart) => { began = resolveStart; });
    let finish!: () => void; let fail!: (error: Error) => void;
    vi.mocked(rename).mockImplementationOnce((from, to) => new Promise<void>((resolveRename, rejectRename) => {
      finish = () => { void files.rename(from, to).then(resolveRename, rejectRename); }; fail = rejectRename; began();
    }));
    const exporting = session.browser.handle({ type: 'browserExport', requestId: 2, format: 'csv' }, () => {});
    await saving; const closing = session.close();
    if (succeeds) { finish(); } else { fail(new Error('file busy')); }
    await Promise.all([exporting, closing, session.closed]);
    if (succeeds) { expect(session.state.phase).toBe('closed'); expect(await readFile(output, 'utf8')).toBe('complete'); }
    else { expect(session.state.phase).toBe('error'); expect(session.state.message).toContain('The export could not be saved'); expect(await readFile(output, 'utf8')).toBe('old'); }
    expect(await readFile(source, 'utf8')).toBe('original'); expect(await readdir(directory)).toEqual(['output', 'source']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('FR-014: Given atomic rename failure, When committing export, Then existing output survives and a clear retry instruction is returned', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-rename-'));
  try {
    const source = join(directory, 'source'); const destination = join(directory, 'output');
    await writeFile(source, 'original'); await writeFile(destination, 'old');
    const engine: Pick<Engine, 'exportResults'> = { exportResults: async (_sql, _format, path) => {
      await writeFile(path, 'complete'); return { rows: '1', bytes: '8', blobs: '0' };
    } };
    vi.mocked(rename).mockRejectedValueOnce(new Error('file busy'));
    const service = new ExportService(source, engine, () => Promise.resolve(destination));
    await expect(service.run('SELECT 1', 'csv', () => {})).rejects.toThrow(/Close programs|permissions/u);
    await expect(service.settled()).rejects.toThrow(/The export could not be saved/u);
    expect(await readFile(destination, 'utf8')).toBe('old'); expect(await readFile(source, 'utf8')).toBe('original');
    expect(await readdir(directory)).toEqual(['output', 'source']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('FR-014: Given cancelled export with cleanup failure, When awaiting recovery cleanup, Then the cleanup problem remains visible instead of being swallowed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lite-voyager-t015-cleanup-'));
  try {
    const source = join(directory, 'source'); const destination = join(directory, 'output');
    await writeFile(source, 'original'); await writeFile(destination, 'old');
    const service = new ExportService(source, { exportResults: () => Promise.reject(new Error('cancelled')) }, () => Promise.resolve(destination));
    vi.mocked(rm).mockRejectedValueOnce(new Error('permission denied'));
    await expect(service.run('SELECT 1', 'csv', () => {})).rejects.toThrow(/temporary files could not be removed/u);
    await expect(service.settled()).rejects.toThrow(/temporary files could not be removed/u);
    expect(await readFile(destination, 'utf8')).toBe('old'); expect(await readFile(source, 'utf8')).toBe('original');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
