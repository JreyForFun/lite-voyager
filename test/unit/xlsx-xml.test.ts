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
