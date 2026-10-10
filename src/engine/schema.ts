import type { DatabaseMetadata } from '../protocol';
import type { EnginePage, ReadBackend } from './engine';
import { collectPage, pageAddress, quoteIdentifier } from './read-engine';

/** Worker-only, side-effect-free PRAGMA functions with bound main-schema names.
 * Resolve functions through the empty temp schema to avoid main-table name
 * collisions. Their explicit 'main' argument still inspects the source file.
 * https://www.sqlite.org/pragma.html#pragma_table_xinfo
 * https://www.sqlite.org/pragma.html#pragma_index_list
 * https://www.sqlite.org/pragma.html#pragma_index_xinfo
 */
export function metadataPage(backend: ReadBackend, request: DatabaseMetadata): EnginePage {
  quoteIdentifier(request.table); pageAddress(request.page);
  const object = collectPage(backend.cursor(
    "SELECT name FROM main.sqlite_schema WHERE type IN ('table', 'view') AND name = ? COLLATE NOCASE AND name NOT GLOB 'sqlite_*'",
    [request.table],
  ), { limit: 1 }).rows[0]?.[0];
  if (object === undefined || object === null) {
    throw new Error('The schema object was not found. Refresh the table list and select an existing table or view.');
  }
  if (request.kind === 'columns') {
    return collectPage(backend.cursor(
      'SELECT cid, name, type, "notnull" AS "notNull", dflt_value AS defaultValue, pk AS primaryKey, hidden FROM temp.pragma_table_xinfo(?, \'main\') ORDER BY cid',
      [object],
    ), request.page);
  }
  if (request.kind === 'indexes') {
    return collectPage(backend.cursor(
      'SELECT i.name, i."unique", i.origin, i.partial, s.sql FROM temp.pragma_index_list(?, \'main\') AS i LEFT JOIN main.sqlite_schema AS s ON s.type = \'index\' AND s.name = i.name ORDER BY i.name',
      [object],
    ), request.page);
  }
  quoteIdentifier(request.index);
  // A WITHOUT ROWID primary-key index has no sqlite_schema entry. Verify
  // membership using index_list so it remains available and foreign indexes fail.
  const index = collectPage(backend.cursor(
    "SELECT name FROM temp.pragma_index_list(?, 'main') WHERE name = ? COLLATE NOCASE",
    [object, request.index],
  ), { limit: 1 }).rows[0]?.[0];
  if (index === undefined || index === null) {
    throw new Error('The table index was not found. Refresh the schema and select an index belonging to this table.');
  }
  return collectPage(backend.cursor(
    'SELECT seqno, cid, name, "desc", coll, "key" FROM temp.pragma_index_xinfo(?, \'main\') ORDER BY seqno',
    [index],
  ), request.page);
}
