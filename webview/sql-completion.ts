import type { CompletionContext, CompletionSource } from '@codemirror/autocomplete';
import { SQLite } from '@codemirror/lang-sql';
import { MAX_COMPLETION_TEXT, type CompletionSearch, type SchemaSuggestions } from '../src/protocol';

interface Token { value: string; from: number; to: number; kind: 'name' | 'quoted' | 'string' | 'comment' | 'symbol'; }
interface Context extends CompletionSearch { from: number; to: number; notice?: string; }
export type SearchSchema = (search: CompletionSearch) => Promise<SchemaSuggestions | undefined>;
// SQLite folds only ASCII identifier case; Unicode case pairs remain distinct.
const nameKey = (name: string): string => name.replace(/[A-Z]/gu, (letter) => letter.toLowerCase());
const keywords = new Set(nameKey(SQLite.spec.keywords ?? '').split(/\s+/u));
const isKeyword = (token: Token | undefined, ...words: readonly string[]): boolean => token?.kind === 'name' && words.includes(nameKey(token.value));
const isSymbol = (token: Token | undefined, value: string): boolean => token?.kind === 'symbol' && token.value === value;
const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** A bounded lexical pass; no execution or claim to resolve CTE/subquery scopes. */
function tokens(text: string): Token[] {
  const result: Token[] = [];
  for (let index = 0; index < text.length;) {
    const from = index; const char = text[index] ?? '';
    if (/\s/u.test(char)) { index++; continue; }
    let kind: Token['kind'] = 'symbol';
    if (text.startsWith('--', index)) { index = text.indexOf('\n', index); if (index < 0) { index = text.length; } kind = 'comment'; }
    else if (text.startsWith('/*', index)) { const end = text.indexOf('*/', index + 2); index = end < 0 ? text.length : end + 2; kind = 'comment'; }
    else if (["'", '"', '`', '['].includes(char)) {
      const end = char === '[' ? ']' : char; index++;
      while (index < text.length) {
        if (text[index++] === end) { if (end !== ']' && text[index] === end) { index++; } else { break; } }
      }
      kind = char === "'" ? 'string' : 'quoted';
    } else if (/[\p{L}\p{N}_$]/u.test(char) || char.charCodeAt(0) >= 128) {
      index++;
      while (index < text.length && /[\p{L}\p{N}\p{M}_$\u0080-\uffff]/u.test(text[index] ?? '')) { index++; }
      kind = 'name';
    } else { index++; }
    const raw = text.slice(from, index);
    const end = char === '[' ? ']' : char;
    const value = kind === 'quoted' ? raw.slice(1, raw.endsWith(end) && raw.length > 1 ? -1 : undefined).replaceAll(end + end, end) : raw;
    result.push({ value, from, to: index, kind });
  }
  return result;
}

export function completionContext(context: CompletionContext): Context | null {
  const fallback: Context = { from: context.pos, to: context.pos, prefix: '', tables: [], includeTables: false };
  if (context.state.doc.length > MAX_COMPLETION_TEXT) { return { ...fallback, notice: 'Schema autocomplete supports SQL documents up to 64 Ki characters. Shorten the document; keywords remain available.' }; }
  const all = tokens(context.state.doc.toString());
  const current = all.find((token) => token.from < context.pos && token.to >= context.pos);
  if (current?.kind === 'comment' || current?.kind === 'string') { return null; }
  const token = current?.kind === 'name' || current?.kind === 'quoted' ? current : undefined;
  if (token === undefined && !context.explicit && !isSymbol(current, '.')) { return null; }
  const from = token?.from ?? context.pos; const to = token?.to ?? context.pos;
  const raw = context.state.sliceDoc(from, context.pos);
  const prefix = token?.kind === 'quoted' ? tokens(raw)[0]?.value ?? '' : raw;
  const start = all.filter((item) => item.kind === 'symbol' && item.value === ';' && item.to <= from).at(-1)?.to ?? 0;
  const end = all.find((item) => item.kind === 'symbol' && item.value === ';' && item.from >= context.pos)?.from ?? context.state.doc.length;
  const statement = all.filter((item) => item.from >= start && item.from < end && item.kind !== 'comment');
  const before = statement.filter((item) => item.to <= from);
  if (before.length === 0) { return null; }
  const result = { from, to, prefix, tables: [] as string[], includeTables: true, useSelectedTable: true };
  if (statement.some((item) => isKeyword(item, 'with')) || statement.some((item, i) => isSymbol(item, '(') && isKeyword(statement[i + 1], 'select'))) {
    return { ...result, notice: 'Schema autocomplete cannot resolve CTEs or subqueries. Use a simple statement or browse its schema; keywords remain available.' };
  }
  const aliases = new Map<string, string>();
  for (let i = 0; i < statement.length; i++) {
    if (!isKeyword(statement[i], 'from', 'join')) { continue; }
    let table = statement[++i];
    if (table?.kind !== 'name' && table?.kind !== 'quoted') { continue; }
    if (isSymbol(statement[i + 1], '.')) {
      if (nameKey(table.value) !== 'main') { return { ...result, notice: 'Only the main database schema is available for autocomplete.' }; }
      table = statement[i += 2];
    }
    if (table === undefined || table.from === from) { continue; }
    result.tables.push(table.value); aliases.set(nameKey(table.value), table.value);
    if (isKeyword(statement[i + 1], 'as')) { i++; }
    const alias = statement[i + 1];
    if (alias?.kind === 'quoted' || alias?.kind === 'name' && !keywords.has(nameKey(alias.value))) { aliases.set(nameKey(alias.value), table.value); }
  }
  result.tables = [...new Set(result.tables)];
  if (result.tables.length > 16) { return { ...result, notice: 'Schema autocomplete supports at most 16 referenced tables. Simplify the statement.' }; }
  const previous = before.at(-1);
  if (isSymbol(previous, '.')) {
    result.useSelectedTable = false;
    const qualifier = before.at(-2)?.value ?? '';
    if (nameKey(qualifier) === 'main' && !aliases.has('main')) { result.tables = []; result.includeTables = true; }
    else { result.tables = [aliases.get(nameKey(qualifier)) ?? qualifier]; result.includeTables = false; }
  } else if (isKeyword(previous, 'from', 'join')) { result.tables = []; result.useSelectedTable = false; }
  return result;
}

export function schemaSource(search: SearchSchema, notice: (message: string) => void): CompletionSource {
  return async (context) => {
    const query = completionContext(context);
    if (query === null) { notice(''); return null; }
    if (query.notice !== undefined) { notice(query.notice); return null; }
    let aborted = false;
    context.addEventListener('abort', () => { aborted = true; }, { onDocChange: true });
    const result = await search({ prefix: query.prefix, tables: query.tables, includeTables: query.includeTables, useSelectedTable: query.useSelectedTable === true });
    if (aborted || context.aborted) { return null; }
    if (result === undefined) { notice('Schema autocomplete is unavailable during other work. Try Ctrl-Space when it finishes; keywords remain available.'); return null; }
    notice(result.hasMore ? 'More schema matches exist. Type a longer prefix to narrow autocomplete (100 suggestions / 64 Ki characters per reply).' : '');
    return { from: query.from, to: query.to, filter: false, options: result.items.map((item) => ({ label: item.name, type: item.kind === 'column' ? 'property' : 'type', detail: item.kind === 'column' ? item.table : item.kind, apply: quote(item.name) })) };
  };
}
