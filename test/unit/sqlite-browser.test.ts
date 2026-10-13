import { expect, test, vi } from 'vitest';
import type { Engine, EnginePage } from '../../src/engine/engine';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import { isBrowserRequest, isBrowserResponse, type BrowserResponse } from '../../src/protocol';
import type { ExportRunner } from '../../src/editor/export-service';

function fixture() {
  const engine = {
    exportResults: vi.fn<Engine['exportResults']>(),
    grid: vi.fn<Engine['grid']>(),
    open: vi.fn<Engine['open']>(), close: vi.fn<Engine['close']>(), cancel: vi.fn<Engine['cancel']>().mockResolvedValue(undefined),
    schema: vi.fn<Engine['schema']>().mockResolvedValue({ columns: ['type', 'name', 'tbl_name', 'sql'], rows: [['table', 'select "🚀', 'select "🚀', 'CREATE TABLE...']], hasMore: false }),
    page: vi.fn<Engine['page']>().mockResolvedValue({ columns: ['value'], rows: [['9223372036854775807'], [null], [''], ['NULL']], hasMore: false }),
    query: vi.fn<Engine['query']>().mockImplementation((sql) => Promise.resolve(sql.startsWith('SELECT type, name')
      ? { columns: ['type', 'name'], rows: [['table', 'select "🚀']], hasMore: false }
      : { columns: ['count'], rows: [['9007199254740993']], hasMore: false })),
    columns: vi.fn<Engine['columns']>(), indexes: vi.fn<Engine['indexes']>(), indexColumns: vi.fn<Engine['indexColumns']>(),
  } satisfies Engine;
  const browser = new SqliteBrowser(engine);
  const sent: BrowserResponse[] = [];
  const send = (message: BrowserResponse): void => { sent.push(message); };
  return { engine, browser, sent, send };
}

test('FR-014: Given atomic Saving has begun, When a late Cancel request arrives, Then the actual saved outcome acknowledges that request without interrupting the engine', async () => {
  const { engine, browser, sent, send } = fixture(); let finish!: () => void;
  const report = { rows: '205', bytes: '1000', blobs: '0' };
  browser.setExporter({ run: async (_sql, _format, progress) => {
    progress({ ...report, phase: 'saving' }); await new Promise<void>((resolve) => { finish = resolve; }); return report;
  }, abort: vi.fn(), settled: () => pendingSave });
  let resolveSave!: () => void; const pendingSave = new Promise<void>((resolve) => { resolveSave = resolve; });
  await browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT 1', offset: 0, limit: 1 }, send);
  const exporting = browser.handle({ type: 'browserExport', requestId: 2, format: 'csv' }, send);
  const lateCancel = browser.handle({ type: 'browserCancel', requestId: 3 }, send);
  finish(); await exporting; resolveSave(); await lateCancel;
  expect(engine.cancel).not.toHaveBeenCalled();
  expect(sent.at(-1)).toEqual({ type: 'browserExportDone', requestId: 3, report });
  await browser.handle({ type: 'browserCancel', requestId: 4 }, send);
  expect(sent.at(-1)).toEqual({ type: 'browserExportDone', requestId: 4, report });
  expect(engine.cancel).not.toHaveBeenCalled();
});

