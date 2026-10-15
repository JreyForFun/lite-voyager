import { expect, test } from 'vitest';
import { isCsvImportRequest, isCsvImportState, isHostMessage, isWebviewMessage } from '../../src/protocol';
import { csvImportHtml } from '../../src/editor/csv-import-ui';

const contextId = '1'.repeat(32);
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
