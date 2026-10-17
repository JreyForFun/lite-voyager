export interface XmlEvent { name: string; attributes: Map<string, string>; close: boolean; text?: string; }
function malformed(): never { throw new Error('Malformed XLSX XML. Re-save a valid, unencrypted XLSX workbook and retry.'); }
function xmlCodepoint(code: number): boolean { return code === 9 || code === 10 || code === 13 || code >= 32 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff; }
function entities(text: string): string {
  return text.replace(/&([^;]*);|&/gu, (match, entity: string | undefined) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (entity !== undefined && Object.hasOwn(named, entity)) { return named[entity] ?? ''; }
    if (entity !== undefined && /^#(?:[0-9]+|x[0-9a-fA-F]+)$/u.test(entity)) {
      const value = entity.startsWith('#x') ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (xmlCodepoint(value)) { return String.fromCodePoint(value); }
    }
    void match; return malformed();
  });
}
/** Small strict XML event reader for relationships and raw cell tokens, never HTML. */
export function* xlsxXml(xml: string): Generator<XmlEvent> {
  const stack: string[] = []; let index = 0; let roots = 0;
  while (index < xml.length) {
    if (xml[index] !== '<') {
      const end = xml.indexOf('<', index); const text = entities(xml.slice(index, end < 0 ? xml.length : end));
      if (stack.length === 0 && text.trim() !== '') { malformed(); }
      if (text !== '') { yield { name: '#text', attributes: new Map(), close: false, text }; }
      index = end < 0 ? xml.length : end; continue;
    }
    if (xml.startsWith('<!--', index)) { const end = xml.indexOf('-->', index + 4); if (end < 0) { malformed(); } index = end + 3; continue; }
    if (xml.startsWith('<?', index)) { const end = xml.indexOf('?>', index + 2); if (end < 0) { malformed(); } index = end + 2; continue; }
    if (xml.startsWith('<![CDATA[', index)) {
      const end = xml.indexOf(']]>', index + 9); if (end < 0 || stack.length === 0) { malformed(); }
      yield { name: '#text', attributes: new Map(), close: false, text: xml.slice(index + 9, end) }; index = end + 3; continue;
    }
    if (xml.startsWith('<!', index)) { throw new Error('Unsupported XLSX XML declaration/DTD. Re-save without custom entities.'); }
    let end = index + 1; let quote = '';
    for (; end < xml.length; end++) { const char = xml[end] ?? ''; if (quote !== '') { if (char === quote) { quote = ''; } } else if (char === '"' || char === "'") { quote = char; } else if (char === '>') { break; } }
    if (end === xml.length) { malformed(); }
    const token = xml.slice(index + 1, end); index = end + 1;
    const closing = token.startsWith('/'); const self = token.endsWith('/');
    const match = /^\/?([A-Za-z_][\w.:-]*)/u.exec(token); const qualified = match?.[1]; if (match === null || qualified === undefined) { malformed(); }
    const name = qualified.split(':').at(-1) ?? qualified; const attributes = new Map<string, string>();
    let remaining = token.slice(match[0].length, self ? -1 : undefined);
    if (closing) {
      if (remaining.trim() !== '' || stack.pop() !== qualified) { malformed(); }
      yield { name, attributes, close: true }; continue;
    }
    while (remaining.trim() !== '') {
      const attribute = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/u.exec(remaining);
      const key = attribute?.[1]; if (attribute === null || key === undefined || attributes.has(key)) { malformed(); }
      attributes.set(key, entities(attribute[2] ?? attribute[3] ?? '')); remaining = remaining.slice(attribute[0].length);
    }
    if (stack.length === 0) { roots++; if (roots > 1) { malformed(); } }
    yield { name, attributes, close: false }; if (!self) { stack.push(qualified); } else { yield { name, attributes: new Map(), close: true }; }
  }
  if (stack.length !== 0 || roots !== 1) { malformed(); }
}
