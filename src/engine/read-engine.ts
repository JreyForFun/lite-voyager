import { MAX_PAGE_BYTES, MAX_PAGE_ROWS, type Cell, type Cursor, type EnginePage, type PageAddress, type Parameter } from './engine';

export function pageAddress(value: PageAddress): { offset: number; limit: number } {
  const offset = value.offset ?? 0;
  const limit = value.limit ?? 128;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_ROWS) {
    throw new Error(`Invalid page: offset must be a nonnegative safe integer and limit must be 1–${String(MAX_PAGE_ROWS)}.`);
  }
  return { offset, limit };
}

export function checkParameters(parameters: Parameter[]): void {
  if (!Array.isArray(parameters)) { throw new Error('Invalid query parameters.'); }
  for (const value of parameters) {
    if (value === null || typeof value === 'string' || value instanceof Uint8Array) { continue; }
    if (typeof value !== 'number' || !Number.isFinite(value)) { throw new Error('Invalid query parameter. Use text, finite numbers, NULL, or bytes.'); }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new Error('Pass an exact large integer as text and explicitly CAST it in SQL; a JavaScript number may already be rounded.');
    }
  }
}

export function quoteIdentifier(name: string): string {
  if (typeof name !== 'string' || name.includes('\0')) { throw new Error('Invalid table identifier.'); }
  return `"${name.replaceAll('"', '""')}"`;
}

function display(value: unknown): Cell {
  if (value === null) { return null; }
  if (typeof value === 'string' || typeof value === 'bigint' || typeof value === 'number') { return String(value); }
  if (value instanceof Uint8Array) { return `[BLOB ${String(value.byteLength)} bytes]`; }
  throw new Error('Unsupported SQLite value.');
}

/** Memory is bounded by a single page, even when reaching a distant offset. */
export function collectPage(cursor: Cursor, address: PageAddress): EnginePage {
  try {
    const { offset, limit } = pageAddress(address);
    const rows: Cell[][] = [];
    let bytes = Buffer.byteLength(JSON.stringify({ columns: cursor.columns, rows, hasMore: false }));
    let skipped = 0;
    for (const row of cursor.rows) {
      if (skipped < offset) { skipped++; continue; }
      if (rows.length === limit) { return finish(true); }
      const cells = row.map(display);
      bytes += Buffer.byteLength(JSON.stringify(cells)) + (rows.length > 0 ? 1 : 0);
      if (bytes > MAX_PAGE_BYTES) { throw oversized(); }
      rows.push(cells);
    }
    return finish(false);

    function finish(hasMore: boolean): EnginePage {
      // Only an exhausted cursor that never reached the requested offset needs
      // extra evidence. Normal final pages already imply offset + row count.
      const total = !hasMore && skipped < offset ? String(BigInt(skipped)) : undefined;
      if (bytes + (total === undefined ? 0 : Buffer.byteLength(`,"total":"${total}"`)) > MAX_PAGE_BYTES) { throw oversized(); }
      return { columns: cursor.columns, rows, hasMore, ...(total === undefined ? {} : { total }) };
    }
  } finally { cursor.close(); }
}

function oversized(): Error {
  return new Error('The result page exceeds 4 MiB. Request fewer rows or columns, or select smaller values. No value was truncated.');
}

/** One read statement. PRAGMAs can take effect at prepare time even under EXPLAIN.
 * https://www.sqlite.org/pragma.html
 * Reject the main verb of writable WITH forms before backend text transport;
 * query_only remains an independent database-level write prohibition.
 */
export function checkReadStatement(sql: string): string {
  if (typeof sql !== 'string') { throw new Error('Invalid query SQL.'); }
  const words: string[] = [];
  let ended = false;
  let end = sql.length;
  let depth = 0;
  let cteClosed = false;
  let cteBody = false;
  let bodyPrefix: 'none' | 'as' | 'not' | 'materialized' = 'none';
  let mainVerb: string | undefined;
  for (let index = 0; index < sql.length;) {
    const character = sql[index];
    if (character === undefined) { break; }
    if (/\s/u.test(character)) { index++; continue; }
    if (sql.startsWith('--', index)) { const next = sql.indexOf('\n', index); index = next === -1 ? sql.length : next + 1; continue; }
    if (sql.startsWith('/*', index)) {
      const next = sql.indexOf('*/', index + 2);
      if (next === -1) { throw new Error('The query has an unfinished comment.'); }
      index = next + 2; continue;
    }
    if (ended) { throw new Error('Run only one read statement per query.'); }
    if (character === ';') { ended = true; end = index; index++; continue; }
    if (character === '(') {
      if (depth === 0) { cteBody = bodyPrefix === 'as' || bodyPrefix === 'materialized'; bodyPrefix = 'none'; }
      depth++; index++; continue;
    }
    if (character === ')') { depth--; if (depth === 0) { cteClosed = cteBody; cteBody = false; } index++; continue; }
    if (character === ',' && depth === 0) { cteClosed = false; bodyPrefix = 'none'; index++; continue; }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      if (depth === 0) { bodyPrefix = 'none'; }
      const closing = character === '[' ? ']' : character;
      index++;
      while (index < sql.length) {
        if (sql[index++] === closing) {
          if (character !== '[' && sql[index] === closing) { index++; }
          else { break; }
        }
      }
      continue;
    }
    const word = /^[A-Za-z_]+/u.exec(sql.slice(index))?.[0];
    if (words.length < 4 && word !== undefined) { words.push(word.toUpperCase()); }
    if (depth === 0 && word !== undefined && mainVerb === undefined) {
      const token = word.toUpperCase();
      // Recognize only AS [NOT] MATERIALIZED (body), not a column-name list.
      // Commas begin another CTE, including a legal CTE named "replace".
      if (token === 'AS') { cteClosed = false; bodyPrefix = 'as'; }
      else if (token === 'NOT' && bodyPrefix === 'as') { bodyPrefix = 'not'; }
      else if (token === 'MATERIALIZED' && (bodyPrefix === 'as' || bodyPrefix === 'not')) { bodyPrefix = 'materialized'; }
      else {
        if (cteClosed && ['SELECT', 'VALUES', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(token)) { mainVerb = token; }
        bodyPrefix = 'none';
      }
    }
    index += word?.length ?? 1;
  }
  const first = words[0] === 'EXPLAIN'
    ? words[1] === 'QUERY' && words[2] === 'PLAN' ? words[3] : words[1]
    : words[0];
  if (first !== 'SELECT' && first !== 'WITH' || first === 'WITH' && mainVerb !== undefined && mainVerb !== 'SELECT' && mainVerb !== 'VALUES') {
    throw new Error('The read-only engine accepts SELECT or WITH, optionally prefixed by EXPLAIN or EXPLAIN QUERY PLAN.');
  }
  return sql.slice(0, end);
}
