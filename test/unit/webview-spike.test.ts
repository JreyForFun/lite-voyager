import { expect, test } from 'vitest';
import { createSpikePage, spikeHtml } from '../../src/webview-spike';
import { isHostMessage, isWebviewMessage, SPIKE_COLUMNS } from '../../src/protocol';

test('T-008: Given a valid page request, When served, Then only 128 deterministic rows are generated with exact integers and safe text', () => {
  const page = createSpikePage({ type: 'spikePageRequest', requestId: 1, offset: 0 });
  expect(page.rows).toHaveLength(128);
  expect(page.rows[0]).toEqual(['1', '9007199254740993', 'Row 1', '東京 🚀', '<script>alert("demo")</script>', '[BLOB 24 KB]']);
  expect(page.rows[127]?.[0]).toBe('128');
  expect(page.rows.every((row) => row.length === SPIKE_COLUMNS.length)).toBe(true);
  expect(isHostMessage(page)).toBe(true);
  const last = createSpikePage({ type: 'spikePageRequest', requestId: 2, offset: 9_999_872 });
  expect(last.rows.at(-1)?.[0]).toBe('10000000');
});

test('T-008: Given untrusted messages, When validating, Then oversized malformed and out-of-range pages are rejected', () => {
  expect(isWebviewMessage({ type: 'spikePageRequest', requestId: 1, offset: 128 })).toBe(true);
  for (const offset of [-1, 1, 10_000_000, 1.5, Infinity]) {
    expect(isWebviewMessage({ type: 'spikePageRequest', requestId: 1, offset })).toBe(false);
  }
  for (const requestId of [0, -1, 1.5, NaN]) {
    expect(isWebviewMessage({ type: 'spikePageRequest', requestId, offset: 0 })).toBe(false);
  }
  const row = SPIKE_COLUMNS.map(() => 'value');
  const page = { type: 'spikePage', requestId: 1, offset: 0, rows: [row] };
  expect(isHostMessage(page)).toBe(false); // Missing 127 rows is silent data loss.
  expect(isHostMessage({ ...page, rows: Array.from({ length: 129 }, () => row) })).toBe(false);
  expect(isHostMessage({ ...page, rows: Array.from({ length: 128 }, () => ['bad shape']) })).toBe(false);
  expect(isHostMessage({ ...page, rows: Array.from({ length: 128 }, () => row.map(() => 'x'.repeat(2049))) })).toBe(false);
  const valid = createSpikePage({ type: 'spikePageRequest', requestId: 1, offset: 0 });
  Reflect.deleteProperty(valid.rows, '0');
  expect(isHostMessage(valid)).toBe(false);
  const sparseCell = createSpikePage({ type: 'spikePageRequest', requestId: 1, offset: 0 });
  const first = sparseCell.rows[0];
  if (first === undefined) { throw new Error('Missing test row'); }
  Reflect.deleteProperty(first, '0');
  expect(isHostMessage(sparseCell)).toBe(false);
  expect(isHostMessage({ type: 'spikeInit', rowCount: 10_000_001 })).toBe(false);
  const status = { type: 'spikeStatus', editorReady: true, renderedRows: 26, cachedRows: 128, firstRow: 0, requestInFlight: false };
  expect(isWebviewMessage(status)).toBe(true);
  expect(isWebviewMessage({ ...status, cachedRows: 513 })).toBe(false);
  expect(isWebviewMessage({ ...status, renderedRows: 129 })).toBe(false);
});

test('T-008: Given webview assets, When constructing HTML, Then CSP permits only local scripts and styles and initial loading is visible', () => {
  const html = spikeHtml('vscode-webview://local', 'asset.js', 'asset.css', 'abc123');
  expect(html).toContain("default-src 'none'");
  expect(html).toContain("script-src 'nonce-abc123'");
  expect(html).toContain("style-src vscode-webview://local 'nonce-abc123'");
  expect(html).not.toContain("'unsafe-inline'");
  expect(html).toContain('Loading editor and synthetic rows');
  expect(html).toContain('id="grid"');
  expect(html).toContain('id="editor"');
  expect(html).not.toMatch(/https?:\/\//);
});
