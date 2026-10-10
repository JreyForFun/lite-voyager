import { expect, test, vi } from 'vitest';
import type { Engine, EnginePage } from '../../src/engine/engine';
import { SqliteBrowser } from '../../src/editor/sqlite-browser';
import { isBrowserRequest, isBrowserResponse, type BrowserResponse } from '../../src/protocol';

function fixture() {
  const engine = {
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
