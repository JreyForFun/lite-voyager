import { afterEach, expect, test, vi } from 'vitest';
import { SchemaView } from '../../webview/schema-view';
import { BrowserElement, browserRoot } from './browser-dom';

afterEach(() => { vi.unstubAllGlobals(); });
test('FR-003: Given retained metadata, When an oversized index name is inspected, Then no invalid request is sent and the limit is visible', () => {
  const root = browserRoot(['browser-select']);
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  const send = vi.fn(); const view = new SchemaView(root as unknown as HTMLElement, send);
  view.selectObject('data'); view.exercise('schema');
  view.receive({ type: 'browserSchemaRows', requestId: 1, table: 'data', kind: 'columns', offset: 0, limit: 100,
    page: { columns: ['name'], rows: [['retained']], hasMore: false } });
  send.mockClear(); view.exercise('schemaIndex', 'x'.repeat(4 * 1024 * 1024 + 1));
  expect(send).not.toHaveBeenCalled(); expect(view.summary()).toMatchObject({ rows: 1, preview: 'retained' });
  expect(view.summary().message).toMatch(/limit|too long/iu); view.dispose();
});
test('FR-003: Given selected schema and retained data, When metadata pages load or fail, Then complete literal fields are bounded and successful metadata context survives', () => {
  const root = browserRoot(['schema-show', 'schema-panel', 'schema-title', 'schema-kind', 'schema-index', 'schema-inspect', 'schema-size', 'schema-previous', 'schema-next', 'schema-rows', 'schema-status']);
  vi.stubGlobal('document', { createElement: () => new BrowserElement() });
  const send = vi.fn(); const view = new SchemaView(root as unknown as HTMLElement, send);
  view.selectObject(''); expect(send).not.toHaveBeenCalled();
  root.elements.get('schema-show')?.click(); expect(send).toHaveBeenCalledWith(expect.objectContaining({ table: '', kind: 'columns', offset: 0, limit: 100 }));
  const reply = { type: 'browserSchemaRows' as const, requestId: 1, table: '', kind: 'columns' as const, offset: 0, limit: 100,
    page: { columns: ['cid', 'name', 'type', 'notNull', 'defaultValue', 'primaryKey', 'hidden'], rows: [['0', '<img>', 'TEXT', '1', "'literal'", '2', '0']], hasMore: true } };
  view.receive(reply);
  expect(view.summary()).toMatchObject({ table: '', rows: 1, hasMore: true, offset: 0 });
  expect(view.summary().preview).toContain('<img>'); expect(view.summary().preview).toContain("'literal'");
  root.elements.get('schema-next')?.click(); expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 100 }));
  view.failed('Metadata failed; retry.'); expect(view.summary()).toMatchObject({ offset: 0, rows: 1 });
  expect(root.elements.get('schema-status')?.textContent).toContain('failed');
  view.selectObject('other'); expect(view.summary().rows).toBe(0);
  view.receive(reply); expect(view.summary().rows).toBe(0); view.dispose();
});
