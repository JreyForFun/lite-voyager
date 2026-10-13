import { describe, expect, test } from 'vitest';
import { isHostMessage, isWebviewMessage } from '../../src/protocol';

test('FR-014: Given export requests and bounded counters, When validating messages, Then only CSV/JSON and exact nonnegative counter strings are accepted', () => {
  expect(isWebviewMessage({ type: 'browserExport', requestId: 1, format: 'csv' })).toBe(true);
  expect(isWebviewMessage({ type: 'browserExport', requestId: 2, format: 'json' })).toBe(true);
  for (const format of ['sql', '', null, 1]) { expect(isWebviewMessage({ type: 'browserExport', requestId: 1, format })).toBe(false); }
  const reply = { type: 'browserExportProgress', requestId: 1, phase: 'writing', rows: '9007199254740993', bytes: '65536', blobs: '0' };
  expect(isHostMessage(reply)).toBe(true);
  for (const change of [{ phase: 'finished' }, { rows: 1 }, { bytes: '-1' }, { blobs: '01' }, { rows: 'x'.repeat(1000) }]) { expect(isHostMessage({ ...reply, ...change })).toBe(false); }
  expect(isHostMessage({ type: 'browserExportDone', requestId: 1 })).toBe(true);
  expect(isHostMessage({ type: 'browserExportDone', requestId: 1, report: { rows: '0', bytes: '0', blobs: '0' } })).toBe(true);
  expect(isHostMessage({ type: 'browserExportDone', requestId: 1, report: { rows: '0' } })).toBe(false);
});

test('FR-018: Given visible-cell column ordinals, When validating DOM reports, Then in-range ordinals survive and malformed or out-of-range positions fail', () => {
  const cell = { text: '1e-200', length: 6, label: null, column: 6 };
  const status = { type: 'browserStatus', revision: 1, table: 'a values', offset: 0, cachedRows: 1, renderedRows: 1, renderedColumns: 6, columns: 9,
    hasMore: false, count: null, busy: false, message: '', firstRow: [cell] };
  expect(isWebviewMessage(status)).toBe(true);
  for (const column of [-1, 9, 0.5, '6', null, NaN, Infinity]) {
    expect(isWebviewMessage({ ...status, firstRow: [{ ...cell, column }] })).toBe(false);
  }
});

test('FR-010: Given integration action correlation, When validating the protocol, Then invalid tokens are rejected', () => {
  const exercise = { type: 'browserExercise', action: 'run', exerciseId: 1 };
  expect(isHostMessage(exercise)).toBe(true);
  for (const exerciseId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
    expect(isHostMessage({ ...exercise, exerciseId })).toBe(false);
  }
});

test('FR-010: Given correlated DOM status, When validating it, Then malformed context identities and acknowledgements are rejected', () => {
  const status = { type: 'browserStatus', revision: 1, table: null, offset: 0, cachedRows: 0, renderedRows: 0, renderedColumns: 0, columns: 0,
    hasMore: false, count: null, busy: false, message: '', firstRow: [], contextId: '00000000-0000-4000-8000-000000000000', exerciseId: 0 };
  expect(isWebviewMessage(status)).toBe(true);
  for (const changes of [{ contextId: '' }, { contextId: 1 }, { contextId: 'x'.repeat(100) }, { exerciseId: -1 }, { exerciseId: 1.5 }, { exerciseId: '0' }]) {
    expect(isWebviewMessage({ ...status, ...changes })).toBe(false);
  }
});

test('FR-010: Given literal selected SQL, When validating query messages, Then bounded SQL and page addresses are accepted and malformed inputs rejected', () => {
  const message = { type: 'browserQuery', requestId: 1, sql: 'SELECT \'🚀;\' AS "select"', offset: 0, limit: 100 };
  expect(isWebviewMessage(message)).toBe(true);
  expect(isWebviewMessage({ ...message, sql: 'x'.repeat(4 * 1024 * 1024) })).toBe(true);
  for (const changes of [{ sql: '' }, { sql: '\0' }, { sql: 'x'.repeat(4 * 1024 * 1024 + 1) }, { limit: 101 }, { offset: -1 }, { offset: Number.MAX_SAFE_INTEGER }, { requestId: 0 }]) {
    expect(isWebviewMessage({ ...message, ...changes })).toBe(false);
  }
});

test('FR-011: Given query replies, When validating them, Then timing, page sizes and sparse rows are checked', () => {
  const reply = { type: 'browserQueryRows', requestId: 1, offset: 0, limit: 100, ms: 12.5, page: { columns: ['v'], rows: [['1']], hasMore: false } };
  expect(isHostMessage(reply)).toBe(true);
  for (const changes of [{ ms: -1 }, { ms: NaN }, { ms: Infinity }, { limit: 0 }, { page: { columns: ['v'], rows: [Array(1)], hasMore: false } }]) {
    expect(isHostMessage({ ...reply, ...changes })).toBe(false);
  }
});

describe('protocol skeleton', () => {
  test('T-006: Given the ready handshake, When validated, Then the host accepts it', () => {
    expect(isWebviewMessage({ type: 'ready' })).toBe(true);
  });

  test.each([null, undefined, [], 'ready', {}, { type: 'unknown' }, { type: 1 }])(
    'T-006: Given an invalid webview message, When validated, Then it is rejected (%j)',
    (message) => expect(isWebviewMessage(message)).toBe(false),
  );

  test('T-006: Given a host error, When validated, Then its text and context are accepted', () => {
    expect(isHostMessage({ type: 'error', message: 'Unable to open file.', context: 'open' })).toBe(true);
  });

  test.each([null, [], {}, { type: 'error' }, { type: 'error', message: 42, context: 'open' }, { type: 'error', message: 'error' }])(
    'T-006: Given an invalid host message, When validated, Then it is rejected (%j)',
    (message) => expect(isHostMessage(message)).toBe(false),
  );
});
