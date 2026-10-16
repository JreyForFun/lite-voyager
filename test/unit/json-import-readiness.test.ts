import { expect, test } from 'vitest';
import { populatedJsonBrowseReady } from '../../src/test/json-import-readiness';

test('FR-005: Given early editor-ready and pending/empty DOM statuses, When a JSON stress test prepares to click Run, Then it waits for the populated idle Browse page', () => {
  const page = { editorReady: true, busy: false, cachedRows: 100, renderedRows: 12, query: false };
  expect(populatedJsonBrowseReady(page)).toBe(true);
  for (const status of [undefined, { ...page, cachedRows: 0, renderedRows: 0 }, { ...page, busy: true },
    { ...page, editorReady: false }, { ...page, renderedRows: 0 }, { ...page, query: true }]) {
    expect(populatedJsonBrowseReady(status)).toBe(false);
  }
});
