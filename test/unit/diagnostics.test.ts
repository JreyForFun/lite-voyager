import { expect, test, vi } from 'vitest';
import { logLifecycle } from '../../src/diagnostics';

test('NFR-010: Given an import with sensitive names, SQL, values and errors, When phases change and the view closes, Then Output receives only fixed lifecycle labels and detaches', async () => {
  const output = { appendLine: vi.fn<(value: string) => void>() }; const listeners = new Set<() => void>();
  let phase = 'loading'; let close!: () => void; const closed = new Promise<void>((accept) => { close = accept; });
  const source = { get state() { return { phase, message: 'secret.csv SELECT password FROM customer', rows: [['private content']] }; }, closed,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  logLifecycle(output, 'csv', source);
  for (const next of ['ready', 'ready', 'importing', 'opened', 'secret.csv', 'error']) { phase = next; for (const listener of listeners) { listener(); } }
  close(); await closed;
  expect(output.appendLine.mock.calls.map(([line]) => line)).toEqual(['csv: loading', 'csv: ready', 'csv: importing', 'csv: opened', 'csv: error', 'csv: closed']);
  expect(listeners.size).toBe(0);
});

test('NFR-010: Given an Output channel disposed during shutdown, When diagnostics run, Then logging cannot interrupt lifecycle cleanup', async () => {
  let unsubscribe = false; const output = { appendLine: () => { throw new Error('channel disposed'); } };
  const closed = Promise.resolve();
  expect(() => logLifecycle(output, 'xlsx', { state: { phase: 'error' }, closed, subscribe: () => () => { unsubscribe = true; } })).not.toThrow();
  await closed; expect(unsubscribe).toBe(true);
});
