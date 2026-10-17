import { constants as bufferConstants } from 'node:buffer';
import { closeSync, fstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs';
import { posix } from 'node:path';
import { read, utils } from 'xlsx';
import { inferredType } from './csv-import';
import { sameXlsxSnapshot, type XlsxSnapshot } from './xlsx-consent';
import { xlsxXml } from './xlsx-xml';
import { validateXlsxZip } from './xlsx-zip';

export interface XlsxCell { text: string | null; kind: 'text' | 'integer' | 'real' | 'null'; }
export interface XlsxSheet { name: string; columns: string[]; rows: Map<number, Map<number, XlsxCell>>; lastRow: number; notice: string; }
interface RawCell { address: string; type: string; value: string; hasValue: boolean; formula: boolean; }
interface RawBook { SheetNames: string[]; Sheets: Record<string, unknown>; files: Record<string, unknown>; }
export const XLSX_NOTICE = 'XLSX is memory-bound: expanded XML and cells can be much larger than the compressed file, even below 100 MB. Each sheet becomes a table; row 1 supplies headers. Formulas use possibly stale cached values only; missing caches become SQL NULL. Dates remain Excel serial numbers or stored ISO text. Blank cells are SQL NULL; empty text stays empty. Booleans become 1/0; Excel errors stay text. Merged cells are not filled. Excel limits: 1,048,576 rows, 16,384 columns and 32,767 text characters/cell; SQLite supports 2,000 columns here. Memory-limited fallback: 20,000,000 source bytes / 64,000,000 SQLite bytes. Source is read-only.';
const nil = (): XlsxCell => ({ text: null, kind: 'null' });
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function snapshot(path: string): XlsxSnapshot {
  const metadata = statSync(path, { bigint: true });
  return { path: realpathSync(path), dev: String(metadata.dev), ino: String(metadata.ino), size: String(metadata.size), mtimeNs: String(metadata.mtimeNs), ctimeNs: String(metadata.ctimeNs) };
}
export function verifyXlsxSource(path: string, expected: XlsxSnapshot): void {
  if (!sameXlsxSnapshot(snapshot(path), expected)) { throw new Error('The XLSX source changed. Retry preview and approve the current file; no table was published.'); }
}
export function xlsxNames(headers: string[], table = false): string[] {
  const used = new Set<string>();
  return headers.map((header, i) => {
    let base = header.trim() === '' ? `${table ? 'sheet' : 'column'}_${String(i + 1)}` : header.replaceAll('\0', '_');
    if (table && /^sqlite_/iu.test(base)) { base = `sheet_${base}`; }
    let name = base; let suffix = 2; const fold = (text: string): string => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
    while (used.has(fold(name))) { name = `${base}_${String(suffix++)}`; } used.add(fold(name)); return name;
  });
}
function xmlFile(book: RawBook, path: string): string {
  const file = book.files[path]; if (!record(file) || !(file['content'] instanceof Uint8Array)) { throw new Error('XLSX workbook is missing a required XML part. Re-save as XLSX and retry.'); }
  const bytes = file['content']; const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}
function mainWorkbookPath(book: RawBook): string {
  const targets: string[] = [];
  for (const event of xlsxXml(xmlFile(book, '_rels/.rels'))) {
    if (event.close || event.name !== 'Relationship' || event.attributes.get('Type')?.endsWith('/officeDocument') !== true) { continue; }
    const target = event.attributes.get('Target'); const mode = event.attributes.get('TargetMode');
    if (target === undefined || target === '' || mode !== undefined && mode !== 'Internal' || /[\\:#?]/u.test(target)) { throw new Error('XLSX main workbook relationship must target one internal package part.'); }
    const path = posix.normalize(target.startsWith('/') ? target.slice(1) : target);
    if (path === '.' || path.startsWith('../') || path === '..' || path.startsWith('/')) { throw new Error('XLSX main workbook relationship escapes the package root.'); }
    targets.push(path);
  }
  const main = targets[0];
  if (targets.length !== 1 || main === undefined) { throw new Error('XLSX main workbook relationship is missing or ambiguous.'); }
  // Match the pinned decoder's CT_LIST.workbooks, including formats we refuse:
  // SheetJS selects the first recognized Override rather than the root relation.
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
  const recognized = new Set([xlsx, 'application/vnd.ms-excel.sheet.macroEnabled.main+xml', 'application/vnd.ms-excel.sheet.binary.macroEnabled.main',
    'application/vnd.ms-excel.addin.macroEnabled.main+xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml']);
  const declarations: { path: string; type: string }[] = [];
  const defaults: string[] = [];
  for (const event of xlsxXml(xmlFile(book, '[Content_Types].xml'))) {
    const type = event.attributes.get('ContentType'); const path = event.attributes.get('PartName');
    if (!event.close && event.name === 'Default' && event.attributes.get('Extension')?.toLowerCase() === 'xml' && type !== undefined) { defaults.push(type); }
    if (!event.close && event.name === 'Override' && type !== undefined && recognized.has(type)) {
      declarations.push({ path: path?.startsWith('/') === true ? path.slice(1) : path ?? '', type });
    }
  }
  const declaration = declarations[0];
  // Compare the actual ZIP key used by SheetJS; normalizing the Override could
  // make different archive entries appear equal and mix their cell values.
  const explicit = declarations.length === 1 && declaration?.type === xlsx && declaration.path === main;
  // Valid packages can declare the main MIME type as the XML Default instead.
  // With no recognized Override, the decoder selects xl/workbook.xml only.
  const implicit = declarations.length === 0 && defaults.length === 1 && defaults[0] === xlsx && main === 'xl/workbook.xml';
  if (!explicit && !implicit) { throw new Error('XLSX main workbook declarations conflict or use an unsupported content type. Re-save as XLSX.'); }
  return main;
}
function* rawCells(xml: string): Generator<RawCell> {
  let current: RawCell | undefined; let inValue = false; let row = -1; let column = -1; let data = false;
  for (const event of xlsxXml(xml)) {
    if (event.name === 'sheetData') { data = !event.close; }
    if (!data) { continue; }
    if (event.name === 'row' && !event.close) {
      row = event.attributes.has('r') ? Number(event.attributes.get('r')) - 1 : row + 1; column = -1;
      if (!Number.isSafeInteger(row) || row < 0 || row >= 1048576) { throw new Error('XLSX row is outside Excel\'s 1,048,576-row limit.'); }
    } else if (event.name === 'c' && !event.close) {
      if (current !== undefined) { throw new Error('Malformed XLSX cell nesting. Re-save the workbook.'); }
      const address = event.attributes.get('r') ?? utils.encode_cell({ r: row, c: column + 1 });
      if (!/^[A-Z]{1,3}[1-9]\d*$/u.test(address)) { throw new Error('XLSX contains an invalid cell address. Re-save and retry.'); }
      const decoded = utils.decode_cell(address); row = decoded.r; column = decoded.c;
      if (row >= 1048576 || column >= 16384) { throw new Error('XLSX cell exceeds Excel worksheet limits.'); }
      current = { address, type: event.attributes.get('t') ?? 'n', value: '', hasValue: false, formula: false };
    } else if (event.name === 'c' && event.close && current !== undefined) { yield current; current = undefined; }
    else if (event.name === 'f' && !event.close && current !== undefined) {
      if (current.formula) { throw new Error('Malformed XLSX cell: duplicate formula elements.'); } current.formula = true;
    }
    else if (event.name === 'v' && current !== undefined) {
      if (!event.close && current.hasValue) { throw new Error('Malformed XLSX cell: duplicate value elements. No values were joined.'); }
      inValue = !event.close; current.hasValue = true;
    }
    else if (event.name === '#text' && inValue && current !== undefined) { current.value += event.text ?? ''; }
  }
}
function missingCache(raw: RawCell): boolean { return raw.formula && (!raw.hasValue || raw.value === '' && raw.type !== 'str'); }
function cell(raw: RawCell, sheet: Record<string, unknown>): XlsxCell {
  if (missingCache(raw)) { return nil(); }
  if (raw.type === 'n') {
    if (!raw.hasValue || raw.value === '') { return nil(); }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(raw.value)) { throw new Error('XLSX contains an invalid numeric cell. No table was published.'); }
    const type = inferredType(raw.value);
    // Scientific notation can spell a huge integer while Number.toString still
    // round-trips its spelling. That is not exact integer storage in SQLite.
    const real = type === 'REAL' && !Number.isInteger(Number(raw.value));
    return { text: raw.value, kind: type === 'INTEGER' ? 'integer' : real ? 'real' : 'text' };
  }
  if (raw.type === 'b') {
    if (raw.value !== '0' && raw.value !== '1') { throw new Error('XLSX contains an invalid boolean cell.'); }
    return { text: raw.value, kind: 'integer' };
  }
  if (raw.type === 'e' || raw.type === 'd') { return raw.hasValue ? { text: raw.value, kind: 'text' } : nil(); }
  if (raw.type === 'z') { return nil(); }
  const parsed = sheet[raw.address]; const value: unknown = record(parsed) ? parsed['v'] : undefined;
  if (!['s', 'str', 'inlineStr'].includes(raw.type) || typeof value !== 'string') { throw new Error('XLSX contains an unsupported or malformed text cell. Re-save as XLSX.'); }
  if (value.length > 32767) { throw new Error('XLSX text exceeds Excel\'s 32,767-character cell limit. No value was truncated.'); }
  return { text: value, kind: 'text' };
}
export function readXlsx(path: string, expected: XlsxSnapshot): { names: string[]; sheet(index: number): XlsxSheet } {
  verifyXlsxSource(path, expected); const fd = openSync(path, 'r'); let book: RawBook;
  try {
    if (!fstatSync(fd, { bigint: true }).isFile()) { throw new Error('Choose a regular XLSX workbook.'); }
    const metadata = fstatSync(fd, { bigint: true });
    if (String(metadata.dev) !== expected.dev || String(metadata.ino) !== expected.ino || String(metadata.size) !== expected.size
      || String(metadata.mtimeNs) !== expected.mtimeNs || String(metadata.ctimeNs) !== expected.ctimeNs) { throw new Error('The XLSX source changed before reading. Retry preview.'); }
    const size = BigInt(expected.size); if (size >= BigInt(bufferConstants.MAX_LENGTH)) { throw new Error('XLSX exceeds this host\'s actual memory-buffer allocation limit. Export sheets to CSV for streaming import.'); }
    const buffer = Buffer.allocUnsafe(Number(size) + 1); let length = 0;
    while (length < buffer.length) { const count = readSync(fd, buffer, length, Math.min(65536, buffer.length - length), null); if (count === 0) { break; } length += count; }
    if (BigInt(length) !== size) { throw new Error('The XLSX source changed while reading. Retry preview.'); }
    const bytes = buffer.subarray(0, length); verifyXlsxSource(path, expected); validateXlsxZip(bytes);
    const parsed: unknown = read(bytes, { type: 'buffer', bookFiles: true, cellFormula: true, cellText: false, cellHTML: false, cellDates: false, sheetStubs: true, nodim: true, WTF: true });
    if (!record(parsed) || !Array.isArray(parsed['SheetNames']) || !parsed['SheetNames'].every((name: unknown) => typeof name === 'string') || !record(parsed['Sheets']) || !record(parsed['files'])) { throw new Error('Invalid XLSX workbook.'); }
    book = parsed as unknown as RawBook;
  } catch (error: unknown) { throw new Error(`Cannot read XLSX workbook: ${error instanceof Error ? error.message : 'corrupt, truncated or encrypted input'}. Re-save a valid unencrypted XLSX and retry.`); }
  finally { closeSync(fd); }
  // SheetJS can recover malformed shared strings (and other XML) silently.
  // Validate every XML part, not just the first worksheet's numeric tokens.
  for (const path of Object.keys(book.files)) {
    if (path.toLowerCase().endsWith('.xml') || path.toLowerCase().endsWith('.rels')) { for (const event of xlsxXml(xmlFile(book, path))) { void event; } }
  }
  const workbookPath = mainWorkbookPath(book);
  const relations = new Map<string, string>(); const folder = posix.dirname(workbookPath);
  for (const event of xlsxXml(xmlFile(book, posix.join(folder, '_rels', posix.basename(workbookPath) + '.rels')))) {
    if (event.name !== 'Relationship' || event.close) { continue; }
    const id = event.attributes.get('Id'); const target = event.attributes.get('Target'); const type = event.attributes.get('Type');
    if (id !== undefined && target !== undefined && type?.endsWith('/worksheet') === true && event.attributes.get('TargetMode') !== 'External') {
      const path = target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join(folder, target)); relations.set(id, path);
    }
  }
  const paths: string[] = [];
  for (const event of xlsxXml(xmlFile(book, workbookPath))) {
    if (event.name === 'sheet' && !event.close) {
      const id = [...event.attributes].find(([name]) => name.endsWith(':id'))?.[1]; const path = id === undefined ? undefined : relations.get(id);
      if (path === undefined) { throw new Error('XLSX includes an unsupported sheet or missing worksheet relationship. No sheets were omitted.'); } paths.push(path);
    }
  }
  if (paths.length !== book.SheetNames.length || paths.length === 0) { throw new Error('XLSX workbook must contain valid worksheets.'); }
  const names = xlsxNames(book.SheetNames, true);
  return { names, sheet(index) {
    const sourceName = book.SheetNames[index]; const path = paths[index]; const parsed = sourceName === undefined ? undefined : book.Sheets[sourceName];
    if (path === undefined || !record(parsed)) { throw new Error('Missing XLSX worksheet.'); }
    const rows = new Map<number, Map<number, XlsxCell>>(); let width = 0; let lastRow = 0; let missing = false;
    for (const raw of rawCells(xmlFile(book, path))) {
      const value = cell(raw, parsed); if (value.text === null && !raw.formula) { continue; }
      const position = utils.decode_cell(raw.address); if (position.c >= 2000) { throw new Error('XLSX exceeds SQLite\'s supported 2,000 columns. No sheet was truncated or imported.'); }
      let row = rows.get(position.r); if (row === undefined) { row = new Map(); rows.set(position.r, row); }
      if (row.has(position.c)) { throw new Error('XLSX has duplicate cell addresses. Re-save without duplicate cells.'); }
      row.set(position.c, value); width = Math.max(width, position.c + 1); lastRow = Math.max(lastRow, position.r); missing ||= missingCache(raw);
    }
    const headers = Array.from({ length: width }, (_, column) => rows.get(0)?.get(column)?.text ?? ''); const columns = width === 0 ? ['__xlsx_empty'] : xlsxNames(headers);
    return { name: names[index] ?? '', columns, rows, lastRow,
      notice: `${XLSX_NOTICE}${missing ? ' This sheet has formulas with missing caches; those cells are SQL NULL.' : ''}${width === 0 ? ' Empty sheet: synthetic __xlsx_empty column, zero rows.' : ''}${headers.some((header, i) => header !== columns[i]) || sourceName !== names[index] ? ' Blank/reserved/colliding names received unique SQL names.' : ''}` };
  } };
}
