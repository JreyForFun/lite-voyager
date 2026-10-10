import { beforeEach, expect, test, vi } from 'vitest';
import type { SqliteDocument } from '../../src/editor/sqlite-editor';
import { isHostMessage } from '../../src/protocol';
import { closeEditor } from '../../src/test/sqlite-editor-lifecycle';

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn<(command: string) => Promise<unknown>>(),
}));
vi.mock('vscode', () => ({ commands: { executeCommand: mocks.executeCommand } }));

function fixture(postMessage: (message: unknown) => Promise<boolean>, closed = Promise.resolve()): SqliteDocument {
  // Model only the test helper's panel/cleanup surface; real webviews stay covered by host tests.
  return { panel: { webview: { options: { enableScripts: false }, postMessage } }, session: { closed } } as unknown as SqliteDocument;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeCommand.mockResolvedValue(undefined);
});

test('FR-001: Given an initializing SQLite webview, When the host test finishes opening, Then normal closure waits for transport readiness and confirmed helper exit', async () => {
  let ready!: (value: boolean) => void;
  const delivery = new Promise<boolean>((resolve) => { ready = resolve; });
  const postMessage = vi.fn<(message: unknown) => Promise<boolean>>(() => delivery);
  let commandIssued!: () => void;
  const command = new Promise<void>((resolve) => { commandIssued = resolve; });
  mocks.executeCommand.mockImplementation(() => { commandIssued(); return Promise.resolve(undefined); });
  let exited!: () => void;
  const closed = new Promise<void>((resolve) => { exited = resolve; });
  const document = fixture(postMessage, closed);
  let finished = false;
  const closing = closeEditor(document).then(() => { finished = true; });
  expect(mocks.executeCommand).not.toHaveBeenCalled();
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'sqliteEditorProbe' });
  ready(true);
  await command;
  expect(mocks.executeCommand).toHaveBeenCalledExactlyOnceWith('workbench.action.closeActiveEditor');
  // Drain pending promise continuations so missing helper-exit waiting cannot
  // pass merely because the close command just resolved.
  await new Promise<void>((resolve) => { setImmediate(resolve); });
  expect(finished).toBe(false);
  exited();
  await closing;
  expect(finished).toBe(true);
});

test('FR-001: Given failed webview delivery, When the host test attempts normal closure, Then the readiness assertion fails without closing the tab', async () => {
  const postMessage = vi.fn<(message: unknown) => Promise<boolean>>().mockResolvedValue(false);
  await expect(closeEditor(fixture(postMessage))).rejects.toThrow('SQLite webview transport did not become ready');
  expect(mocks.executeCommand).not.toHaveBeenCalled();
});

test('FR-001: Given a missing SQLite panel, When the host test attempts normal closure, Then the panel assertion fails without claiming readiness', async () => {
  const document = fixture(() => Promise.resolve(true));
  document.panel = undefined;
  await expect(closeEditor(document)).rejects.toThrow('SQLite editor panel is missing');
  expect(mocks.executeCommand).not.toHaveBeenCalled();
});

test('FR-001: Given the script-free editor transport probe, When checked against the typed host protocol, Then its message is accepted', () => {
  expect(isHostMessage({ type: 'sqliteEditorProbe' })).toBe(true);
});
