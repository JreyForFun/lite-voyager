import { afterEach, expect, test, vi } from 'vitest';
import { isSourceRequest, isSourceState } from '../../src/protocol';
import { browserRoot } from './browser-dom';
afterEach(() => vi.unstubAllGlobals());
test('FR-040: Given a source prompt, When keeping or explicitly refreshing, Then accessible controls send only typed actions and busy refresh blocks duplicate clicks', async () => {
  const { SourceView } = await import('../../webview/source-view');
  const root = browserRoot(['source-changes', 'source-status', 'source-refresh', 'source-keep']); const sent: unknown[] = [];
  const view = new SourceView(root as unknown as HTMLElement, message => { sent.push(message); }); view.start();
  expect(sent).toEqual([{ type: 'sourceRequest', action: 'ready' }]);
  view.receive({ type: 'sourceState', changed: true, offered: true, busy: false, message: '<literal source changed>' });
  expect(root.elements.get('source-status')?.textContent).toBe('<literal source changed>');
  root.elements.get('source-keep')?.click(); expect(sent.at(-1)).toEqual({ type: 'sourceRequest', action: 'keep' });
  root.elements.get('source-refresh')?.click(); expect(sent.at(-1)).toEqual({ type: 'sourceRequest', action: 'refresh' });
  const count = sent.length; view.receive({ type: 'sourceState', changed: true, offered: true, busy: true, message: 'Refreshing' });
  root.elements.get('source-refresh')?.click(); expect(sent).toHaveLength(count); view.dispose();
});
test('FR-040: Given untrusted refresh transport, When validating, Then unsupported actions and oversized states are refused', () => {
  expect(isSourceRequest({ type: 'sourceRequest', action: 'refresh' })).toBe(true);
  expect(isSourceRequest({ type: 'sourceRequest', action: 'overwrite' })).toBe(false);
  expect(isSourceRequest({ type: 'sourceRequest', action: ['refresh'] })).toBe(false);
  expect(isSourceState({ type: 'sourceState', changed: true, offered: true, busy: false, message: 'x'.repeat(2049) })).toBe(false);
});
