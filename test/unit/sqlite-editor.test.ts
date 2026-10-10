import { readFile } from 'node:fs/promises';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Engine, EngineMode, EngineOpened, OpenOptions } from '../../src/engine/engine';
import { SqliteSession } from '../../src/editor/sqlite-session';

const mode: EngineMode = { engine: 'sql.js', memoryLimited: true, bytes: '200000001', needsConsent: true, notice: 'Memory-limited mode' };
const opened: EngineOpened = { ...mode, sqlite: 'test', threadId: 1, processId: 123 };
const empty = { columns: [], rows: [], hasMore: false };
function fakeEngine() {
  return {
    open: vi.fn<Engine['open']>().mockResolvedValue(opened),
    close: vi.fn<Engine['close']>().mockResolvedValue(undefined),
    cancel: vi.fn<Engine['cancel']>().mockResolvedValue(undefined),
    schema: vi.fn<Engine['schema']>().mockResolvedValue(empty),
    columns: vi.fn<Engine['columns']>().mockResolvedValue(empty),
    indexes: vi.fn<Engine['indexes']>().mockResolvedValue(empty),
    indexColumns: vi.fn<Engine['indexColumns']>().mockResolvedValue(empty),
    page: vi.fn<Engine['page']>().mockResolvedValue(empty),
    query: vi.fn<Engine['query']>().mockResolvedValue(empty),
  };
}
let engine = fakeEngine();
beforeEach(() => { engine = fakeEngine(); });

test('FR-001: Given the manifest, When opening SQLite extensions, Then the binary editor is the default for all four extensions', async () => {
  const manifest: unknown = JSON.parse(await readFile('package.json', 'utf8'));
  expect(manifest).toMatchObject({ contributes: { customEditors: [{
    viewType: 'lite-voyager.sqlite', displayName: 'Lite Voyager', priority: 'option',
    selector: [{ filenamePattern: '**/*' }],
  }], configurationDefaults: { 'workbench.editorAssociations': {
    '*.db': 'lite-voyager.sqlite', '*.sqlite': 'lite-voyager.sqlite',
    '*.sqlite3': 'lite-voyager.sqlite', '*.db3': 'lite-voyager.sqlite',
  } } } });
});

test('FR-001: Given an arbitrary file name, When VS Code builds the editor picker, Then one optional all-filename registration offers Lite Voyager without changing other defaults', async () => {
  const manifest: unknown = JSON.parse(await readFile('package.json', 'utf8'));
  expect(manifest).toMatchObject({ contributes: {
    customEditors: [{ viewType: 'lite-voyager.sqlite', priority: 'option', selector: [{ filenamePattern: '**/*' }] }],
    configurationDefaults: { 'workbench.editorAssociations': {
      '*.db': 'lite-voyager.sqlite', '*.sqlite': 'lite-voyager.sqlite',
      '*.sqlite3': 'lite-voyager.sqlite', '*.db3': 'lite-voyager.sqlite',
    } },
  } });
  if (typeof manifest !== 'object' || manifest === null || !('contributes' in manifest)) { throw new Error('Missing manifest contributions.'); }
  const contributes = manifest.contributes;
  if (typeof contributes !== 'object' || contributes === null || !('customEditors' in contributes)
    || !('configurationDefaults' in contributes)) { throw new Error('Missing editor contributions.'); }
  expect(contributes.customEditors).toHaveLength(1);
  const defaults = contributes.configurationDefaults;
  if (typeof defaults !== 'object' || defaults === null || !('workbench.editorAssociations' in defaults)) { throw new Error('Missing default associations.'); }
  expect(Object.keys(defaults)).toEqual(['workbench.editorAssociations']);
  expect(defaults['workbench.editorAssociations']).toEqual({
    '*.db': 'lite-voyager.sqlite', '*.sqlite': 'lite-voyager.sqlite',
    '*.sqlite3': 'lite-voyager.sqlite', '*.db3': 'lite-voyager.sqlite',
  });
});

test('FR-001: Given a valid local file, When opening twice, Then one worker Engine opens read-only and browsing is deferred', async () => {
  const session = new SqliteSession('/fixture.sqlite', engine);
  const changes: string[] = [];
  const unsubscribe = session.subscribe(() => { changes.push(session.state.phase); });
  await Promise.all([session.start(() => Promise.resolve(true)), session.start(() => Promise.resolve(true))]);
  expect(engine.open).toHaveBeenCalledTimes(1);
  expect(engine.open.mock.calls[0]?.[0]).toBe('/fixture.sqlite');
  expect(session.state).toMatchObject({ phase: 'opened', opened });
  expect(changes).toEqual(['opening', 'opened']);
  expect(engine.schema).not.toHaveBeenCalled();
  expect(engine.query).not.toHaveBeenCalled();
  unsubscribe();
  await session.close();
});

