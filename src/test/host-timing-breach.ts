import { performance } from 'node:perf_hooks';

/** Opt-in action boundaries only; never include SQL, source paths or cell contents. */
export function hostDiagnosticStage(enabled: boolean, label: string, stage: string, report: (line: string) => void = console.log): void {
  if (!enabled) { return; }
  report(`T-030 host diagnostic stage: ${JSON.stringify({ label, stage, pid: process.pid, atMs: performance.now(), timeOriginMs: performance.timeOrigin,
    utc: new Date().toISOString(), scope: 'Fixture action boundary only; temporal proximity is not cause attribution.' })}`);
}

/** Evidence only: emit at the first original failing interval, before a later summary can overwrite a rolling native trace. */
export function hostTimingBreach(enabled: boolean, label: string, report: (line: string) => void = console.log): ((from: number, to: number, phase: string) => void) | undefined {
  if (!enabled) { return undefined; }
  let emitted = false;
  return (from, to, phase) => {
    if (emitted || to - from <= 100) { return; }
    emitted = true;
    report(`T-030 first host timing breach: ${JSON.stringify({ label, pid: process.pid, timeOriginMs: performance.timeOrigin, utc: new Date().toISOString(), from, to, maxGapMs: to - from, phase,
      scope: 'First raw original timer violation; no discarded interval, adjusted clock or cause attribution.' })}`);
  };
}
