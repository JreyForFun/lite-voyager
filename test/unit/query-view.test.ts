import { expect, test } from 'vitest';
import { QueryView } from '../../webview/query-view';

test('FR-011: Given successful paged SQL, When a page is committed, Then literal paging SQL and honest row count/time summaries are kept', () => {
  const query = new QueryView();
  query.commit('SELECT x FROM data ORDER BY x', 100, { columns: ['x'], rows: [['101']], hasMore: true }, 12.25);
  expect(query.sql).toBe('SELECT x FROM data ORDER BY x');
  expect(query.summary).toContain('101–101');
  expect(query.summary).toContain('more rows available');
  expect(query.summary).toContain('12.3 ms');
  expect(query.count).toBeNull();
  if (query.sql === null) { throw new Error('Expected successful query SQL'); }
  query.commit(query.sql, 200, { columns: ['x'], rows: [['201']], hasMore: false }, 0);
  expect(query.count).toBe('201');
  expect(query.summary).toContain('Total rows: 201');
});

test('FR-011: Given empty results or reset, When committing, Then zero is shown and reset releases query context', () => {
  const query = new QueryView();
  query.commit('SELECT 1 WHERE 0', 0, { columns: ['1'], rows: [], hasMore: false }, 2);
  expect(query.summary).toContain('No rows');
  expect(query.count).toBe('0');
  query.reset();
  expect(query.sql).toBeNull();
  expect(query.count).toBeNull();
});
