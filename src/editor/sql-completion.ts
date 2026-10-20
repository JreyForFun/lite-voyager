import type { Engine, Parameter } from '../engine/engine';
import { isCompletionSearch, MAX_COMPLETION_TEXT, type CompletionSearch, type SchemaSuggestions, type SchemaSuggestion } from '../protocol';

/** SELECTs execute in the existing supervised worker. Never read user-table rows. */
export async function findCompletions(engine: Pick<Engine, 'query'>, search: CompletionSearch): Promise<SchemaSuggestions> {
  if (!isCompletionSearch(search)) { throw new Error('Invalid autocomplete context. Shorten the prefix or table list. Nothing was truncated.'); }
  const queries: string[] = [];
  const parameters: Parameter[] = [];
  if (search.includeTables) {
    queries.push("SELECT type AS kind, name, '' AS tableName FROM main.sqlite_schema WHERE type IN ('table', 'view') AND name NOT GLOB 'sqlite_*' AND substr(name, 1, length(?)) = ? COLLATE NOCASE");
    parameters.push(search.prefix, search.prefix);
  }
  if (search.tables.length > 0) {
    queries.push(`SELECT 'column' AS kind, p.name, s.name AS tableName FROM main.sqlite_schema AS s JOIN temp.pragma_table_xinfo(s.name, 'main') AS p WHERE s.type IN ('table', 'view') AND s.name NOT GLOB 'sqlite_*' AND s.name COLLATE NOCASE IN (${search.tables.map(() => '?').join(', ')}) AND substr(p.name, 1, length(?)) = ? COLLATE NOCASE`);
    parameters.push(...search.tables, search.prefix, search.prefix);
  }
  if (queries.length === 0) { return { items: [], hasMore: false }; }
  const page = await engine.query(`SELECT * FROM (${queries.join(' UNION ALL ')}) ORDER BY name COLLATE NOCASE, kind, tableName`, parameters, { limit: 100 });
  const items: SchemaSuggestion[] = [];
  let size = 0;
  for (const row of page.rows) {
    const [kind, name, table] = row;
    if ((kind !== 'column' && kind !== 'table' && kind !== 'view') || typeof name !== 'string' || typeof table !== 'string' || name.includes('\0') || table.includes('\0')) {
      throw new Error('The database returned invalid autocomplete metadata.');
    }
    size += name.length + table.length;
    if (size > MAX_COMPLETION_TEXT) { return { items, hasMore: true }; }
    items.push({ kind, name, table });
  }
  return { items, hasMore: page.hasMore };
}