test('FR-014: Given a successful query followed by failure, When exporting, Then only successful SQL is rerun and progress is nonterminal', async () => {
  const { engine, browser, sent, send } = fixture();
  const exporter = { run: vi.fn<ExportRunner['run']>().mockImplementation((_sql, _format, progress) => {
    progress({ phase: 'writing', rows: '1', bytes: '64', blobs: '0' });
    progress({ phase: 'saving', rows: '2', bytes: '128', blobs: '0' }); return Promise.resolve({ rows: '2', bytes: '128', blobs: '0' });
  }), abort: vi.fn(), settled: vi.fn().mockResolvedValue(undefined) };
  browser.setExporter(exporter);
  await browser.handle({ type: 'browserExport', requestId: 1, format: 'csv' }, send);
  expect(sent.at(-1)).toMatchObject({ type: 'browserError' }); expect(exporter.run).not.toHaveBeenCalled();
  await browser.handle({ type: 'browserQuery', requestId: 2, sql: 'SELECT 42', offset: 100, limit: 1 }, send);
  engine.query.mockRejectedValueOnce(new Error('bad SQL'));
  await browser.handle({ type: 'browserQuery', requestId: 3, sql: 'SELECT bad', offset: 0, limit: 1 }, send);
  await browser.handle({ type: 'browserExport', requestId: 4, format: 'json' }, send);
  expect(exporter.run).toHaveBeenCalledWith('SELECT 42', 'json', expect.any(Function));
  expect(sent.slice(-3)).toEqual([
    { type: 'browserExportProgress', requestId: 4, phase: 'writing', rows: '1', bytes: '64', blobs: '0' },
    { type: 'browserExportProgress', requestId: 4, phase: 'saving', rows: '2', bytes: '128', blobs: '0' },
    { type: 'browserExportDone', requestId: 4, report: { rows: '2', bytes: '128', blobs: '0' } },
  ]);
  await browser.handle({ type: 'browserPage', requestId: 5, table: 'data', offset: 0, limit: 1 }, send);
  await browser.handle({ type: 'browserExport', requestId: 6, format: 'csv' }, send);
  expect(sent.at(-1)).toMatchObject({ type: 'browserError' }); expect(exporter.run).toHaveBeenCalledOnce();
});
test('FR-014: Given export in flight, When Cancel supersedes it, Then cleanup/recovery finish before acknowledgement and stale progress is ignored', async () => {
  const { browser, sent, send } = fixture(); let progress!: Parameters<ExportRunner['run']>[2]; let finish!: () => void;
  const exporter = { run: vi.fn<ExportRunner['run']>().mockImplementation(async (_sql, _format, report) => {
    progress = report; await new Promise<void>((resolve) => { finish = resolve; }); return { rows: '1', bytes: '1', blobs: '0' };
  }), abort: vi.fn(() => { finish(); }), settled: vi.fn().mockResolvedValue(undefined) };
  browser.setExporter(exporter); await browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT 1', offset: 0, limit: 1 }, send);
  const task = browser.handle({ type: 'browserExport', requestId: 2, format: 'csv' }, send);
  await browser.handle({ type: 'browserCancel', requestId: 3 }, send); await task;
  progress({ phase: 'writing', rows: '9', bytes: '99', blobs: '0' });
  expect(exporter.abort).toHaveBeenCalledOnce(); expect(exporter.settled).toHaveBeenCalledOnce();
  expect(sent.at(-1)).toEqual({ type: 'browserCancelled', requestId: 3 });
  browser.dispose(); expect(exporter.abort).toHaveBeenCalledTimes(2);
});

test('FR-011: Given selected SQL and a page address, When running in the host, Then the Engine receives literal SQL and returns bounded rows with elapsed time', async () => {
  const { engine, browser, sent, send } = fixture();
  const sql = 'SELECT 9223372036854775807 AS "🚀"';
  await browser.handle({ type: 'browserQuery', requestId: 1, sql, offset: 100, limit: 10 }, send);
  expect(engine.query).toHaveBeenCalledWith(sql, [], { offset: 100, limit: 10 }, expect.any(Function));
  expect(sent[0]).toMatchObject({ type: 'browserQueryRows', requestId: 1, offset: 100, limit: 10 });
  const reply = sent[0];
  if (reply?.type !== 'browserQueryRows') { throw new Error('Expected query result'); }
  expect(reply.ms).toBeGreaterThanOrEqual(0);
});

test('FR-015: Given SQL acknowledged by the worker, When cancelling before recovery finishes, Then started is nonterminal, stale replies are suppressed and retry waits for recovery', async () => {
  const { engine, browser, sent, send } = fixture();
  let started: (() => void) | undefined;
  let fail!: (error: Error) => void;
  let recovered!: () => void;
  engine.query.mockImplementationOnce((_sql, _parameters, _page, onStarted) => {
    started = onStarted; return new Promise((_resolve, reject) => { fail = reject; });
  });
  engine.cancel.mockImplementationOnce(() => {
    fail(new Error('cancelled')); return new Promise((resolve) => { recovered = resolve; });
  });
  const query = browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT slow', offset: 0, limit: 100 }, send);
  expect(started).toBeTypeOf('function'); started?.();
  expect(sent).toEqual([{ type: 'browserQueryStarted', requestId: 1 }]);
  const cancel = browser.handle({ type: 'browserCancel', requestId: 2 }, send);
  started?.();
  await query;
  const retry = browser.handle({ type: 'browserQuery', requestId: 3, sql: 'SELECT 42', offset: 0, limit: 1 }, send);
  expect(engine.query).toHaveBeenCalledTimes(1);
  expect(sent).toHaveLength(1);
  recovered(); await Promise.all([cancel, retry]);
  expect(sent.at(-1)).toMatchObject({ type: 'browserQueryRows', requestId: 3 });
});

