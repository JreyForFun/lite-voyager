export const SPIKE_ROW_COUNT = 10_000_000;
export const SPIKE_PAGE_SIZE = 128;
export const SPIKE_CACHE_PAGES = 4;
export const SPIKE_COLUMNS = ['Row', 'Exact int64', 'Name', 'Unicode', 'Literal text', 'BLOB placeholder'] as const;

export interface SpikePageRequest { type: 'spikePageRequest'; requestId: number; offset: number; }
export interface SpikePage { type: 'spikePage'; requestId: number; offset: number; rows: string[][]; }
export interface SpikeStatus {
  type: 'spikeStatus'; editorReady: boolean; renderedRows: number;
  cachedRows: number; firstRow: number; requestInFlight: boolean;
}
export type WebviewToHostMessage = { type: 'ready' } | SpikePageRequest | SpikeStatus | BrowserRequest | BrowserStatus;
export type HostToWebviewMessage = { type: 'error'; message: string; context: string }
  | { type: 'spikeInit'; rowCount: number } | SpikePage
  // Integration-only no-op for the SQLite editor. Delivery checks
  // VS Code's outer webview transport readiness, not content rendering.
  | { type: 'sqliteEditorProbe' } | BrowserResponse | BrowserExercise;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWebviewMessage(value: unknown): value is WebviewToHostMessage {
  if (!isRecord(value)) { return false; }
  if (isBrowserRequest(value) || isBrowserStatus(value)) { return true; }
  if (value['type'] === 'ready') { return true; }
  if (value['type'] === 'spikePageRequest') { return pageAddress(value); }
  return value['type'] === 'spikeStatus' && typeof value['editorReady'] === 'boolean'
    && typeof value['requestInFlight'] === 'boolean'
    && integer(value['renderedRows'], 0, SPIKE_PAGE_SIZE)
    && integer(value['cachedRows'], 0, SPIKE_PAGE_SIZE * SPIKE_CACHE_PAGES)
    && integer(value['firstRow'], 0, SPIKE_ROW_COUNT - 1);
}

export function isHostMessage(value: unknown): value is HostToWebviewMessage {
  if (!isRecord(value)) { return false; }
  if (isBrowserResponse(value) || isBrowserExercise(value)) { return true; }
  if (value['type'] === 'sqliteEditorProbe') { return true; }
  if (value['type'] === 'error') {
    return typeof value['message'] === 'string' && typeof value['context'] === 'string';
  }
  if (value['type'] === 'spikeInit') { return value['rowCount'] === SPIKE_ROW_COUNT; }
  if (value['type'] !== 'spikePage' || !pageAddress(value) || !Array.isArray(value['rows'])) { return false; }
  const offset = value['offset'];
  return typeof offset === 'number'
    && value['rows'].length === Math.min(SPIKE_PAGE_SIZE, SPIKE_ROW_COUNT - offset)
    // Materialize holes: Array.every skips missing rows/cells in sparse arrays.
    && Array.from(value['rows']).every((row: unknown) => Array.isArray(row) && row.length === SPIKE_COLUMNS.length
      && Array.from(row).every((cell: unknown) => typeof cell === 'string' && cell.length <= 2048));
}

export const BROWSER_PAGE_SIZE = 100;
export interface BrowserObject { name: string; kind: 'table' | 'view'; }
export type BrowserRequest =
  | { type: 'browserList'; requestId: number; offset: number }
  | { type: 'browserPage'; requestId: number; table: string; offset: number; limit: number }
  | { type: 'browserCount'; requestId: number; table: string }
  | { type: 'browserCancel'; requestId: number };
export type BrowserResponse =
  | { type: 'browserTables'; requestId: number; offset: number; objects: BrowserObject[]; hasMore: boolean }
  | { type: 'browserRows'; requestId: number; table: string; offset: number; limit: number; page: import('./engine/engine').EnginePage }
  | { type: 'browserCounted'; requestId: number; table: string; count: string }
  | { type: 'browserCancelled'; requestId: number }
  | { type: 'browserError'; requestId: number; message: string };
