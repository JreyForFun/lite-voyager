import type { DatabaseSync } from 'node:sqlite';

/** Only disposable databases owned by the browser tests enter this helper. */
export function populateBrowserFixture(database: Pick<DatabaseSync, 'exec' | 'close'>, sql: string): void {
  // Avoid one durable commit per CREATE/INSERT. Keep the complete workload and
  // roll back partial setup on failure; closing SQLite releases an open transaction.
  try { database.exec('BEGIN'); database.exec(sql); database.exec('COMMIT'); }
  finally { database.close(); }
}
