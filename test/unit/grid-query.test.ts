import { expect, test } from 'vitest';
import { gridSql, indexedOrdering } from '../../src/engine/grid-query';
import { isGridOptions, MAX_FILTER_TEXT } from '../../src/protocol';

test('FR-017: Given hostile identifiers and text, When building a filtered sort, Then identifiers are quoted and values are bound literally', () => {
  const text = "%_' OR 1=1 -- 🚀";
  const result = gridSql('order "🚀', { sort: { column: 'select "', direction: 'desc' }, filters: [
    { column: 'select "', operator: 'contains', value: text }, { column: 'null', operator: 'isNull' },
  ] });
  expect(result.parameters).toEqual([text]);
  expect(result.sql).toContain('main."order ""🚀"');
  expect(result.sql).toContain('"select """ DESC');
  expect(result.sql).toContain('"null" IS NULL');
  expect(result.sql).not.toContain(text);
  expect(gridSql('t', { sort: { column: 'c', direction: 'asc' }, filters: [{ column: 'c', operator: 'isNotNull' }] }, true).sql).toBe('SELECT COUNT(*) FROM main."t" WHERE "c" IS NOT NULL');
});

test('FR-017: Given malformed or excessive filters, When validating controls, Then sparse arrays, duplicates, unsafe operators and text overflow are rejected', () => {
  expect(isGridOptions({ filters: Array.from({ length: 1001 }, (_value, index) => ({ column: `c${String(index)}`, operator: 'isNotNull' })) })).toBe(false);
  expect(isGridOptions({ sort: { column: '🚀', direction: 'asc' }, filters: [{ column: 'a', operator: 'contains', value: '' }] })).toBe(true);
  for (const value of [null, [], { sort: { column: 'a', direction: 'DESC;DELETE' } }, { filters: Array(1) },
    { filters: [{ column: 'a', operator: 'contains', value: 1 }] }, { allowSlowSort: 'yes' },
    { filters: [{ column: 'a', operator: 'isNull' }, { column: 'a', operator: 'isNotNull' }] },
    { filters: [{ column: 'a', operator: 'contains', value: 'x'.repeat(MAX_FILTER_TEXT + 1) }] }]) {
    expect(isGridOptions(value)).toBe(false);
  }
});

test('FR-017: Given indexed, temporary or unknown plan diagnostics, When deciding whether to warn, Then only an established single indexed scan bypasses confirmation', () => {
  const plan = (detail: string) => ({ columns: ['id', 'parent', 'notused', 'detail'], rows: [['4', '0', '0', detail]], hasMore: false });
  expect(indexedOrdering(plan('SCAN main.t USING INDEX t_c'))).toBe(true);
  expect(indexedOrdering(plan('SEARCH main.t USING COVERING INDEX t_c (c=?)'))).toBe(true);
  expect(indexedOrdering(plan('SCAN main.t'))).toBe(false);
  expect(indexedOrdering({ ...plan('SCAN main.t USING INDEX t_c'), rows: [['4', '0', '0', 'SCAN main.t USING INDEX t_c'], ['5', '0', '0', 'USE TEMP B-TREE FOR ORDER BY']] })).toBe(false);
  expect(indexedOrdering(plan('A future planner format'))).toBe(false);
});
