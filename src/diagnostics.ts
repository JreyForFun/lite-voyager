export interface DiagnosticOutput { appendLine(value: string): void; }
interface LifecycleSource {
  readonly state: { readonly phase: string };
  readonly closed: Promise<void>;
  subscribe(listener: () => void): () => void;
}
const phases = new Set(['loading', 'opening', 'ready', 'importing', 'opened', 'error', 'cancelled', 'closed']);

/** Emit fixed labels only: never paths, SQL, schema, values or error text. */
export function logLifecycle(output: DiagnosticOutput | undefined, operation: 'csv' | 'json' | 'xlsx' | 'sqlite', source: LifecycleSource): void {
  if (output === undefined) { return; }
  let previous: string | undefined;
  const report = (phase: string): void => {
    if (!phases.has(phase) || previous === phase) { return; } previous = phase;
    try { output.appendLine(`${operation}: ${phase}`); }
    catch { /* Disposed diagnostic channels must not interrupt source cleanup. */ }
  };
  const unsubscribe = source.subscribe(() => { report(source.state.phase); });
  report(source.state.phase);
  void source.closed.then(() => { unsubscribe(); report('closed'); });
}
