import { checkMemoryRun, type MemoryReport, type MemorySample } from './sqlite-memory-support';

export interface CsvMemoryPhases {
  importHelperPid: number; browserHelperPid: number;
  baselineAt: number; pagingStartedAt: number; pagingFinishedAt: number;
}
export interface CsvMemoryReport extends MemoryReport, CsvMemoryPhases {
  importHelperSamples: number; baselineSamples: number; pagingSamples: number; finalSamples: number;
}

/** The full window sets the peak; only actual post-import paging sets its growth. */
export function checkCsvMemoryRun(samples: MemorySample[], phases: CsvMemoryPhases): CsvMemoryReport {
  const { importHelperPid, browserHelperPid, baselineAt, pagingStartedAt, pagingFinishedAt } = phases;
  if (![importHelperPid, browserHelperPid].every((pid) => Number.isSafeInteger(pid) && pid > 0)
    || importHelperPid === browserHelperPid) { throw new Error('CSV import and browser helpers must have distinct valid identities.'); }
  if (![baselineAt, pagingStartedAt, pagingFinishedAt].every((at) => Number.isFinite(at) && at >= 0)
    || baselineAt >= pagingStartedAt || pagingStartedAt >= pagingFinishedAt) { throw new Error('CSV memory phase markers must be ordered.'); }
  const imported = samples.filter((sample) => sample.helperIds.includes(importHelperPid));
  if (imported.length < 5 || imported.some((sample) => sample.helperBytes === 0)) { throw new Error('The import helper requires at least five resident samples.'); }
  if (imported.some((sample) => sample.at >= baselineAt)) { throw new Error('Import helper observations cannot overlap the settled browser baseline.'); }
  const browser = samples.filter((sample) => sample.helperIds.includes(browserHelperPid));
  const baselineSamples = browser.filter((sample) => sample.at >= baselineAt && sample.at <= pagingStartedAt).length;
  const pagingSamples = browser.filter((sample) => sample.at > pagingStartedAt && sample.at <= pagingFinishedAt).length;
  const finalSamples = browser.filter((sample) => sample.at > pagingFinishedAt).length;
  for (const [phase, count] of [['baseline', baselineSamples], ['paging', pagingSamples], ['final', finalSamples]] as const) {
    if (count < 5) { throw new Error(`CSV ${phase} requires at least five actual browser-helper samples.`); }
  }
  // Preserve the original peak, gap, coverage and 50-MB paging-growth checks.
  // No sample is dropped, no idle memory subtracted and no threshold changes.
  return { ...checkMemoryRun(samples, browserHelperPid, baselineAt), ...phases,
    importHelperSamples: imported.length, baselineSamples, pagingSamples, finalSamples };
}