/** Bounded DOM summaries for local integration tests; long contents are length-only. */
export interface BrowserStatus {
  type: 'browserStatus'; revision: number; table: string | null; offset: number;
  cachedRows: number; renderedRows: number; renderedColumns: number; columns: number;
  hasMore: boolean; count: string | null; busy: boolean; message: string;
  firstRow: { text: string | null; length: number; label: string | null }[];
}
/** Local host integration can drive the same controls as a user. No SQL or file access. */
export interface BrowserExercise {
  type: 'browserExercise'; action: 'next' | 'previous' | 'count' | 'cancel' | 'listNext' | 'listPrevious' | 'select' | 'size' | 'lastCell'; value?: string;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4 * 1024 * 1024 && !value.includes('\0');
}
export function isBrowserRequest(value: unknown): value is BrowserRequest {
  if (!isRecord(value) || !integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)) { return false; }
  switch (value['type']) {
    case 'browserCancel': return true;
    case 'browserList': return integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    case 'browserCount': return identifier(value['table']);
    case 'browserPage': return identifier(value['table']) && integer(value['limit'], 1, BROWSER_PAGE_SIZE)
      && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    default: return false;
  }
}
export function isBrowserResponse(value: unknown): value is BrowserResponse {
  if (!isRecord(value) || !integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)) { return false; }
  switch (value['type']) {
    case 'browserCancelled': return true;
    case 'browserError': return typeof value['message'] === 'string';
    case 'browserCounted': return identifier(value['table']) && decimal(value['count']);
    case 'browserTables': return integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE)
      && typeof value['hasMore'] === 'boolean' && Array.isArray(value['objects']) && value['objects'].length <= BROWSER_PAGE_SIZE
      && Array.from(value['objects']).every((object: unknown) => isRecord(object) && identifier(object['name']) && ['table', 'view'].includes(String(object['kind'])));
    case 'browserRows': {
      const page = value['page'];
      if (!identifier(value['table']) || !integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE)
        || !integer(value['limit'], 1, BROWSER_PAGE_SIZE) || !isRecord(page) || !Array.isArray(page['columns']) || !Array.isArray(page['rows'])
        || page['rows'].length > value['limit'] || typeof page['hasMore'] !== 'boolean') { return false; }
      const columns = page['columns'];
      let size = 0;
      const cell = (text: unknown): boolean => {
        if (text === null) { return true; }
        if (typeof text !== 'string') { return false; }
        size += text.length;
        return size <= 4 * 1024 * 1024;
      };
      return Array.from(columns).every((name: unknown) => typeof name === 'string' && cell(name))
        && Array.from(page['rows']).every((row: unknown) => Array.isArray(row) && row.length === columns.length && Array.from(row).every(cell));
    }
    default: return false;
  }
}
function decimal(value: unknown): value is string { return typeof value === 'string' && /^(0|[1-9]\d{0,18})$/u.test(value); }
export function isBrowserStatus(value: unknown): value is BrowserStatus {
  return isRecord(value) && value['type'] === 'browserStatus' && integer(value['revision'], 1, Number.MAX_SAFE_INTEGER)
    && (value['table'] === null || identifier(value['table'])) && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER)
    && integer(value['cachedRows'], 0, BROWSER_PAGE_SIZE) && integer(value['renderedRows'], 0, BROWSER_PAGE_SIZE)
    && integer(value['renderedColumns'], 0, 1000) && integer(value['columns'], 0, Number.MAX_SAFE_INTEGER)
    && typeof value['hasMore'] === 'boolean' && (value['count'] === null || decimal(value['count']))
    && typeof value['busy'] === 'boolean' && typeof value['message'] === 'string'
    && Array.isArray(value['firstRow']) && value['firstRow'].length <= 12 && Array.from(value['firstRow']).every((cell: unknown) =>
      isRecord(cell) && (cell['text'] === null || typeof cell['text'] === 'string' && cell['text'].length <= 128)
      && integer(cell['length'], 0, 4 * 1024 * 1024) && (cell['label'] === null || typeof cell['label'] === 'string'));
}
export function isBrowserExercise(value: unknown): value is BrowserExercise {
  return isRecord(value) && value['type'] === 'browserExercise'
    && ['next', 'previous', 'count', 'cancel', 'listNext', 'listPrevious', 'select', 'size', 'lastCell'].includes(String(value['action']))
    && (value['value'] === undefined || typeof value['value'] === 'string');
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function pageAddress(value: Record<string, unknown>): boolean {
  return integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)
    && integer(value['offset'], 0, SPIKE_ROW_COUNT - 1) && value['offset'] % SPIKE_PAGE_SIZE === 0;
}

// Production helper/worker messages. The script-free T-009 status panel does
// not exchange webview messages; future editor messages stay in this file too.
export interface DatabaseWorkerOptions { path: string; directory: string; forceFallback: boolean; }
export interface DatabaseQuery {
  type: 'query'; id: number; sql: string;
  parameters: import('./engine/engine').Parameter[];
  page: import('./engine/engine').PageAddress;
}
export type DatabaseMetadata = {
  type: 'metadata'; id: number; table: string; page: import('./engine/engine').PageAddress;
} & ({ kind: 'columns' } | { kind: 'indexes' } | { kind: 'indexColumns'; index: string });
export type DatabaseOperation = DatabaseQuery | DatabaseMetadata;
export type DatabaseWorkerRequest = DatabaseOperation | { type: 'consent'; approved: boolean };
export type DatabaseHelperRequest =
  | { type: 'open'; workerPath: string; options: DatabaseWorkerOptions }
  | { type: 'request'; value: DatabaseWorkerRequest };
export type DatabaseResponse =
  | { type: 'mode'; value: import('./engine/engine').EngineMode }
  | { type: 'opened'; value: import('./engine/engine').EngineOpened }
  | { type: 'failed'; message: string }
  | { type: 'started'; id: number }
  | { type: 'result'; id: number; value: import('./engine/engine').EnginePage }
  | { type: 'queryFailed'; id: number; message: string };
