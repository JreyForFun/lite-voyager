import { expect, test, vi } from 'vitest';
import { approveXlsxMemory } from '../../src/editor/xlsx-warning';
const warning = vi.hoisted(() => vi.fn());
vi.mock('vscode', () => ({ window: { showWarningMessage: warning } }));
test('FR-006: Given XLSX memory consent, When declining, dismissing or explicitly proceeding, Then only Proceed approves and Cancel owns Escape/close', async () => {
  warning.mockResolvedValueOnce(undefined); expect(await approveXlsxMemory('100000001')).toBe(false);
  const [message, options, proceed, cancel] = warning.mock.calls[0] as [string, { modal: boolean }, { title: string }, { title: string; isCloseAffordance: boolean }];
  expect(message).toMatch(/100.*MB|100,000,000/); expect(message).toMatch(/memory|expanded/i); expect(options.modal).toBe(true);
  expect(cancel.isCloseAffordance).toBe(true); expect(cancel.title).toBe('Cancel'); expect(proceed.title).toBe('Proceed');
  warning.mockResolvedValueOnce(cancel); expect(await approveXlsxMemory('100000001')).toBe(false);
  warning.mockImplementationOnce((_message: string, _options: unknown, yes: { title: string }) => Promise.resolve(yes)); expect(await approveXlsxMemory('100000001')).toBe(true);
});
