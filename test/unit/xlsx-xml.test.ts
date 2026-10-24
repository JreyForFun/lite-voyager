import { expect, test } from 'vitest';
import { xlsxXml } from '../../src/loaders/xlsx-xml';

test('FR-006: Given worksheet XML with comments, prefixes and entities, When reading raw tokens, Then only actual cells contribute numeric text', () => {
  const events = [...xlsxXml('<?xml version="1.0"?><x:root xmlns:x="urn:test"><!-- <c><v>fake</v></c> --><x:v a="&#x1F642; &amp; &quot;">12&#51;</x:v><![CDATA[<literal>]]></x:root>')];
  expect(events.filter((event) => event.name === '#text').map((event) => event.text)).toEqual(['123', '<literal>']);
  expect(events.find((event) => event.name === 'v')?.attributes.get('a')).toBe('🙂 & "');
  for (const invalid of ['<x>', '<x><y></x>', '<x a="1" a="2"/>', '<x>&invalid;</x>', '<!DOCTYPE x><x/>', '<x/><y/>']) {
    expect(() => [...xlsxXml(invalid)]).toThrow(/XLSX/);
  }
});

test.each(['\u0000', '\u0001', '\u000b', '\ufffe', '\uffff', '\ud800', '\udfff'])('FR-006: Given a forbidden literal XML character %j, When reading text, attributes, CDATA, comments or declarations, Then corrupt XLSX XML is refused', (character) => {
  for (const xml of [`<x>${character}</x>`, `<x a="${character}"/>`, `<x><![CDATA[${character}]]></x>`, `<x><!--${character}--></x>`, `<?xml ${character}?><x/>`]) {
    expect(() => [...xlsxXml(xml)]).toThrow(/Malformed XLSX XML/);
  }
});

test('FR-006: Given valid XML characters and Excel string escape spellings, When reading tokens, Then tabs, newlines, Unicode and escaped controls are retained for workbook decoding', () => {
  const text = '\t\n\r🙂\ue000_x0000__x0001_';
  expect([...xlsxXml(`<x>${text}</x>`)].find((event) => event.name === '#text')?.text).toBe(text);
});
