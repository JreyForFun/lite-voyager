import type { AuthenticationProvider, AuthenticationProviderAuthenticationSessionsChangeEvent, Event } from 'vscode';

// Models a signed-out account for the isolated integration host. No tokens,
// credentials, network requests, or sign-in UI belong in this fixture.
export function createSignedOutProvider(
  onDidChangeSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent>,
): AuthenticationProvider {
  return {
    onDidChangeSessions,
    getSessions: () => Promise.resolve([]),
    createSession: () => Promise.reject(new Error('Test fixture cannot sign in.')),
    removeSession: () => Promise.reject(new Error('Test fixture has no sessions to remove.')),
  };
}
