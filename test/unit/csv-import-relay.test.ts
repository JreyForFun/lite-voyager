import { expect, test } from 'vitest';
import { CsvImportRelay } from '../../src/worker/csv-import-relay';

test('FR-004: Given backpressured progress delivery, When final counters and completion arrive, Then final progress precedes completion and buffering stays bounded', async () => {
  const sent: unknown[] = []; const releases: (() => void)[] = [];
  const relay = new CsvImportRelay((message) => new Promise<void>((accept) => { sent.push(message); releases.push(accept); }), () => { throw new Error('unexpected transport failure'); });
  relay.accept({ type: 'progress', value: 0 });
  for (let value = 1; value <= 10000; value++) { relay.accept({ type: 'progress', value }); }
  relay.accept({ type: 'imported', tables: [] });
  expect(sent).toEqual([{ type: 'progress', value: 0 }]); releases.shift()?.(); await Promise.resolve();
  expect(sent).toEqual([{ type: 'progress', value: 0 }, { type: 'progress', value: 10000 }]); releases.shift()?.(); await Promise.resolve();
  expect(sent.at(-1)).toEqual({ type: 'imported', tables: [] }); releases.shift()?.(); await Promise.resolve();
  relay.accept({ type: 'failure', message: 'late exit' }); expect(sent).toHaveLength(3);
});
