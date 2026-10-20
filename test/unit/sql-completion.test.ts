import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { sql, SQLite } from '@codemirror/lang-sql';
import { expect, test, vi } from 'vitest';
import { completionContext, schemaSource } from '../../webview/sql-completion';
import { findCompletions } from '../../src/editor/sql-completion';
import { isBrowserRequest, isBrowserResponse } from '../../src/protocol';
import type { Engine } from '../../src/engine/engine';

function context(text: string): CompletionContext {
  const pos = text.indexOf('|'); const doc = text.replace('|', '');
  return new CompletionContext(EditorState.create({ doc, extensions: [sql({ dialect: SQLite })] }), pos, true);
}

test('FR-012: Given a legal table alias named main, When qualifying a column, Then the alias takes precedence over a schema-name guess', () => {
  expect(completionContext(context('SELECT main.na| FROM users AS main'))).toMatchObject({ tables: ['users'], includeTables: false });
});

test('FR-012: Given FROM and JOIN aliases, When completing a qualified column, Then only its table is requested', () => {
  expect(completionContext(context('SEL|'))).toBeNull();
  expect(completionContext(context('SELECT o.na| FROM "order items" AS o JOIN users u ON o.id=u.id'))).toMatchObject({
    from: 9, prefix: 'na', tables: ['order items'], includeTables: false,
  });
  expect(completionContext(context('SELECT u.| FROM users u'))).toMatchObject({ prefix: '', tables: ['users'] });
  expect(completionContext(context('SELECT * FROM la|'))).toMatchObject({ prefix: 'la', tables: [], includeTables: true });
});

test('FR-012: Given quoted names, comments and multiple statements, When analyzing completion, Then context stays literal and statement-local', () => {
  expect(completionContext(context('SELECT "quo|" FROM "select"'))).toMatchObject({ prefix: 'quo', from: 7, to: 12, tables: ['select'] });
  expect(completionContext(context("SELECT 'hello| world' FROM hidden"))).toBeNull();
  expect(completionContext(context('SELECT 1 -- na|'))).toBeNull();
  expect(completionContext(context('SELECT 1 /* na| */'))).toBeNull();
  expect(completionContext(context('SELECT x FROM old; SELECT n| FROM current'))).toMatchObject({ tables: ['current'] });
  expect(completionContext(context('SELECT a| FROM "__proto__"'))).toMatchObject({ tables: ['__proto__'] });
});

test('FR-012: Given excessive or ambiguous semantic context, When requesting schema completion, Then an explanation replaces guesses', () => {
  expect(completionContext(context(`SELECT ${' '.repeat(65536)}a|`))?.notice).toContain('64 Ki');
  expect(completionContext(context('WITH x AS (SELECT 1 AS n) SELECT x.| FROM x'))?.notice).toContain('CTE');
  expect(completionContext(context('SELECT q.| FROM (SELECT 1) q'))?.notice).toContain('subquer');
  const joins = Array.from({ length: 17 }, (_, i) => `JOIN t${String(i)} ON 1`).join(' ');
  expect(completionContext(context(`SELECT n| FROM first ${joins}`))?.notice).toContain('16');
  expect(completionContext(context('SELECT * FROM main.se|'))).toMatchObject({ tables: [], includeTables: true, useSelectedTable: false });
});

test('FR-012: Given an aborted request and a late metadata reply, When the source settles, Then no stale list or notice is installed', async () => {
  let finish!: (value: { items: []; hasMore: boolean }) => void;
  let abort!: () => void;
  const pending = new Promise<{ items: []; hasMore: boolean }>((resolve) => { finish = resolve; });
  const current = context('SELECT na| FROM records');
  vi.spyOn(current, 'addEventListener').mockImplementation((_event, listener) => { abort = listener; });
  const notice = vi.fn(); const result = schemaSource(() => pending, notice)(current);
  abort(); finish({ items: [], hasMore: true });
  expect(await result).toBeNull(); expect(notice).not.toHaveBeenCalled();
});

test('FR-012: Given an incomplete result, When suggesting names, Then the user is told to narrow the prefix', async () => {
  const notice = vi.fn();
  await schemaSource(() => Promise.resolve({ items: [], hasMore: true }), notice)(context('SELECT * FROM a|'));
  expect(notice.mock.calls[0]?.[0]).toContain('More schema matches');
});

test('FR-012: Given metadata names and a partial quoted identifier, When accepting a completion, Then identifiers are escaped and replacement includes the closing quote', async () => {
  const request = vi.fn().mockResolvedValue({ items: [{ name: 'quote"name', kind: 'column', table: 'select' }], hasMore: false });
  const result = await schemaSource(request, vi.fn())(context('SELECT "quo|" FROM "select"'));
  expect(result).toMatchObject({ from: 7, to: 12, filter: false, options: [{ label: 'quote"name', apply: '"quote""name"' }] });
});

test('FR-012: Given a filtered metadata request, When searching, Then data stays parameterized and the engine page is bounded', async () => {
  const query = vi.fn<Engine['query']>().mockResolvedValue({ columns: ['kind', 'name', 'tableName'], rows: [['column', 'quote"name', 'select']], hasMore: false });
  const result = await findCompletions({ query }, { prefix: "x%' OR 1=1 --", tables: ['select'], includeTables: true });
  expect(result.items).toEqual([{ kind: 'column', name: 'quote"name', table: 'select' }]);
  const [statement, parameters, page] = query.mock.calls[0] ?? [];
  expect(statement).not.toContain("x%' OR 1=1 --"); expect(statement).not.toContain('FROM "select"');
  expect(parameters).toContain("x%' OR 1=1 --"); expect(parameters).toContain('select');
  expect(page).toEqual({ limit: 100 });
});

test('FR-012: Given oversized suggestion text, When collecting metadata, Then the bounded reply explains that more matches exist', async () => {
  const query = vi.fn<Engine['query']>().mockResolvedValue({ columns: [], rows: [['table', 'a'.repeat(65537), '']], hasMore: false });
  expect(await findCompletions({ query }, { prefix: '', tables: [], includeTables: true })).toEqual({ items: [], hasMore: true });
});

test('FR-012: Given completion transport, When validating malformed or oversized input, Then dense bounded names and booleans are required', () => {
  const request = { type: 'browserComplete', requestId: 1, prefix: '', tables: ['select'], includeTables: true };
  expect(isBrowserRequest(request)).toBe(true);
  for (const change of [{ tables: new Array(1) }, { tables: Array.from({ length: 17 }, () => 'x') }, { prefix: 'x'.repeat(65537) }, { includeTables: 'yes' }, { tables: ['bad\0'] }]) {
    expect(isBrowserRequest({ ...request, ...change })).toBe(false);
  }
  const reply = { type: 'browserCompletions', requestId: 1, items: [{ name: '__proto__', kind: 'table', table: '' }], hasMore: false };
  expect(isBrowserResponse(reply)).toBe(true);
  expect(isBrowserResponse({ ...reply, items: new Array(1) })).toBe(false);
  expect(isBrowserResponse({ ...reply, items: [{ name: 'x'.repeat(65537), kind: 'table', table: '' }] })).toBe(false);
});
