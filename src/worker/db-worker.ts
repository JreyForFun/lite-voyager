import { createRequire } from 'node:module';
import { parentPort, threadId, workerData } from 'node:worker_threads';
import type { DatabaseOperation, DatabaseResponse, DatabaseWorkerOptions, DatabaseWorkerRequest } from '../protocol';
import type { EngineMode, ReadBackend } from '../engine/engine';
import { inspectFile } from '../engine/file-snapshot';
import { NodeSqliteEngine } from '../engine/node-sqlite';
import { SqlJsEngine } from '../engine/sqljs';
import { collectPage, checkParameters, checkReadStatement } from '../engine/read-engine';
import { needsFallbackConsent, selectBuiltin } from '../engine/selection';
import { metadataPage } from '../engine/schema';

const port = parentPort;
if (port === null) { throw new Error('The database engine must run in a worker.'); }
function reply(message: DatabaseResponse): void { port?.postMessage(message); }
function optionsFrom(value: unknown): DatabaseWorkerOptions {
  if (typeof value !== 'object' || value === null || !('path' in value) || typeof value.path !== 'string'
    || !('directory' in value) || typeof value.directory !== 'string'
    || !('forceFallback' in value) || typeof value.forceFallback !== 'boolean') { throw new Error('Invalid database worker options.'); }
  return { path: value.path, directory: value.directory, forceFallback: value.forceFallback };
}
function query(backend: ReadBackend, request: DatabaseOperation): void {
  reply({ type: 'started', id: request.id });
  try {
    const value = request.type === 'query'
      ? readQuery(backend, request) : metadataPage(backend, request);
    reply({ type: 'result', id: request.id, value });
  } catch (error: unknown) {
    const text = error instanceof Error ? error.message : '';
    const actionable = /^(Invalid |Pass an exact|The result page|Run only one|The read-only|The query has|The schema object|The table index)/u.test(text);
    const failure = request.type === 'metadata'
      ? 'The SQLite schema could not be read. Refresh the table list, check that the database is still available, or reopen the file.'
      : 'The SQLite query failed. Check the SQL, table names, and read-only mode.';
    reply({ type: 'queryFailed', id: request.id, message: actionable ? text : failure });
  }
}
function readQuery(backend: ReadBackend, request: Extract<DatabaseOperation, { type: 'query' }>) {
  checkReadStatement(request.sql); checkParameters(request.parameters);
  return collectPage(backend.cursor(request.sql, request.parameters), request.page);
}
async function start(): Promise<void> {
  const options = optionsFrom(workerData as unknown);
  const requireLocal = createRequire(__filename);
  const sqlite = selectBuiltin(() => requireLocal('node:sqlite') as typeof import('node:sqlite'), options.forceFallback ? '1' : undefined);
  const snapshot = inspectFile(options.path);
  const engine = sqlite === undefined ? 'sql.js' : 'node:sqlite';
  const mode: EngineMode = {
    engine, memoryLimited: sqlite === undefined, bytes: String(snapshot.stat.size), needsConsent: needsFallbackConsent(engine, snapshot.stat.size),
    notice: sqlite === undefined
      ? 'Memory-limited mode: sql.js loads the entire file into memory. Memory use can exceed the file size. Update VS Code or use a host with node:sqlite for disk-backed access. WAL/journal snapshots are unsupported.'
      : 'Primary engine reads from disk.',
  };
  let resolveConsent: ((approved: boolean) => void) | undefined;
  const consent = mode.needsConsent ? new Promise<boolean>((resolve) => { resolveConsent = resolve; }) : undefined;
  let backend: ReadBackend | undefined;
  // Register before requesting consent so a fast host reply cannot be lost.
  port?.on('message', (request: DatabaseWorkerRequest) => {
    if (request.type === 'consent' && resolveConsent !== undefined) {
      const resolve = resolveConsent; resolveConsent = undefined; resolve(request.approved === true);
    } else if ((request.type === 'query' || request.type === 'metadata') && backend !== undefined) { query(backend, request); }
  });
  reply({ type: 'mode', value: mode });
  if (consent !== undefined && !await consent) { throw new Error('Memory-limited mode: the file was not loaded because consent was declined.'); }
  try {
    backend = sqlite === undefined ? await SqlJsEngine.open(snapshot, options.directory) : new NodeSqliteEngine(sqlite, snapshot.path);
    const selected = backend;
    const run = (sql: string) => collectPage(selected.cursor(sql, []), { limit: 1 });
    run('SELECT name FROM sqlite_schema LIMIT 1');
    if (run('PRAGMA trusted_schema').rows[0]?.[0] !== '0' || run('PRAGMA query_only').rows[0]?.[0] !== '1') { throw new Error('SQLite safety settings could not be confirmed.'); }
    if (sqlite === undefined && run("SELECT name FROM pragma_function_list WHERE name='load_extension'").rows.length !== 0) { throw new Error('SQLite extension loading could not be disabled.'); }
    reply({ type: 'opened', value: { ...mode, threadId, processId: process.pid, sqlite: run('SELECT sqlite_version()').rows[0]?.[0] ?? 'unknown' } });
  } catch (error: unknown) { backend?.close(); throw error; }
}
void start().catch((error: unknown) => {
  const text = error instanceof Error ? error.message : '';
  const message = /^(Memory-limited|The file changed)/u.test(text) ? `Unable to open: ${text}`
    : 'Unable to open the SQLite file. Check that it exists, is readable, and is a valid complete database.';
  reply({ type: 'failed', message });
  port.close();
});
