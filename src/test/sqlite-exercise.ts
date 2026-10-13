import * as assert from 'node:assert/strict';
import { open } from 'node:fs/promises';
import { digestChunks } from './sqlite-digest';
import type { SqliteDocument } from '../editor/sqlite-editor';
import type { BrowserExercise, BrowserStatus } from '../protocol';

export async function sourceDigest(path: string, signal?: AbortSignal): Promise<{ bytes: number; sha256: string }> {
  signal?.throwIfAborted();
  const file = await open(path, 'r');
  try { return await digestChunks(async (buffer) => (await file.read(buffer, 0, buffer.length, null)).bytesRead, signal); }
  finally { await file.close(); }
}
export const painted = (status: BrowserStatus): boolean => !status.busy && status.renderedRows > 0 && status.firstRow.length > 0;
export function waitBrowser(document: SqliteDocument, predicate: (status: BrowserStatus) => boolean, revision = 0, timeout = 15000): Promise<BrowserStatus> {
  const current = document.browserStatus;
  if (current !== undefined && current.revision > revision && predicate(current)) { return Promise.resolve(current); }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error(`T-016 browser deadline: ${JSON.stringify(document.browserStatus)}`)); }, timeout);
    const unsubscribe = document.onBrowserStatus((status) => {
      if (status.revision > revision && predicate(status)) { clearTimeout(timer); unsubscribe(); resolve(status); }
    });
  });
}
let sequence = 1_000_000;
export async function browserAction(document: SqliteDocument, action: BrowserExercise['action'], predicate: (status: BrowserStatus) => boolean, value?: string): Promise<BrowserStatus> {
  const panel = document.panel; assert.ok(panel);
  const revision = document.browserStatus?.revision ?? 0;
  const contextId = document.browserStatus?.contextId; assert.ok(contextId);
  const exerciseId = ++sequence;
  const [, status] = await Promise.all([
    panel.webview.postMessage({ type: 'browserExercise', action, exerciseId, ...(value === undefined ? {} : { value }) } satisfies BrowserExercise)
      .then((delivered) => { assert.equal(delivered, true); }),
    waitBrowser(document, (status) => status.contextId === contextId && status.exerciseId === exerciseId && predicate(status), revision),
  ]);
  return status;
}
export async function startSql(document: SqliteDocument, sql: string): Promise<BrowserStatus> {
  await browserAction(document, 'sql', (status) => !status.busy && status.sqlLength === sql.length, sql);
  return browserAction(document, 'run', (status) => status.busy && /Running SQL/u.test(status.message));
}
export async function runSql(document: SqliteDocument, sql: string, timeout = 15000): Promise<BrowserStatus> {
  const started = await startSql(document, sql);
  return waitBrowser(document, (status) => status.contextId === started.contextId && status.exerciseId === started.exerciseId
    && !status.busy && (status.cachedRows === 0 || painted(status)), started.revision, timeout);
}
