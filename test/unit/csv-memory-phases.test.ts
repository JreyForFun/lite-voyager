import { expect, test } from 'vitest';
import { checkMemoryRun, type MemorySample } from '../../src/test/sqlite-memory-support';
import { checkCsvMemoryRun } from '../../src/test/csv-memory-support';

const phases = { importHelperPid: 30, browserHelperPid: 40, baselineAt: 800, pagingStartedAt: 1200, pagingFinishedAt: 1700 };
function evidence(): MemorySample[] {
  return Array.from({ length: 23 }, (_, index) => ({ at: index * 100, hostBytes: 100_000_000,
    helperBytes: index < 8 ? (index < 3 ? 80_000_000 : 180_000_000) : 50_000_000,
    rendererBytes: 200_000_000, helperIds: [index < 8 ? 30 : 40], rendererIds: [50] }));
}

test('NFR-003: Given CI-speed import startup growth and a separate settled SQL helper, When checking actual paging, Then startup stays in the absolute peak without being mislabeled as paging growth', () => {
  const samples = evidence();
  expect(() => checkMemoryRun(samples, 30)).toThrow(/Repeated-paging memory growth 100000000/);
  expect(checkCsvMemoryRun(samples, phases)).toMatchObject({ peakBytes: 280_000_000, pagingGrowthBytes: 0,
    importHelperSamples: 8, baselineSamples: 5, pagingSamples: 5, finalSamples: 5 });
});

test('NFR-003: Given import, handoff or paging budget violations, When checking CSV phases, Then the unchanged absolute peak, gap and actual paging-growth limits still fail', () => {
  for (const index of [0, 7, 8, 22]) {
    const samples = evidence().map((sample, offset) => offset === index ? { ...sample, hostBytes: 500_000_000 } : sample);
    expect(() => checkCsvMemoryRun(samples, phases)).toThrow(/500 MB/);
  }
  const growing = evidence().map((sample, index) => ({ ...sample, helperBytes: index > 17 ? 100_000_001 : sample.helperBytes }));
  expect(() => checkCsvMemoryRun(growing, phases)).toThrow(/Repeated-paging memory growth 50000001/);
  const gapped = evidence().map((sample, index) => ({ ...sample, at: sample.at + (index > 20 ? 3001 : 0) }));
  expect(() => checkCsvMemoryRun(gapped, phases)).toThrow(/gap/);
});

test('NFR-003: Given incomplete helper or phase evidence, When checking CSV memory, Then startup cannot substitute for baseline, repeated paging or final observations', () => {
  expect(() => checkCsvMemoryRun(evidence().slice(4), phases)).toThrow(/import.*five/i);
  expect(() => checkCsvMemoryRun(evidence().filter((sample) => sample.at !== 800), phases)).toThrow(/baseline.*five/i);
  expect(() => checkCsvMemoryRun(evidence().filter((sample) => sample.at !== 1400), phases)).toThrow(/paging.*five/i);
  expect(() => checkCsvMemoryRun(evidence().slice(0, -1), phases)).toThrow(/final.*five/i);
  expect(() => checkCsvMemoryRun(evidence(), { ...phases, browserHelperPid: 30 })).toThrow(/distinct/i);
  expect(() => checkCsvMemoryRun(evidence(), { ...phases, pagingStartedAt: 700 })).toThrow(/phase/i);
  expect(() => checkCsvMemoryRun(evidence(), { ...phases, baselineAt: Number.NaN })).toThrow(/phase/i);
  const missing = evidence().map((sample, index) => index < 8 ? { ...sample, helperBytes: 0 } : sample);
  expect(() => checkCsvMemoryRun(missing, phases)).toThrow(/import/i);
  const reused = evidence().map((sample, index) => index === 22 ? { ...sample, helperIds: [30, 40] } : sample);
  expect(() => checkCsvMemoryRun(reused, phases)).toThrow(/import.*baseline/i);
});
