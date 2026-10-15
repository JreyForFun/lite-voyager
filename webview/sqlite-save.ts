import { isSqliteSaveExercise, isSqliteSaveState, type SqliteSaveDom, type SqliteSaveRequest } from '../src/protocol';

/** Import-only control: database browsing continues independently of the byte copy. */
export function installSqliteSave(root: Document, post: (value: SqliteSaveRequest | SqliteSaveDom) => void, signal: AbortSignal): void {
  const section = root.querySelector<HTMLElement>('[data-save-context]'); const contextId = section?.dataset['saveContext'];
  if (contextId === undefined) { return; }
  const save = root.getElementById('sqlite-save') as HTMLButtonElement;
  const cancel = root.getElementById('sqlite-save-cancel') as HTMLButtonElement;
  const status = root.getElementById('sqlite-save-status') as HTMLElement;
  save.addEventListener('click', () => { post({ type: 'sqliteSave', contextId }); }, { signal });
  cancel.addEventListener('click', () => { post({ type: 'sqliteSaveCancel', contextId }); }, { signal });
  root.defaultView?.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (isSqliteSaveState(event.data) && event.data.contextId === contextId) {
      const state = event.data; save.disabled = ['choosing', 'copying', 'saving'].includes(state.phase);
      cancel.disabled = !['choosing', 'copying'].includes(state.phase);
      status.textContent = state.message; status.dataset['phase'] = state.phase;
      status.setAttribute('role', state.phase === 'error' ? 'alert' : 'status');
      post({ type: 'sqliteSaveDom', contextId, phase: state.phase, saveDisabled: save.disabled, cancelDisabled: cancel.disabled });
    } else if (isSqliteSaveExercise(event.data)) { (event.data.action === 'save' ? save : cancel).click(); }
  }, { signal });
  post({ type: 'sqliteSaveReady', contextId });
}
