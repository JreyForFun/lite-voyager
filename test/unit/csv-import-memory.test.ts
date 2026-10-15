import { expect, test } from 'vitest';
import { memorySample } from '../../src/test/sqlite-memory-support';
import { ProcessMemoryCache } from '../../src/test/csv-memory-cache';
test('NFR-003: Given the extension host and its import helper/worker, When sampling OS memory, Then import residency is included and the unrelated observer is excluded', () => {
  const sample = memorySample([
    { pid: 1, parent: 0, rss: 10, command: 'Code' }, { pid: 2, parent: 1, rss: 100, command: 'extension-host' },
    { pid: 3, parent: 2, rss: 200, command: 'Code C:/extension/dist/csv-import-process.js' },
    { pid: 4, parent: 2, rss: 300, command: 'Code C:/extension/dist/db-process.js' },
    { pid: 5, parent: 2, rss: 1000, command: 'Code scripts/sqlite-memory.mts 2' },
    { pid: 6, parent: 1, rss: 500, command: 'Code --type=renderer' },
  ], 2, 10);
  expect(sample.helperIds).toEqual([3, 4]); expect(sample.hostBytes + sample.helperBytes).toBe(600); expect(sample.rendererBytes).toBe(500);
});

test('NFR-003: Given fresh OS counters and cached process metadata, When polling again or a PID is reused, Then RSS is always refreshed and identity changes require rediscovery', async () => {
  const cache = new ProcessMemoryCache(); const requests: number[][] = [];
  const discover = (items: { pid: number; stamp: string }[]) => {
    requests.push(items.map((item) => item.pid));
    return Promise.resolve(items.map((item) => ({ ...item, parent: 2, command: `Code /dist/csv-import-process.js ${item.stamp}` })));
  };
  const first = await cache.merge([{ pid: 3, stamp: '100', rss: 1000 }], discover);
  const second = await cache.merge([{ pid: 3, stamp: '100', rss: 4000 }], discover);
  expect(first[0]?.rss).toBe(1000); expect(second[0]?.rss).toBe(4000); expect(requests).toEqual([[3]]);
  const reused = await cache.merge([{ pid: 3, stamp: '101', rss: 2000 }, { pid: 4, stamp: '102', rss: 3000 }], discover);
  expect(reused[0]?.command).toContain('101'); expect(requests).toEqual([[3], [3, 4]]);
  await cache.merge([], discover); await cache.merge([{ pid: 3, stamp: '101', rss: 5000 }], discover);
  expect(requests.at(-1)).toEqual([3]);
});

test('NFR-003: Given missing, duplicate or reused process metadata, When merging counters, Then incomplete or stale observations fail instead of being silently omitted', async () => {
  const counters = [{ pid: 3, stamp: '100', rss: 1000 }];
  await expect(new ProcessMemoryCache().merge(counters, () => Promise.resolve([]))).rejects.toThrow(/metadata/i);
  await expect(new ProcessMemoryCache().merge(counters, () => Promise.resolve([{ pid: 3, stamp: '101', parent: 2, command: 'Code' }]))).rejects.toThrow(/identity/i);
  await expect(new ProcessMemoryCache().merge([...counters, ...counters], () => Promise.resolve([]))).rejects.toThrow(/duplicate/i);
});
