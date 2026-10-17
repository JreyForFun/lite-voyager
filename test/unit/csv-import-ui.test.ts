import { expect, test } from 'vitest';
import { isCsvImportRequest, isCsvImportState, isHostMessage, isWebviewMessage, isXlsxPreviewResult } from '../../src/protocol';
import { csvImportHtml } from '../../src/editor/csv-import-ui';

test('FR-005: Given a JSON import shell, When hiding the preview-only cancel button, Then all import controls remain present with JSON help', () => {
  const html = csvImportHtml('input.json', '1'.repeat(32), { scriptUri: 'local:script', styleUri: 'local:style', nonce: 'test', cspSource: 'local:' }, 'json');
  for (const id of ['import-delimiter', 'import-header', 'import-text', 'import-refresh', 'import-start', 'import-cancel', 'import-status', 'import-progress']) { expect(html).toContain(`id="${id}"`); }
  expect(html).toContain('id="csv-cancel" hidden'); expect(html).toContain('JSON / JSONL import'); expect(html).toContain('data-format="json"');
});

const contextId = '1'.repeat(32);
test('FR-006: Given the XLSX import shell, When opening it, Then workbook semantics, memory limits and all-sheet import are visible without CSV options', () => {
  const html = csvImportHtml('book.xlsx', contextId, { scriptUri: 'local:script', styleUri: 'local:style', nonce: 'test', cspSource: 'local:' }, 'xlsx');
  expect(html).toContain('XLSX import'); expect(html).toContain('data-format="xlsx"'); expect(html).toContain('Import workbook');
  expect(html).toContain('cached'); expect(html).toContain('100 MB'); expect(html).toContain('serial');
  expect(html).toContain('<span hidden>'); expect(html).toContain('id="csv-cancel" hidden');
});

test('FR-006: Given XLSX preview transport, When validating worker responses, Then missing sheet metadata and unsafe row shapes cannot enter the import view', () => {
  const preview = { format: 'xlsx', sheetName: 'Data', sheetCount: 3, columns: ['a'], rows: [['1']], bytesRead: '10', totalBytes: '10', threadId: 1, reachedEnd: true, notice: '' };
  expect(isXlsxPreviewResult(preview)).toBe(true);
  for (const malformed of [{ ...preview, sheetCount: 0 }, { ...preview, sheetCount: 1.5 }, { ...preview, sheetName: '' }, { ...preview, rows: [[1]] }, { ...preview, rows: [new Array<string>(1)] }, { ...preview, bytesRead: '11' }]) { expect(isXlsxPreviewResult(malformed)).toBe(false); }
});

test('FR-004: Given import control requests, When validating, Then only typed options and matching message structures are accepted', () => {
  expect(isWebviewMessage({ type: 'csvImportStart', contextId })).toBe(true);
  expect(isWebviewMessage({ type: 'csvImportRefresh', contextId, options: { header: false, delimiter: ';', allText: true } })).toBe(true);
  for (const options of [{ header: 'false' }, { delimiter: ',' + 'DROP' }, { allText: 1 }, { unexpected: true }, []]) {
    expect(isCsvImportRequest({ type: 'csvImportRefresh', contextId, options })).toBe(false);
  }
  expect(isCsvImportRequest({ type: 'csvImportStart', contextId: 'old' })).toBe(false);
  const state = { type: 'csvImportState', contextId, phase: 'importing', message: 'reading', options: {}, progress: { bytes: '2', totalBytes: '4', rows: '1', phase: 'reading', engine: 'node:sqlite', notice: '' } };
  expect(isHostMessage(state)).toBe(true);
  expect(isCsvImportState({ ...state, progress: { ...state.progress, bytes: '5' } })).toBe(false);
  expect(isCsvImportState({ ...state, phase: 'invented' })).toBe(false);
  expect(isCsvImportState({ ...state, phase: 'ready' })).toBe(false);
});
test('NFR-009: Given hostile source names, When rendering import controls, Then CSP, labels and escaping remain safe', () => {
  const html = csvImportHtml('<script>source</script>', contextId, { scriptUri: 'local:import.js', styleUri: 'local:import.css', nonce: 'nonce', cspSource: 'local:' });
  expect(html).toContain('&lt;script&gt;source'); expect(html).not.toContain('<script>source');
  expect(html).toContain("default-src 'none'"); expect(html).not.toContain('unsafe-inline');
  for (const id of ['csv-import', 'import-delimiter', 'import-header', 'import-text', 'import-start', 'import-refresh', 'import-cancel', 'import-progress']) { expect(html).toContain(`id="${id}"`); }
  expect(html).toContain('20,000,000'); expect(html).toContain('SQL NULL');
});
