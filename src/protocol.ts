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
export type WebviewToHostMessage = { type: 'ready' } | SpikePageRequest | SpikeStatus | BrowserRequest | BrowserStatus | CellRequest;
export type HostToWebviewMessage = { type: 'error'; message: string; context: string }
  | { type: 'spikeInit'; rowCount: number } | SpikePage
  // Integration-only no-op for the SQLite editor. Delivery checks
  // VS Code's outer webview transport readiness, not content rendering.
  | { type: 'sqliteEditorProbe' } | BrowserResponse | BrowserExercise | CellResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWebviewMessage(value: unknown): value is WebviewToHostMessage {
  if (!isRecord(value)) { return false; }
  if (isBrowserRequest(value) || isBrowserStatus(value) || isCellRequest(value)) { return true; }
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
  if (isBrowserResponse(value) || isBrowserExercise(value) || isCellResponse(value)) { return true; }
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
export const MAX_SQL_LENGTH = 4 * 1024 * 1024;
export const MAX_FILTER_TEXT = 65_536;
export const MAX_CELL_OUTPUT = 16 * 1024 * 1024;
export interface CellDetail { text: string; kind: 'SQL NULL' | 'Empty string' | 'Stored text' | 'JSON'; notice: string; }
export type CellRequest = { contextId: string; id: number } & (
  | { type: 'cellDetails'; value: string | null }
  | { type: 'cellCopy'; rows: (string | null)[][] }
  | { type: 'cellCancel' });
export type CellResponse = { contextId: string; id: number } & (
  | { type: 'cellDetailsResult'; detail: CellDetail }
  | { type: 'cellCopyResult'; message: string }
  | { type: 'cellFailed'; operation: 'details' | 'copy' | 'cancel'; message: string });
export type CellWorkerResponse = Exclude<CellResponse, { type: 'cellCopyResult' }> | { type: 'cellCopyPrepared'; contextId: string; id: number; text: string };
export function isCellWorkerResponse(value: unknown): value is CellWorkerResponse {
  return isCellResponse(value) && value.type !== 'cellCopyResult' || isRecord(value) && cellAddress(value)
    && value['type'] === 'cellCopyPrepared' && typeof value['text'] === 'string' && value['text'].length <= MAX_CELL_OUTPUT;
}
export function isCellRequest(value: unknown): value is CellRequest {
  if (!isRecord(value) || !cellAddress(value)) { return false; }
  if (value['type'] === 'cellCancel') { return true; }
  if (value['type'] === 'cellDetails') { return value['value'] === null || typeof value['value'] === 'string' && value['value'].length <= MAX_SQL_LENGTH; }
  if (value['type'] !== 'cellCopy' || !Array.isArray(value['rows']) || value['rows'].length === 0 || value['rows'].length > BROWSER_PAGE_SIZE) { return false; }
  let size = 0; let width = -1;
  return Array.from(value['rows']).every((row: unknown) => {
    if (!Array.isArray(row) || row.length === 0 || (width !== -1 && row.length !== width)) { return false; }
    width = row.length;
    return Array.from(row).every((cell: unknown) => {
      size += 1 + (typeof cell === 'string' ? cell.length : 0);
      return size <= MAX_SQL_LENGTH && (cell === null || typeof cell === 'string');
    });
  });
}
function cellAddress(value: Record<string, unknown>): boolean {
  return typeof value['contextId'] === 'string' && /^[\da-f-]{36}$/u.test(value['contextId']) && integer(value['id'], 1, Number.MAX_SAFE_INTEGER);
}
export function isCellResponse(value: unknown): value is CellResponse {
  if (!isRecord(value) || !cellAddress(value)) { return false; }
  if (value['type'] === 'cellCopyResult') { return typeof value['message'] === 'string' && value['message'].length <= 2048; }
  if (value['type'] === 'cellFailed') { return ['details', 'copy', 'cancel'].includes(String(value['operation'])) && typeof value['message'] === 'string' && value['message'].length <= 2048; }
  const detail = value['detail'];
  return value['type'] === 'cellDetailsResult' && isRecord(detail) && typeof detail['text'] === 'string' && detail['text'].length <= MAX_CELL_OUTPUT
    && ['SQL NULL', 'Empty string', 'Stored text', 'JSON'].includes(String(detail['kind'])) && typeof detail['notice'] === 'string' && detail['notice'].length <= 2048;
}
export type GridFilter = { column: string } & ({ operator: 'contains'; value: string } | { operator: 'isNull' | 'isNotNull' });
export interface GridSort { column: string; direction: 'asc' | 'desc'; }
export interface GridOptions { sort?: GridSort; filters?: GridFilter[]; allowSlowSort?: boolean; }
export function isGridOptions(value: unknown): value is GridOptions {
  if (!isRecord(value) || (value['allowSlowSort'] !== undefined && typeof value['allowSlowSort'] !== 'boolean')) { return false; }
  const sort = value['sort'];
  if (sort !== undefined && (!isRecord(sort) || !identifier(sort['column']) || (sort['direction'] !== 'asc' && sort['direction'] !== 'desc'))) { return false; }
  const filters = value['filters'];
  if (filters === undefined) { return true; }
  if (!Array.isArray(filters) || filters.length > 1000) { return false; }
  const names = new Set<string>(); let text = 0;
  return Array.from(filters).every((filter: unknown) => {
    if (!isRecord(filter) || !identifier(filter['column']) || names.has(filter['column'])) { return false; }
    names.add(filter['column']);
    if (filter['operator'] === 'contains') {
      if (typeof filter['value'] !== 'string') { return false; }
      text += filter['value'].length;
      return text <= MAX_FILTER_TEXT;
    }
    return (filter['operator'] === 'isNull' || filter['operator'] === 'isNotNull') && filter['value'] === undefined;
  });
}
export interface BrowserObject { name: string; kind: 'table' | 'view'; }
export type BrowserRequest =
  | { type: 'browserQuery'; requestId: number; sql: string; offset: number; limit: number }
  | { type: 'browserList'; requestId: number; offset: number }
  | { type: 'browserPage'; requestId: number; table: string; offset: number; limit: number; grid?: GridOptions }
  | { type: 'browserCount'; requestId: number; table: string; grid?: GridOptions }
  | { type: 'browserCancel'; requestId: number };
export type BrowserResponse =
  | { type: 'browserQueryStarted'; requestId: number }
  | { type: 'browserQueryRows'; requestId: number; offset: number; limit: number; ms: number; page: import('./engine/engine').EnginePage }
  | { type: 'browserTables'; requestId: number; offset: number; objects: BrowserObject[]; hasMore: boolean }
  | { type: 'browserRows'; requestId: number; table: string; offset: number; limit: number; page: import('./engine/engine').EnginePage }
  | { type: 'browserCounted'; requestId: number; table: string; count: string }
  | { type: 'browserSortWarning'; requestId: number; table: string; message: string }
  | { type: 'browserCancelled'; requestId: number }
  | { type: 'browserError'; requestId: number; message: string };
/** Bounded DOM summaries for local integration tests; long contents are length-only. */
export interface BrowserStatus {
  type: 'browserStatus'; revision: number; table: string | null; offset: number;
  cachedRows: number; renderedRows: number; renderedColumns: number; columns: number;
  hasMore: boolean; count: string | null; busy: boolean; message: string;
  firstRow: { text: string | null; length: number; label: string | null; column?: number }[];
  query?: boolean; editorReady?: boolean; sqlLength?: number; selectionLength?: number; highlighted?: boolean; summary?: string;
  /** Local integration correlation only; neither value is persisted. */
  contextId?: string; exerciseId?: number;
  /** Opt-in local integration event-loop probe; no contents or persistent samples. */
  responsiveness?: { ticks: number; maxGapMs: number };
  cell?: { row: number | null; column: number | null; length: number; preview: string | null; kind: string; busy: boolean; message: string };
}
/** Local host integration drives the same editor/controls as a user; no file access. */
export interface BrowserExercise {
  type: 'browserExercise'; action: 'next' | 'previous' | 'count' | 'cancel' | 'listNext' | 'listPrevious' | 'select' | 'size' | 'lastCell' | 'sql' | 'run' | 'shortcut' | 'selection' | 'browse' | 'sort' | 'filter' | 'removeFilter' | 'clearGrid' | 'continueSort' | 'dismissSort'
    | 'cell' | 'extendCell' | 'copyCell' | 'copyRow' | 'copySelection' | 'cancelCell'
    | 'startResponsiveness' | 'stopResponsiveness' | 'pulseResponsiveness'; value?: string; exerciseId?: number;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4 * 1024 * 1024 && !value.includes('\0');
}
export function isBrowserRequest(value: unknown): value is BrowserRequest {
  if (!isRecord(value) || !integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)) { return false; }
  switch (value['type']) {
    case 'browserQuery': return identifier(value['sql']) && integer(value['limit'], 1, BROWSER_PAGE_SIZE)
      && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    case 'browserCancel': return true;
    case 'browserList': return integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    case 'browserCount': return identifier(value['table']) && (value['grid'] === undefined || isGridOptions(value['grid']));
    case 'browserPage': return identifier(value['table']) && integer(value['limit'], 1, BROWSER_PAGE_SIZE)
      && (value['grid'] === undefined || isGridOptions(value['grid']))
      && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    default: return false;
  }
}
export function isBrowserResponse(value: unknown): value is BrowserResponse {
  if (!isRecord(value) || !integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)) { return false; }
  switch (value['type']) {
    case 'browserQueryStarted':
    case 'browserCancelled': return true;
    case 'browserError': return typeof value['message'] === 'string';
    case 'browserSortWarning': return identifier(value['table']) && typeof value['message'] === 'string';
    case 'browserCounted': return identifier(value['table']) && decimal(value['count']);
    case 'browserTables': return integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE)
      && typeof value['hasMore'] === 'boolean' && Array.isArray(value['objects']) && value['objects'].length <= BROWSER_PAGE_SIZE
      && Array.from(value['objects']).every((object: unknown) => isRecord(object) && identifier(object['name']) && ['table', 'view'].includes(String(object['kind'])));
    case 'browserRows':
    case 'browserQueryRows': {
      const page = value['page'];
      const context = value['type'] === 'browserRows' ? identifier(value['table'])
        : typeof value['ms'] === 'number' && Number.isFinite(value['ms']) && value['ms'] >= 0;
      if (!context || !integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE)
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
    && (value['contextId'] === undefined || typeof value['contextId'] === 'string' && /^[\da-f-]{36}$/u.test(value['contextId']))
    && (value['exerciseId'] === undefined || integer(value['exerciseId'], 0, Number.MAX_SAFE_INTEGER))
    && (value['responsiveness'] === undefined || isRecord(value['responsiveness'])
      && integer(value['responsiveness']['ticks'], 0, Number.MAX_SAFE_INTEGER)
      && typeof value['responsiveness']['maxGapMs'] === 'number' && Number.isFinite(value['responsiveness']['maxGapMs']) && value['responsiveness']['maxGapMs'] >= 0)
    && (value['query'] === undefined || typeof value['query'] === 'boolean')
    && (value['editorReady'] === undefined || typeof value['editorReady'] === 'boolean')
    && (value['highlighted'] === undefined || typeof value['highlighted'] === 'boolean')
    && (value['summary'] === undefined || typeof value['summary'] === 'string' && value['summary'].length <= 2048)
    && (value['sqlLength'] === undefined || integer(value['sqlLength'], 0, Number.MAX_SAFE_INTEGER))
    && (value['selectionLength'] === undefined || integer(value['selectionLength'], 0, Number.MAX_SAFE_INTEGER))
    && (value['cell'] === undefined || isCellSummary(value['cell']))
    && Array.isArray(value['firstRow']) && value['firstRow'].length <= 12 && Array.from(value['firstRow']).every((cell: unknown) =>
      isRecord(cell) && (cell['text'] === null || typeof cell['text'] === 'string' && cell['text'].length <= 128)
      && integer(cell['length'], 0, 4 * 1024 * 1024) && (cell['label'] === null || typeof cell['label'] === 'string')
      && (cell['column'] === undefined || typeof value['columns'] === 'number' && integer(cell['column'], 0, value['columns'] - 1)));
}
function isCellSummary(value: unknown): boolean {
  return isRecord(value) && (value['row'] === null || integer(value['row'], 0, BROWSER_PAGE_SIZE - 1))
    && (value['column'] === null || integer(value['column'], 0, Number.MAX_SAFE_INTEGER)) && integer(value['length'], 0, MAX_CELL_OUTPUT)
    && (value['preview'] === null || typeof value['preview'] === 'string' && value['preview'].length <= 128)
    && typeof value['kind'] === 'string' && value['kind'].length <= 64 && typeof value['busy'] === 'boolean'
    && typeof value['message'] === 'string' && value['message'].length <= 2048;
}
export function isBrowserExercise(value: unknown): value is BrowserExercise {
  return isRecord(value) && value['type'] === 'browserExercise'
    && (value['exerciseId'] === undefined || integer(value['exerciseId'], 1, Number.MAX_SAFE_INTEGER))
    && ['next', 'previous', 'count', 'cancel', 'listNext', 'listPrevious', 'select', 'size', 'lastCell', 'sql', 'run', 'shortcut', 'selection', 'browse', 'sort', 'filter', 'removeFilter', 'clearGrid', 'continueSort', 'dismissSort', 'cell', 'extendCell', 'copyCell', 'copyRow', 'copySelection', 'cancelCell', 'startResponsiveness', 'stopResponsiveness', 'pulseResponsiveness'].includes(String(value['action']))
    && (value['value'] === undefined || typeof value['value'] === 'string' && value['value'].length <= MAX_SQL_LENGTH);
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
export interface DatabaseGrid {
  type: 'grid'; id: number; table: string; options: GridOptions;
  page: import('./engine/engine').PageAddress; kind: 'rows' | 'count';
}
export type DatabaseOperation = DatabaseQuery | DatabaseMetadata | DatabaseGrid;
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
