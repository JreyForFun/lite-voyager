import type { AuthenticationProviderAuthenticationSessionsChangeEvent, Event } from 'vscode';
import { expect, test, vi } from 'vitest';
import { createSignedOutProvider } from '../../src/test/fixtures/signed-out-provider';

function fixture() {
  const listener = vi.fn();
  const onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent> = () => {
    listener();
    return { dispose: () => undefined };
  };
  return { provider: createSignedOutProvider(onDidChangeSessions), listener, onDidChangeSessions };
}

test('T-007: Given the authentication fixture, When any scopes are requested, Then it supplies no credentials or session-change events', async () => {
  const { provider, listener, onDidChangeSessions } = fixture();
  expect(provider.onDidChangeSessions).toBe(onDidChangeSessions);
  for (const scopes of [undefined, [], ['read:user']]) {
    expect(await provider.getSessions(scopes, {})).toEqual([]);
  }
  expect(listener).not.toHaveBeenCalled();
});

test('T-007: Given the signed-out fixture, When session creation is requested, Then it explicitly refuses authentication and stays signed out', async () => {
  const { provider } = fixture();
  await expect(provider.createSession([], {})).rejects.toThrow('Test fixture cannot sign in');
  expect(await provider.getSessions(undefined, {})).toEqual([]);
});

test('T-007: Given no fixture sessions, When removal is requested, Then it fails clearly instead of touching real accounts', async () => {
  const { provider } = fixture();
  await expect(provider.removeSession('unexpected-session')).rejects.toThrow('Test fixture has no sessions');
});