test.each([true, false])('FR-001: Given fallback consent=%s, When requested, Then the mode is visible before the prompt and the decision reaches the Engine', async (approved) => {
  engine.open.mockImplementation(async (_path: string, options?: OpenOptions) => {
    options?.onMode?.(mode);
    expect(session.state.mode).toEqual(mode);
    expect(await options?.confirmLargeFile?.(mode)).toBe(approved);
    if (!approved) { throw new Error('Memory-limited mode: the file was not loaded because consent was declined.'); }
    return opened;
  });
  const session = new SqliteSession('/fixture.sqlite', engine);
  const confirm = vi.fn(() => Promise.resolve(approved));
  await session.start(confirm);
  expect(confirm).toHaveBeenCalledWith(mode);
  expect(session.state.phase).toBe(approved ? 'opened' : 'error');
  if (!approved) {
    expect(session.state.message).toContain('consent was declined');
    expect(engine.close).toHaveBeenCalledTimes(1);
  }
  await session.close();
});

test('FR-001: Given an unsupported resource, When opening, Then the editor shows an actionable error without asking the Engine to read it', async () => {
  const session = new SqliteSession(undefined, engine);
  await session.start(() => Promise.resolve(true));
  expect(session.state.phase).toBe('error');
  expect(session.state.message).toContain('local SQLite file');
  expect(engine.open).not.toHaveBeenCalled();
  await session.close();
});

test('FR-001: Given an invalid database, When opening fails, Then its clear message is retained and the helper is released', async () => {
  engine.open.mockRejectedValue(new Error('Unable to open the SQLite file. Check that it is a valid complete database.'));
  const session = new SqliteSession('/bad.db', engine);
  await session.start(() => Promise.resolve(true));
  expect(session.state.phase).toBe('error');
  expect(session.state.message).toContain('valid complete database');
  await session.closed;
  expect(engine.close).toHaveBeenCalledTimes(1);
  await session.close();
  expect(engine.close).toHaveBeenCalledTimes(1);
});

test('FR-001: Given an opening operation, When cancelled before its late reply, Then cancellation stays visible and the helper cannot reopen', async () => {
  let complete!: (value: EngineOpened) => void;
  engine.open.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const session = new SqliteSession('/fixture.sqlite', engine);
  const task = session.start(() => Promise.resolve(true));
  await session.cancel();
  complete(opened);
  await task;
  expect(session.state.phase).toBe('cancelled');
  expect(session.state.opened).toBeUndefined();
  expect(engine.close).toHaveBeenCalledTimes(1);
  expect(engine.cancel).not.toHaveBeenCalled();
});

test('FR-001: Given a consent prompt in flight, When the editor closes, Then a late approval is refused and no state is rendered after closure', async () => {
  let approve!: (approved: boolean) => void;
  let prompted!: () => void;
  const pendingPrompt = new Promise<void>((resolve) => { prompted = resolve; });
  engine.open.mockImplementation(async (_path: string, options?: OpenOptions) => {
    options?.onMode?.(mode);
    const result = await options?.confirmLargeFile?.(mode);
    expect(result).toBe(false);
    options?.onMode?.(mode);
    return opened;
  });
  const session = new SqliteSession('/fixture.sqlite', engine);
  const task = session.start(() => { prompted(); return new Promise((resolve) => { approve = resolve; }); });
  await pendingPrompt;
  await session.close();
  const changes = vi.fn();
  const unsubscribe = session.subscribe(changes);
  approve(true);
  await task;
  expect(session.state.phase).toBe('closed');
  expect(changes).not.toHaveBeenCalled();
  expect(engine.close).toHaveBeenCalledTimes(1);
  unsubscribe();
});

test('FR-001: Given a cancelled document before opening, When resolve arrives, Then no helper starts', async () => {
  const session = new SqliteSession('/fixture.sqlite', engine);
  await session.cancel();
  await session.start(() => Promise.resolve(true));
  expect(engine.open).not.toHaveBeenCalled();
  expect(session.state.phase).toBe('cancelled');
});

test('FR-001: Given unexpected failures, When opening or cleanup fails, Then the UI gets an actionable message and completion does not reject unhandled', async () => {
  engine.open.mockRejectedValue('unexpected');
  engine.close.mockRejectedValue(new Error('internal stack'));
  const session = new SqliteSession('/fixture.sqlite', engine);
  await session.start(() => Promise.resolve(true));
  await session.closed;
  expect(session.state.phase).toBe('error');
  expect(session.state.message).toContain('Reopen');
  expect(session.state.message).toContain('reload VS Code');
  expect(session.state.message).not.toContain('internal stack');
});

test('FR-001: Given cancellation while the helper is still exiting, When opening rejects, Then opening completion waits for confirmed cleanup', async () => {
  let rejectOpen!: (error: Error) => void;
  let finishClose!: () => void;
  engine.open.mockImplementation(() => new Promise((_resolve, reject) => { rejectOpen = reject; }));
  engine.close.mockImplementation(() => new Promise((resolve) => { finishClose = resolve; }));
  const session = new SqliteSession('/fixture.sqlite', engine);
  const opening = session.start(() => Promise.resolve(true));
  const cancellation = session.cancel();
  let finished = false;
  void opening.then(() => { finished = true; });
  rejectOpen(new Error('The operation was cancelled.'));
  try {
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    expect(finished).toBe(false);
  } finally {
    finishClose();
    await Promise.all([opening, cancellation]);
  }
  expect(finished).toBe(true);
  expect(session.state.phase).toBe('cancelled');
});
