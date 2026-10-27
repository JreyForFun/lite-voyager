import type { GridOptions } from '../protocol';
import type { EnginePage, PageAddress, Parameter } from '../engine/engine';

export const MAX_STAGED_BYTES = 16 * 1024 * 1024;
export const MAX_STAGED_OPERATIONS = 1000;
export type EditKind = 'text' | 'integer' | 'real' | 'null';
export interface EditValue { kind: EditKind | 'blob'; text: string; }
export interface RowKey { column: string; value: EditValue; }
export interface CellEdit { kind: 'cell'; table: string; key: RowKey[]; column: string; before: EditValue; value: EditValue; }
export interface SqlEdit { kind: 'sql'; sql: string; }
export type EditOperation = CellEdit | SqlEdit;
export interface EditTarget { table: string; column: string; offset: number; grid?: GridOptions; expected: string | null; value: EditValue; }
export type EditCommand =
  | { action: 'prepare'; target: EditTarget; version?: string }
  | { action: 'rows'; table: string; grid: GridOptions; page: PageAddress; version?: string }
  | { action: 'version' }
  | { action: 'save'; version: string; operations: readonly EditOperation[]; destination?: string; temporaryDirectory?: string };
export interface EditRows { page: EnginePage; keys: RowKey[][]; }
export type EditSaveResult = true | { rollbackVersion: string; error: string };

export function editValue(kind: EditKind, text: string): EditValue {
  if (typeof text !== 'string' || text.length > MAX_STAGED_BYTES) { throw new Error('A staged value exceeds 16 MiB. Nothing was truncated.'); }
  if (kind === 'null') { return { kind, text: '' }; }
  if (kind === 'integer') {
    if (text.length > 20 || !/^-?(0|[1-9]\d*)$/u.test(text) || BigInt(text) < -9223372036854775808n || BigInt(text) > 9223372036854775807n) {
      throw new Error('INTEGER must be an exact decimal integer between -9223372036854775808 and 9223372036854775807.');
    }
    return { kind, text: BigInt(text).toString() };
  }
  if (kind === 'real' && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text) || !Number.isFinite(Number(text))
    || Number(text) === 0 && /[1-9]/u.test(text.replace(/[eE].*$/u, '')))) {
    throw new Error('REAL must be a finite representable decimal number, without underflow.');
  }
  if (kind !== 'text' && kind !== 'real') { throw new Error('Choose TEXT, INTEGER, REAL or NULL.'); }
  if (kind === 'text') {
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(++index);
        if (!(next >= 0xdc00 && next <= 0xdfff)) { throw new Error('TEXT contains an unpaired Unicode surrogate. No replacement characters were written.'); }
      } else if (code >= 0xdc00 && code <= 0xdfff) { throw new Error('TEXT contains an unpaired Unicode surrogate. No replacement characters were written.'); }
    }
  }
  return { kind, text };
}

export function valueBinding(value: EditValue): { expression: string; parameter: Parameter } {
  if (value.kind === 'blob') {
    if (!/^(?:[a-f\d]{2})*$/iu.test(value.text)) { throw new Error('Invalid binary row key.'); }
    return { expression: '?', parameter: Uint8Array.from(value.text.match(/../gu) ?? [], (byte) => Number.parseInt(byte, 16)) };
  }
  const checked = editValue(value.kind, value.text);
  // sql.js bindString uses sqlite3_bind_text(..., -1), so embedded NUL would
  // truncate a bound string. JSON string transport contains no literal NUL;
  // SQLite decodes it as TEXT in its own encoding (including UTF-16 databases).
  // JSON support is already required by FR-005; the value remains a parameter.
  if (checked.kind === 'text' && checked.text.includes('\0')) {
    return { expression: "json_extract(?, '$')", parameter: JSON.stringify(checked.text) };
  }
  return checked.kind === 'null' ? { expression: '?', parameter: null }
    : { expression: checked.kind === 'integer' ? 'CAST(? AS INTEGER)' : checked.kind === 'real' ? 'CAST(? AS REAL)' : '?', parameter: checked.text };
}