test('FR-015: Given SQL cancellation recovery failure, When a late query rejection follows, Then only the actionable recovery error is sent', async () => {
  const { engine, browser, sent, send } = fixture();
  let fail!: (error: Error) => void;
  engine.query.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  engine.cancel.mockRejectedValueOnce(new Error('open failed'));
  const query = browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT slow', offset: 0, limit: 1 }, send);
  await browser.handle({ type: 'browserCancel', requestId: 2 }, send);
  fail(new Error('old query failed')); await query;
  expect(sent).toEqual([{ type: 'browserError', requestId: 2, message: 'The database could not recover after cancellation. Close and reopen the file.' }]);
});

test('FR-015: Given cancellation recovery in flight, When the browser is disposed, Then no completion revives the UI', async () => {
  const { engine, browser, sent, send } = fixture();
  let finish!: () => void;
  engine.cancel.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const cancel = browser.handle({ type: 'browserCancel', requestId: 1 }, send);
  browser.dispose(); finish(); await cancel;
  expect(sent).toEqual([]);
});

test('FR-015: Given a worker-start response, When validating its address, Then only a valid typed acknowledgement is accepted', () => {
  expect(isBrowserResponse({ type: 'browserQueryStarted', requestId: 1 })).toBe(true);
  for (const requestId of [0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    expect(isBrowserResponse({ type: 'browserQueryStarted', requestId })).toBe(false);
  }
});

test('FR-011: Given a failed SQL run, When the host responds, Then the original diagnostic is kept as literal text', async () => {
  const { engine, browser, sent, send } = fixture();
  engine.query.mockRejectedValueOnce(new Error('no such table: <script>missing</script>'));
  await browser.handle({ type: 'browserQuery', requestId: 1, sql: 'SELECT * FROM missing', offset: 0, limit: 100 }, send);
  const reply = sent[0];
  if (reply?.type !== 'browserError') { throw new Error('Expected visible query error'); }
  expect(reply.message).toContain('no such table: <script>missing</script>');
});

test('FR-002: Given an open Engine, When listing and browsing, Then pages default to 100 and no eager count runs', async () => {
  const { engine, browser, sent, send } = fixture();
  await browser.handle({ type: 'browserList', requestId: 1, offset: 0 }, send);
  expect(engine.query).toHaveBeenCalledWith("SELECT type, name FROM main.sqlite_schema WHERE type IN ('table', 'view') AND name NOT GLOB 'sqlite_*' ORDER BY name", [], { offset: 0, limit: 100 });
  expect(sent[0]).toEqual({ type: 'browserTables', requestId: 1, offset: 0, objects: [{ name: 'select "🚀', kind: 'table' }], hasMore: false });
  await browser.handle({ type: 'browserPage', requestId: 2, table: 'select "🚀', offset: 0, limit: 100 }, send);
  expect(engine.page).toHaveBeenCalledWith('select "🚀', { offset: 0, limit: 100 });
  expect(sent[1]).toMatchObject({ type: 'browserRows', requestId: 2, table: 'select "🚀', page: { rows: [['9223372036854775807'], [null], [''], ['NULL']] } });
  expect(engine.query.mock.calls.some(([sql]) => sql.includes('COUNT('))).toBe(false);
});

test('FR-002: Given a hostile name and an unsafe integer count, When explicitly counting, Then identifiers are quoted and the decimal count stays exact', async () => {
  const { engine, browser, sent, send } = fixture();
  await browser.handle({ type: 'browserCount', requestId: 1, table: 'select "🚀' }, send);
  expect(engine.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM "select ""🚀"', [], { limit: 1 });
  expect(sent).toEqual([{ type: 'browserCounted', requestId: 1, table: 'select "🚀', count: '9007199254740993' }]);
});

test('FR-002: Given rapid selections, When the old operation settles, Then only the latest queued request runs and renders', async () => {
  const { engine, browser, sent, send } = fixture();
  let finish!: (page: EnginePage) => void;
  vi.mocked(engine.page).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const first = browser.handle({ type: 'browserPage', requestId: 1, table: 'old', offset: 0, limit: 100 }, send);
  const second = browser.handle({ type: 'browserPage', requestId: 2, table: 'skipped', offset: 0, limit: 100 }, send);
  const third = browser.handle({ type: 'browserPage', requestId: 3, table: 'new', offset: 100, limit: 100 }, send);
  finish({ columns: ['old'], rows: [['stale']], hasMore: false });
  await Promise.all([first, second, third]);
  expect(engine.page).toHaveBeenCalledTimes(2);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ table: 'new', offset: 100, requestId: 3 });
});

