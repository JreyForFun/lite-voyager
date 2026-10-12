import { expect, test } from 'vitest';
import { isCellRequest, isCellResponse, isCellWorkerResponse, isWebviewMessage, isHostMessage, MAX_SQL_LENGTH, MAX_CELL_OUTPUT } from '../../src/protocol';

const address = { contextId: '12345678-1234-1234-1234-123456789abc', id: 1 };
test('FR-018: Given typed cell operations, When validated at host/worker boundaries, Then exact nullable strings pass and malformed, sparse, oversized or misdirected values fail', () => {
  const copy = { ...address, type: 'cellCopy', rows: [[null, '', '\\N', '9223372036854775807']] };
  expect(isCellRequest(copy)).toBe(true); expect(isWebviewMessage(copy)).toBe(true); expect(isHostMessage(copy)).toBe(false);
  for (const rows of [[], [[]], [[1]], [['a'], ['b', 'c']], [Array(2)], Array(2), [['x'.repeat(MAX_SQL_LENGTH)]], Array.from({ length: 101 }, () => ['a'])]) {
    expect(isCellRequest({ ...copy, rows })).toBe(false);
  }
  expect(isCellRequest({ ...address, type: 'cellDetails', value: null })).toBe(true);
  expect(isCellRequest({ ...address, type: 'cellDetails', value: 'x'.repeat(MAX_SQL_LENGTH + 1) })).toBe(false);
  expect(isCellRequest({ ...copy, id: 0 })).toBe(false); expect(isCellRequest({ ...copy, contextId: '<script>' })).toBe(false);
  const reply = { ...address, type: 'cellDetailsResult', detail: { text: 'exact', kind: 'Stored text', notice: '' } };
  expect(isCellResponse(reply)).toBe(true); expect(isHostMessage(reply)).toBe(true); expect(isWebviewMessage(reply)).toBe(false);
  expect(isCellResponse({ ...reply, detail: { ...reply.detail, text: 'x'.repeat(MAX_CELL_OUTPUT + 1) } })).toBe(false);
  expect(isCellResponse({ ...reply, detail: { ...reply.detail, kind: 'HTML' } })).toBe(false);
  const prepared = { ...address, type: 'cellCopyPrepared', text: 'exact' };
  expect(isCellWorkerResponse(prepared)).toBe(true); expect(isHostMessage(prepared)).toBe(false);
});
