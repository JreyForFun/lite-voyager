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
import { gridPage } from '../engine/grid-query';
import { writeResults } from './result-export';
import { recoverInterruptedSave, SqliteEdits, sourceVersion } from '../staging/sqlite-edits';

const port = parentPort;
if (port === null) { throw new Error('The database engine must run in a worker.'); }
function reply(message: DatabaseResponse): void { port?.postMessage(message); }
function optionsFrom(value: unknown): DatabaseWorkerOptions {
  if (typeof value !== 'object' || value === null || !('path' in value) || typeof value.path !== 'string'
    || !('directory' in value) || typeof value.directory !== 'string'
    || !('forceFallback' in value) || typeof value.forceFallback !== 'boolean') { throw new Error('Invalid database worker options.'); }
  if ('recoverEditVersion' in value && (typeof value.recoverEditVersion !== 'string' || value.recoverEditVersion.length > 65536)) { throw new Error('Invalid SQLite recovery identity.'); }
  return { path: value.path, directory: value.directory, forceFallback: value.forceFallback,
    ...('recoverEditVersion' in value && typeof value.recoverEditVersion === 'string' ? { recoverEditVersion: value.recoverEditVersion } : {}) };
}
function query(backend: ReadBackend, request: Exclude<DatabaseOperation, { type: 'edit' }>): void {
  reply({ type: 'started', id: request.id });
  try {
    const value = request.type === 'query'
      ? readQuery(backend, request) : request.type === 'grid' ? gridPage(backend, request) : metadataPage(backend, request);
    reply({ type: 'result', id: request.id, value });
  } catch (error: unknown) {
    const text = error instanceof Error ? error.message : '';
    const actionable = /^(Invalid |Pass an exact|The result page|Run only one|The read-only|The query has|The schema object|The table index|The SQLite TEXT|SQLite TEXT)/u.test(text);
    const failure = request.type === 'metadata'
      ? 'The SQLite schema could not be read. Refresh the table list, check that the database is still available, or reopen the file.'
      : 'The SQLite query failed. Check the SQL, table names, and read-only mode.';
    // Query diagnostics belong to the local editor (FR-011), never an Output
    // channel. Render them as literal text; metadata keeps its recovery guidance.
    const message = actionable ? text : request.type === 'query' && text.length > 0 ? `SQLite query error: ${text}` : failure;
    reply({ type: 'queryFailed', id: request.id, message });
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
  if (options.recoverEditVersion !== undefined) {
    if (sqlite === undefined) { throw new Error('SQLite journal recovery requires the native engine. Preserve the source and its sidecars.'); }
    recoverInterruptedSave(options.path, options.recoverEditVersion, sqlite);
  }
  const snapshot = inspectFile(options.path);
  let editing: SqliteEdits | undefined;
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
    } else if (request.type === 'edit' && backend !== undefined && editing !== undefined) {
      const selected = backend;
      reply({ type: 'started', id: request.id });
      void editing.execute(selected, request.command, (replacement) => { backend = replacement; }).then(async (value) => {
        if (request.command.action === 'save' && request.command.destination === undefined) {
          try {
            if (sqlite === undefined) {
              selected.close(); backend = undefined;
              const current = inspectFile(options.path);
              backend = await SqlJsEngine.open(current, options.directory);
              editing = new SqliteEdits(current.path, options.directory, sqlite, sourceVersion(current.path), options.path);
            }
            if (backend === undefined) { throw new Error('Reader unavailable'); }
          } catch {
            reply({ type: 'result', id: request.id, value });
            reply({ type: 'failed', message: 'The save operation settled, but the reader could not reopen the source. Inspect the save result, then close and reopen the editor.' }); return;
          }
        }
        reply({ type: 'result', id: request.id, value });
      }).catch((error: unknown) => {
        reply({ type: 'queryFailed', id: request.id, message: error instanceof Error ? error.message : 'SQLite editing failed. Pending changes were preserved.' });
        if (backend === undefined) { reply({ type: 'failed', message: 'The SQLite reader could not reopen after Save. Close and reopen the editor to continue.' }); }
      });
    } else if (request.type === 'export' && backend !== undefined) {
      void writeResults(backend, request.sql, request.format, request.path, (value) => reply({ type: 'exportProgress', id: request.id, value }))
        .then((value) => reply({ type: 'exported', id: request.id, value }), (error: unknown) => {
          const detail = error instanceof Error ? error.message : '';
          const safe = /^(The read-only|Run only one|Invalid |Unsupported |Memory-limited|The query has|The SQLite TEXT|SQLite TEXT)/u.test(detail);
          reply({ type: 'queryFailed', id: request.id, message: safe ? detail
            : 'The export could not finish. Check SQL, destination permissions and free disk space, then retry. No partial output was saved.' });
        });
    } else if ((request.type === 'query' || request.type === 'metadata' || request.type === 'grid') && backend !== undefined) { query(backend, request); }
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
    editing = new SqliteEdits(snapshot.path, options.directory, sqlite, sourceVersion(snapshot.path), options.path);
    reply({ type: 'opened', value: { ...mode, threadId, processId: process.pid, sqlite: run('SELECT sqlite_version()').rows[0]?.[0] ?? 'unknown' } });
  } catch (error: unknown) { backend?.close(); throw error; }
}
void start().catch((error: unknown) => {
  const text = error instanceof Error ? error.message : '';
  const message = /^(Memory-limited|The file changed|The SQLite source identity changed|SQLite journal recovery)/u.test(text) ? `Unable to open: ${text}`
    : 'Unable to open the SQLite file. Check that it exists, is readable, and is a valid complete database.';
  reply({ type: 'failed', message });
  port.close();
});