test('FR-002: Given pending count and queued rows, When cancelled, Then recovery completes, stale replies disappear and browsing can resume', async () => {
  const { engine, browser, sent, send } = fixture();
  let fail!: (error: Error) => void;
  vi.mocked(engine.query).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  vi.mocked(engine.cancel).mockImplementation(() => { fail(new Error('cancelled')); return Promise.resolve(); });
  const count = browser.handle({ type: 'browserCount', requestId: 1, table: 'large' }, send);
  const queued = browser.handle({ type: 'browserPage', requestId: 2, table: 'old', offset: 0, limit: 100 }, send);
  await browser.handle({ type: 'browserCancel', requestId: 3 }, send);
  await Promise.all([count, queued]);
  expect(engine.cancel).toHaveBeenCalledTimes(1);
  expect(sent).toEqual([{ type: 'browserCancelled', requestId: 3 }]);
  expect(engine.page).not.toHaveBeenCalled();
  await browser.handle({ type: 'browserPage', requestId: 4, table: 'large', offset: 0, limit: 1 }, send);
  expect(sent.at(-1)).toMatchObject({ type: 'browserRows' });
});

test('FR-002: Given operation failures and closure, When replies arrive, Then failures are actionable and a disposed browser sends nothing', async () => {
  const { engine, browser, sent, send } = fixture();
  vi.mocked(engine.page).mockRejectedValueOnce(new Error('The result page exceeds 4 MiB. No value was truncated.'));
  await browser.handle({ type: 'browserPage', requestId: 1, table: 'large cells', offset: 0, limit: 100 }, send);
  const error = sent[0];
  if (error?.type !== 'browserError') { throw new Error('Expected visible browser error'); }
  expect(error.message).toContain('No value was truncated');
  let finish!: (page: EnginePage) => void;
  vi.mocked(engine.page).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const pending = browser.handle({ type: 'browserPage', requestId: 2, table: 'old', offset: 0, limit: 100 }, send);
  browser.dispose();
  finish({ columns: [], rows: [], hasMore: false });
  await pending;
  await browser.handle({ type: 'browserList', requestId: 3, offset: 0 }, send);
  expect(sent).toHaveLength(1);
});

test('FR-002: Given failed cancellation recovery, When Cancel completes, Then the user receives a clear reopen instruction', async () => {
  const { engine, browser, sent, send } = fixture();
  engine.cancel.mockRejectedValueOnce(new Error('helper failed'));
  await browser.handle({ type: 'browserCancel', requestId: 1 }, send);
  expect(sent).toEqual([{ type: 'browserError', requestId: 1, message: 'The database could not recover after cancellation. Close and reopen the file.' }]);
});

test('FR-002: Given malformed worker metadata and count, When browsing, Then the browser rejects them visibly rather than reporting invented results', async () => {
  const { engine, browser, sent, send } = fixture();
  engine.query.mockResolvedValueOnce({ columns: ['type', 'name'], rows: [['index', 'wrong']], hasMore: false });
  await browser.handle({ type: 'browserList', requestId: 1, offset: 0 }, send);
  const metadata = sent[0];
  if (metadata?.type !== 'browserError') { throw new Error('Expected metadata error'); }
  expect(metadata.message).toContain('invalid table metadata');
  engine.query.mockResolvedValueOnce({ columns: ['count'], rows: [['1e+10']], hasMore: false });
  await browser.handle({ type: 'browserCount', requestId: 2, table: 't' }, send);
  const count = sent[1];
  if (count?.type !== 'browserError') { throw new Error('Expected count error'); }
  expect(count.message).toContain('exact nonnegative integer');
});

test('FR-002: Given browser messages, When validating them, Then invalid sizes, sparse arrays, unsafe offsets and rounded counts are rejected', () => {
  expect(isBrowserRequest({ type: 'browserPage', requestId: 1, table: 't', offset: 0, limit: 100 })).toBe(true);
  for (const changes of [{ offset: -1 }, { offset: Number.MAX_SAFE_INTEGER + 1 }, { limit: 0 }, { limit: 101 }, { table: '' }, { table: 'a\0b' }, { requestId: 0 }]) {
    expect(isBrowserRequest({ type: 'browserPage', requestId: 1, table: 't', offset: 0, limit: 100, ...changes })).toBe(false);
  }
  const rows = { type: 'browserRows', requestId: 1, table: 't', offset: 0, limit: 100, page: { columns: ['v'], rows: [[null], ['']], hasMore: false } };
  expect(isBrowserResponse(rows)).toBe(true);
  for (const page of [{ columns: ['v'], rows: Array(1), hasMore: false }, { columns: ['v'], rows: [Array(1)], hasMore: false }, { columns: ['v'], rows: [[1]], hasMore: false }]) {
    expect(isBrowserResponse({ ...rows, page })).toBe(false);
  }
  expect(isBrowserResponse({ type: 'browserCounted', requestId: 1, table: 't', count: '9223372036854775807' })).toBe(true);
  expect(isBrowserResponse({ type: 'browserCounted', requestId: 1, table: 't', count: 9007199254740992 })).toBe(false);
});
