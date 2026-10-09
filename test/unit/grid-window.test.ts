import { expect, test } from 'vitest';
import { GridPages, gridWindow, logicalOffset, physicalOffset, trackHeight } from '../../webview/grid-window';

test('T-008: Given ten million rows, When viewing or resizing, Then only viewport plus overscan is selected', () => {
  expect(gridWindow(10_000_000, 0, 560)).toEqual({ start: 0, end: 26 });
  expect(gridWindow(10_000_000, 28_000, 560)).toEqual({ start: 994, end: 1026 });
  expect(gridWindow(10_000_000, 28_000, 840)).toEqual({ start: 994, end: 1036 });
  expect(gridWindow(0, 0, 560)).toEqual({ start: 0, end: 0 });
});

test('T-008: Given browser height limits, When mapping first middle and last positions, Then all rows remain reachable', () => {
  expect(trackHeight(10_000_000)).toBe(8_000_000);
  const last = 10_000_000 * 28 - 560;
  for (const offset of [0, last / 2, last]) {
    expect(logicalOffset(10_000_000, physicalOffset(10_000_000, offset, 560), 560)).toBeCloseTo(offset, 5);
  }
  expect(gridWindow(10_000_000, last, 560)).toEqual({ start: 9_999_974, end: 10_000_000 });
  expect(logicalOffset(10, 0, 560)).toBe(0);
  expect(physicalOffset(10, 300, 560)).toBe(0);
});

test('T-008: Given a bounded page cache, When pages arrive and the viewport changes, Then requests are sequential and cache is limited', () => {
  const pages = new GridPages();
  const first = pages.request(0, 26);
  expect(first).toEqual({ type: 'spikePageRequest', requestId: 1, offset: 0 });
  expect(pages.request(1000, 1032)).toBeUndefined();
  expect(pages.accept({ type: 'spikePage', requestId: 999, offset: 0, rows: [] })).toBe(false);
  expect(pages.inFlight).toBe(true);
  expect(pages.accept({ type: 'spikePage', requestId: 1, offset: 0, rows: Array.from({ length: 128 }, () => ['x']) })).toBe(true);
  expect(pages.row(0)).toEqual(['x']);
  for (let page = 1; page <= 5; page++) {
    const request = pages.request(page * 128, page * 128 + 20);
    expect(request).toBeDefined();
    if (request === undefined) { throw new Error('Missing page request'); }
    expect(pages.accept({ type: 'spikePage', requestId: request.requestId, offset: request.offset, rows: Array.from({ length: 128 }, () => ['x']) })).toBe(true);
  }
  expect(pages.cachedRows).toBe(512);
  expect(pages.row(0)).toBeUndefined();
  expect(pages.request(640, 660)).toBeUndefined();
  pages.clear();
  expect(pages.cachedRows).toBe(0);
  expect(pages.inFlight).toBe(false);
});

test('T-008: Given fractional scroll and an out-of-range jump, When calculating rows, Then edges are clamped without skipping the partial row', () => {
  expect(gridWindow(100, 27, 56)).toEqual({ start: 0, end: 9 });
  expect(gridWindow(100, -28, 56)).toEqual({ start: 0, end: 8 });
  expect(gridWindow(100, 100_000, 56)).toEqual({ start: 92, end: 100 });
});
