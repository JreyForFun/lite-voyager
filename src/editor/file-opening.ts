import { extname } from 'node:path';
import * as vscode from 'vscode';

export type TabularFormat = 'csv' | 'json' | 'xlsx';
export function fileFormat(path: string): TabularFormat | undefined {
  switch (extname(path).toLowerCase()) {
    case '.csv': case '.tsv': return 'csv';
    case '.json': case '.jsonl': return 'json';
    case '.xlsx': return 'xlsx';
    default: return undefined;
  }
}
export const OPEN_EDITOR = 'lite-voyager.sqlite';
const patterns = ['*.csv', '*.tsv', '*.json', '*.jsonl', '*.xlsx'];
export interface AssociationState { readonly enabled: boolean; readonly owned: readonly string[] }
type Associations = Readonly<Record<string, string>>;
// Err on the side of preserving a user's choice. A path-specific CSV choice
// blocks our format-wide CSV default too; complex globs are never guessed away.
function couldAffect(pattern: string, extension: string): boolean {
  const lower = pattern.toLowerCase();
  if (/[{}[\]]/u.test(lower)) { return true; }
  const suffix = extname(lower);
  return suffix === extension || /[*?]/u.test(suffix) || (suffix === '' && /[*?]/u.test(lower));
}
export function associationPlan(enabled: boolean, previous: AssociationState, global: Associations, explicit: readonly Associations[]): { state: AssociationState; associations: Record<string, string> } {
  const associations = { ...global };
  const owned = previous.owned.filter((pattern) => patterns.includes(pattern) && global[pattern] === OPEN_EDITOR);
  if (!enabled) {
    for (const pattern of owned) { delete associations[pattern]; }
    return { state: { enabled: false, owned: [] }, associations };
  }
  if (!previous.enabled) {
    for (const pattern of patterns) {
      if (owned.includes(pattern) || Object.hasOwn(global, pattern)) { continue; }
      if (explicit.some((scope) => Object.keys(scope).some((choice) => couldAffect(choice, pattern.slice(1))))) { continue; }
      associations[pattern] = OPEN_EDITOR; owned.push(pattern);
    }
  }
  return { state: { enabled: true, owned }, associations };
}
const stateKey = 'openingAssociations.v1';
function savedState(value: unknown): AssociationState {
  if (typeof value !== 'object' || value === null || !('enabled' in value) || typeof value.enabled !== 'boolean'
    || !('owned' in value) || !Array.isArray(value.owned)) { return { enabled: false, owned: [] }; }
  return { enabled: value.enabled, owned: value.owned.filter((item): item is string => typeof item === 'string' && patterns.includes(item)) };
}
function openingSnapshot(): { enabled: boolean; global: Associations; explicit: readonly Associations[] } {
  const values = vscode.workspace.getConfiguration('workbench').inspect<Record<string, string>>('editorAssociations');
  const global = values?.globalValue ?? {};
  return { enabled: vscode.workspace.getConfiguration('liteVoyager').get<boolean>('openCsvByDefault', false), global,
    explicit: [global, values?.workspaceValue ?? {}, ...(vscode.workspace.workspaceFolders ?? []).map((folder) =>
      vscode.workspace.getConfiguration('workbench', folder.uri).inspect<Record<string, string>>('editorAssociations')?.workspaceFolderValue ?? {})] };
}
export class OpeningDefaults implements vscode.Disposable {
  private pending: Promise<void> = Promise.resolve();
  private disposed = false;
  private readonly listener: vscode.Disposable;
  get settled(): Promise<void> { return this.pending; }
  constructor(private readonly memory: vscode.Memento) {
    this.listener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('liteVoyager.openCsvByDefault') || event.affectsConfiguration('workbench.editorAssociations')) { this.schedule(); }
    });
    this.schedule();
  }
  private schedule(): void {
    this.pending = this.pending.then(async () => {
      if (this.disposed) { return; }
      const previous = savedState(this.memory.get<unknown>(stateKey));
      const configuration = vscode.workspace.getConfiguration('workbench');
      const snapshot = openingSnapshot(); const snapshotKey = JSON.stringify(snapshot);
      const plan = associationPlan(snapshot.enabled, previous, snapshot.global, snapshot.explicit);
      if (JSON.stringify(snapshot.global) !== JSON.stringify(plan.associations)) {
        // Journal before publication for recovery, but discard tentative
        // ownership whenever we know publication did not happen.
        await this.memory.update(stateKey, { enabled: previous.enabled, owned: [...new Set([...previous.owned, ...plan.state.owned])] });
        if (this.disposed || JSON.stringify(openingSnapshot()) !== snapshotKey) {
          await this.memory.update(stateKey, previous);
          if (!this.disposed) { this.schedule(); } return;
        }
        try {
          await configuration.update('editorAssociations', Object.keys(plan.associations).length === 0 ? undefined : plan.associations, vscode.ConfigurationTarget.Global);
        } catch (error: unknown) { await this.memory.update(stateKey, previous); throw error; }
      }
      // Commit ownership even if shutdown began while the successful settings
      // write was in flight; disposal prevents future settings publications.
      if (JSON.stringify(previous) !== JSON.stringify(plan.state)) { await this.memory.update(stateKey, plan.state); }
    }).catch((error: unknown) => {
      void vscode.window.showErrorMessage(`Lite Voyager could not update opening defaults: ${error instanceof Error ? error.message : 'settings unavailable'}. Check settings permissions, then toggle Open Csv By Default off and on to retry.`);
    });
  }
  dispose(): void { this.disposed = true; this.listener.dispose(); }
}

export async function openInLiteVoyager(input?: vscode.Uri): Promise<void> {
  const uri = input ?? vscode.window.activeTextEditor?.document.uri ?? (await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFolders: false,
    title: 'Open in Lite Voyager', filters: { 'Supported data files': ['db', 'sqlite', 'sqlite3', 'db3', 'csv', 'tsv', 'json', 'jsonl', 'xlsx'], 'All files': ['*'] } }))?.[0];
  if (uri === undefined) { return; }
  if (uri.scheme !== 'file') { void vscode.window.showErrorMessage('Lite Voyager supports saved local files. Save the file locally, then open it again.'); return; }
  try { await vscode.commands.executeCommand('vscode.openWith', uri, OPEN_EDITOR); }
  catch (error: unknown) { void vscode.window.showErrorMessage(`Unable to open in Lite Voyager: ${error instanceof Error ? error.message : 'editor unavailable'}. Save the file and try again.`); }
}
