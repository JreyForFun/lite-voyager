import { isGridOptions, type DatabaseGrid, type GridOptions } from '../protocol';
import type { EnginePage, Parameter, ReadBackend } from './engine';
import { collectPage, pageAddress, quoteIdentifier } from './read-engine';

/** SQLite bounds expression depth; balance AND so 1,000 filters stay shallow. */
function conjunction(predicates: string[]): string {
  const first = predicates[0];
  if (first === undefined) { return ''; }
  if (predicates.length === 1) { return first; }
  const middle = Math.floor(predicates.length / 2);
  return `(${conjunction(predicates.slice(0, middle))} AND ${conjunction(predicates.slice(middle))})`;
}

/** No SQL fragments from controls: identifiers quoted, contains values bound. */
export function gridSql(table: string, options: GridOptions, count = false): { sql: string; parameters: Parameter[] } {
  if (!isGridOptions(options)) { throw new Error('Invalid grid controls. Filter text is limited to 65,536 characters across at most 1,000 columns. Nothing was truncated.'); }
  const parameters: Parameter[] = [];
  const predicates = (options.filters ?? []).map((filter) => {
    const column = quoteIdentifier(filter.column);
    if (filter.operator !== 'contains') { return `${column} IS ${filter.operator === 'isNull' ? '' : 'NOT '}NULL`; }
    parameters.push(filter.value);
    // instr is case-sensitive/literal. Do not expose stored BLOB bytes as text.
    return `(typeof(${column}) <> 'blob' AND instr(CAST(${column} AS TEXT), ?) > 0)`;
  });
  const where = predicates.length === 0 ? '' : ` WHERE ${conjunction(predicates)}`;
  const order = count || options.sort === undefined ? '' : ` ORDER BY ${quoteIdentifier(options.sort.column)} ${options.sort.direction === 'asc' ? 'ASC' : 'DESC'}`;
  return { sql: `SELECT ${count ? 'COUNT(*)' : '*'} FROM main.${quoteIdentifier(table)}${where}${order}`, parameters };
}

/** EQP is diagnostic and version-sensitive (sqlite.org/eqp.html). Recognize
 * only a single indexed scan/search; unknown/multi-node plans always warn.
 * Actual plans for both bundled engines are exercised, never infer from an
 * index merely existing (partial, expression and composite indexes differ).
 */
export function indexedOrdering(plan: EnginePage): boolean {
  return !plan.hasMore && plan.columns.join(',') === 'id,parent,notused,detail' && plan.rows.length === 1
    && /^(SCAN|SEARCH) .+ USING (COVERING )?INDEX .+$/su.test(plan.rows[0]?.[3] ?? '');
}

export function gridPage(backend: ReadBackend, request: DatabaseGrid): EnginePage {
  pageAddress(request.page);
  if (request.kind !== 'rows' && request.kind !== 'count') { throw new Error('Invalid grid operation.'); }
  const query = gridSql(request.table, request.options, request.kind === 'count');
  const object = collectPage(backend.cursor("SELECT type FROM main.sqlite_schema WHERE name = ? COLLATE NOCASE AND type IN ('table', 'view') AND name NOT GLOB 'sqlite_*'", [request.table]), { limit: 1 });
  if (object.rows.length === 0) { throw new Error('The schema object was not found. Refresh the table list.'); }
  // Reading metadata rather than SELECT * avoids executing expensive views.
  // Page through schema names; retain only requested names, never all columns.
  const wanted = new Set([...(request.options.filters ?? []).map((filter) => filter.column), ...(request.options.sort === undefined ? [] : [request.options.sort.column])]);
  const cursor = backend.cursor("SELECT name FROM temp.pragma_table_xinfo(?, 'main')", [request.table]);
  try {
    for (const row of cursor.rows) { if (typeof row[0] === 'string') { wanted.delete(row[0]); } }
  } finally { cursor.close(); }
  if (wanted.size > 0) { throw new Error('Invalid grid column. Refresh the table and choose an existing column.'); }
  if (request.kind === 'rows' && request.options.sort !== undefined && request.options.allowSlowSort !== true) {
    const plan = collectPage(backend.cursor(`EXPLAIN QUERY PLAN ${query.sql}`, query.parameters), { limit: 2 });
    if (object.rows[0]?.[0] === 'view' || !indexedOrdering(plan)) {
      return { columns: [], rows: [], hasMore: false,
        sortWarning: 'Indexed ordering could not be established. Sorting may scan the entire table and use temporary disk or memory; large tables can take a long time. Continue sort to proceed. You can cancel the running operation.' };
    }
  }
  return collectPage(backend.cursor(query.sql, query.parameters), request.kind === 'count' ? { limit: 1 } : request.page);
}
