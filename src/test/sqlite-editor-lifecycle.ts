import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { SqliteDocument } from '../editor/sqlite-editor';
import type { HostToWebviewMessage } from '../protocol';

export async function closeEditor(document: SqliteDocument,
  report: (event: string) => void = (event) => { console.log(`SQLite close stage: ${event}`); },
  close: () => PromiseLike<unknown> = () => vscode.commands.executeCommand('workbench.action.closeActiveEditor')): Promise<void> {
  const panel = document.panel;
  assert.ok(panel, 'SQLite editor panel is missing');
  assert.equal(panel.webview.options.enableScripts, true);
  // Database completion precedes outer-frame initialization on fast hosts.
  // Await VS Code's transport handshake before normal test closure. The browser
  // ignores this probe; it does not assert DOM paint or replace close-during-open tests.
  const probe = { type: 'sqliteEditorProbe' } satisfies HostToWebviewMessage;
  const step = async <T>(stage: string, operation: () => PromiseLike<T>): Promise<T> => {
    report(`${stage}:start`);
    try { const result = await operation(); report(`${stage}:complete`); return result; }
    catch (error: unknown) { report(`${stage}:failed`); throw error; }
  };
  assert.equal(await step('transport', () => panel.webview.postMessage(probe)), true, 'SQLite webview transport did not become ready');
  await step('close-command', close);
  await step('helper-exit', () => document.session.closed);
}
