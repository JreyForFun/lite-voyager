import { formatApprovedHostDiagnostics, type ApprovedHostDiagnostic } from './integration-logs.mts';
import { join } from 'node:path';

/** No extra persistence outside the existing macOS diagnostic opt-in. */
export function integrationFailureLog(profile: string, platform: NodeJS.Platform, enabled: string | undefined): string | undefined {
  return platform === 'darwin' && enabled === '1' ? join(profile, 'integration-console.log') : undefined;
}

/** Inspect saved logs even when the host fails; neither failure can become success. */
export async function validateIntegrationRun(
  runHost: () => Promise<void>,
  scanLogs: () => Promise<ApprovedHostDiagnostic[]>,
  report: (message: string) => void,
): Promise<void> {
  const failures: unknown[] = [];
  try { await runHost(); } catch (error: unknown) { failures.push(error); }
  try { report(formatApprovedHostDiagnostics(await scanLogs())); }
  catch (error: unknown) { failures.push(error); }
  if (failures.length === 1) { throw failures[0]; }
  if (failures.length > 1) {
    throw new AggregateError(failures, failures.map((failure) => failure instanceof Error ? failure.message : String(failure)).join('\n'));
  }
}
