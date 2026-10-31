import { expect, test } from 'vitest';
import { OpeningLifecycleTrace } from '../../src/test/opening-lifecycle-diagnostics';

test('T-030: Given disabled opening diagnostics, When lifecycle stages occur, Then neither timestamps nor output are collected', () => {
  const trace = new OpeningLifecycleTrace(false, () => { throw new Error('Unexpected diagnostic clock'); }, () => { throw new Error('Unexpected diagnostic output'); });
  trace.record({ fallback: true, format: 'csv', kind: 'tabular', view: 1 }, 'close:start');
});

test('T-030: Given a diagnostic opening scope with extra private fields, When a stage is recorded, Then only fixed labels and exact paired timestamps are emitted', () => {
  const output: string[] = [];
  const trace = new OpeningLifecycleTrace(true, () => ({ utc: '2026-10-31T11:58:51.365Z', monotonicMs: 123.5, timezoneOffsetMinutes: -480 }),
    (line) => { output.push(line); });
  trace.record({ fallback: true, format: 'xlsx', kind: 'sqlite', view: 10, path: 'private source path', sql: 'private SQL' }, 'close:complete');
  expect(output).toEqual(['T030 opening lifecycle: {"sequence":1,"fallback":true,"format":"xlsx","kind":"sqlite","view":10,"stage":"close:complete","utc":"2026-10-31T11:58:51.365Z","monotonicMs":123.5,"timezoneOffsetMinutes":-480}']);
});

test('T-030: Given opening diagnostic capacity, When a further stage exceeds it, Then collection fails explicitly without replacing or silently discarding evidence', () => {
  const output: string[] = [];
  const trace = new OpeningLifecycleTrace(true, () => ({ utc: '2026-10-31T11:58:51.365Z', monotonicMs: 1, timezoneOffsetMinutes: 0 }),
    (line) => { output.push(line); }, 1);
  const scope = { fallback: false, format: 'all', kind: 'cleanup', view: 0 } as const;
  trace.record(scope, 'cleanup:start');
  expect(() => trace.record(scope, 'cleanup:complete')).toThrow('Opening lifecycle diagnostic capacity exceeded');
  expect(output).toHaveLength(1);
});

test('T-030: Given invalid opening metadata or timestamps, When recording evidence, Then collection refuses invented labels and non-finite clocks', () => {
  const trace = new OpeningLifecycleTrace(true, () => ({ utc: 'invalid', monotonicMs: Number.NaN, timezoneOffsetMinutes: 0 }), () => {});
  expect(() => trace.record({ fallback: false, format: 'csv', kind: 'tabular', view: 1 }, 'open:start')).toThrow('Invalid opening lifecycle timestamp');
  const scope = { fallback: false, format: 'source data', kind: 'tabular', view: 1 } as const;
  expect(() => trace.record(scope, 'open:start')).toThrow('Invalid opening lifecycle scope');
});
