import { describe, expect, test } from 'vitest';
import { isHostMessage, isWebviewMessage } from '../../src/protocol';

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
