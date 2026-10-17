import { crc32, deflateRawSync } from 'node:zlib';

/** Disposable OOXML fixtures: lexical numbers are authored without Number coercion. */
export function xmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
export function xlsxCell(address: string, value: string, type = 'n', formula?: string): string {
  return `<c r="${address}" t="${type}">${formula === undefined ? '' : `<f>${xmlText(formula)}</f>`}${type === 'inlineStr' ? `<is><t xml:space="preserve">${xmlText(value)}</t></is>` : `<v>${xmlText(value)}</v>`}</c>`;
}
export function zipFixture(files: Record<string, string>, compressed = false): Buffer {
  const entries: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = Buffer.from(path); const original = Buffer.from(text); const data = compressed ? deflateRawSync(original) : original; const checksum = crc32(original);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(compressed ? 8 : 0, 8); header.writeUInt32LE(checksum, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(original.length, 22); header.writeUInt16LE(name.length, 26);
    entries.push(header, name, data);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(compressed ? 8 : 0, 10); directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(original.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, name); offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, directory, end]);
}
export function xlsxFixture(sheets: { name: string; rows: string; hidden?: boolean; dimension?: string }[], parts: Record<string, string> = {}, compressed = false, firstParts: Record<string, string> = {}): Buffer {
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files: Record<string, string> = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${String(i + 1)}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((sheet, i) => `<sheet name="${xmlText(sheet.name)}" sheetId="${String(i + 1)}" r:id="rId${String(i + 1)}"${sheet.hidden === true ? ' state="hidden"' : ''}/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${String(i + 1)}" Type="${rel}/worksheet" Target="worksheets/sheet${String(i + 1)}.xml"/>`).join('')}</Relationships>`,
  };
  sheets.forEach((sheet, i) => { files[`xl/worksheets/sheet${String(i + 1)}.xml`] = `<worksheet xmlns="${ns}">${sheet.dimension === undefined ? '' : `<dimension ref="${sheet.dimension}"/>`}<sheetData>${sheet.rows}</sheetData></worksheet>`; });
  return zipFixture({ ...firstParts, ...files, ...parts }, compressed);
}