/** Deliberately one direct DML statement. Skip SQL quoting/comments before
 * considering semicolons. No PRAGMA, ATTACH, DDL, transaction or CTE entry point. */
export function checkWriteStatement(sql: string): string {
  if (typeof sql !== 'string' || sql.length === 0 || sql.length > 4 * 1024 * 1024 || sql.includes('\0')) { throw new Error('Stage one SQL write of at most 4 Mi characters without NUL.'); }
  let first: string | undefined; let ended = false; let end = sql.length;
  for (let index = 0; index < sql.length;) {
    const character = sql[index];
    if (character === undefined) { break; }
    if (/\s/u.test(character)) { index++; continue; }
    if (sql.startsWith('--', index)) { const next = sql.indexOf('\n', index); index = next < 0 ? sql.length : next + 1; continue; }
    if (sql.startsWith('/*', index)) {
      const next = sql.indexOf('*/', index + 2); if (next < 0) { throw new Error('SQL has an unfinished comment.'); } index = next + 2; continue;
    }
    if (ended) { throw new Error('Stage only one UPDATE, INSERT or DELETE statement at a time.'); }
    if (character === ';') { ended = true; end = index++; continue; }
    if (character === '?' || ':@$'.includes(character) && !/[A-Za-z_\d$]/u.test(sql[index - 1] ?? '')) {
      throw new Error('Stage SQL has unbound parameters. Use SQL literals; parameter entry is not supported.');
    }
    if (first === undefined) {
      first = /^[a-z]+/iu.exec(sql.slice(index))?.[0].toUpperCase();
      if (!['UPDATE', 'INSERT', 'DELETE'].includes(first ?? '')) { throw new Error('Stage only one direct UPDATE, INSERT or DELETE. Transaction, schema and file controls are not supported.'); }
    }
    if (["'", '"', '`', '['].includes(character)) {
      const close = character === '[' ? ']' : character; let closed = false; index++;
      while (index < sql.length) {
        if (sql[index++] !== close) { continue; }
        if (close !== ']' && sql[index] === close) { index++; } else { closed = true; break; }
      }
      if (!closed) { throw new Error('SQL has an unfinished quoted value or identifier.'); }
    } else { index++; }
  }
  if (first === undefined) { throw new Error('Enter an UPDATE, INSERT or DELETE to stage.'); }
  return sql.slice(0, end);
}

export function keyId(table: string, key: RowKey[]): string { return JSON.stringify([table, key]); }
export function editDisplay(value: EditValue): string | null { return value.kind === 'null' ? null : value.kind === 'real' ? String(Number(value.text)) : value.text; }

/** Backups and helper IPC are data, never trusted SQL/row identity objects. */
export function assertEditOperations(value: unknown): asserts value is EditOperation[] {
  const record = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item);
  const name = (item: unknown): item is string => typeof item === 'string' && item.length <= 4 * 1024 * 1024 && !item.includes('\0');
  const scalar = (item: unknown, blob = false): boolean => {
    if (!record(item) || typeof item['text'] !== 'string') { return false; }
    if (item['kind'] === 'blob') { return blob && /^(?:[a-f\d]{2})*$/iu.test(item['text']); }
    if (!['text', 'integer', 'real', 'null'].includes(String(item['kind']))) { return false; }
    try { editValue(item['kind'] as EditKind, item['text']); return true; } catch { return false; }
  };
  if (!Array.isArray(value) || value.length > MAX_STAGED_OPERATIONS) { throw new Error('Invalid staged-edit queue. Preserve its backup for recovery.'); }
  for (const item of value as unknown[]) {
    if (!record(item)) { throw new Error('Invalid staged-edit operation.'); }
    if (item['kind'] === 'sql' && typeof item['sql'] === 'string') { checkWriteStatement(item['sql']); continue; }
    if (item['kind'] !== 'cell' || !name(item['table']) || !name(item['column']) || !scalar(item['before']) || !scalar(item['value'])
      || !Array.isArray(item['key']) || item['key'].length === 0 || item['key'].length > 1000
      || !item['key'].every((key: unknown) => record(key) && name(key['column']) && scalar(key['value'], true))) { throw new Error('Invalid staged cell or row identity. Preserve its backup for recovery.'); }
  }
}
