import * as vscode from 'vscode';
import { createSignedOutProvider } from './signed-out-provider';

export function activate(context: vscode.ExtensionContext): void {
  if (context.extensionMode !== vscode.ExtensionMode.Test) {
    throw new Error('The signed-out authentication fixture can only run in the integration test host.');
  }
  const changes = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  context.subscriptions.push(changes, vscode.authentication.registerAuthenticationProvider(
    'github', 'Signed-out test fixture', createSignedOutProvider(changes.event),
  ));
}
