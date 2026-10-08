import { describe, expect, test } from 'vitest';
import { isHostMessage, isWebviewMessage } from '../../src/protocol';

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
