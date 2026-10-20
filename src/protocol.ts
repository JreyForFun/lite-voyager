export const SPIKE_ROW_COUNT = 10_000_000;
export const SPIKE_PAGE_SIZE = 128;
export const SPIKE_CACHE_PAGES = 4;
export const SPIKE_COLUMNS = ['Row', 'Exact int64', 'Name', 'Unicode', 'Literal text', 'BLOB placeholder'] as const;

export const MAX_PREVIEW_ROWS = 100;
export const MAX_PREVIEW_COLUMNS = 1000;
export const MAX_PREVIEW_CHARACTERS = 2 * 1024 * 1024;
export const MAX_PREVIEW_RECORD_CHARACTERS = 4 * 1024 * 1024;
export type CsvDelimiter = ',' | '\t' | ';' | '|';
export interface CsvLoadOptions { delimiter?: CsvDelimiter; header?: boolean; allText?: boolean; }
export interface FilePreviewResult {
  columns: string[]; rows: (string | null)[][];
  bytesRead: string; totalBytes: string; reachedEnd: boolean; notice: string; threadId: number;
}
export interface CsvPreviewResult extends FilePreviewResult { delimiter: CsvDelimiter; header: boolean; }
export interface JsonPreviewResult extends FilePreviewResult { format: 'json' | 'jsonl'; }
export interface XlsxPreviewResult extends FilePreviewResult { format: 'xlsx'; sheetName: string; sheetCount: number; }
export type ImportPreviewResult = CsvPreviewResult | JsonPreviewResult | XlsxPreviewResult;
export type CsvPreviewRequest = { type: 'csvPreviewReady' | 'csvPreviewCancel'; contextId: string };
export interface CsvPreviewStatus { type: 'csvPreviewStatus'; contextId: string; renderedRows: number; renderedColumns: number; }
export type CsvPreviewState = { type: 'csvPreviewState'; contextId: string } & (
  | { phase: 'loading' | 'cancelled' | 'error'; message: string }
  | { phase: 'ready'; message: string; preview: ImportPreviewResult });

export type CsvImportRequest = { contextId: string } & (
  | { type: 'csvImportStart' | 'csvImportCancel' }
  | { type: 'csvImportRefresh'; options: CsvLoadOptions });
/** Local integration uses the same DOM controls; no file paths or worker access. */
export interface CsvImportExercise { type: 'csvImportExercise'; contextId: string; action: 'start' | 'refresh' | 'cancel'; options?: CsvLoadOptions; }
export function isCsvImportExercise(value: unknown): value is CsvImportExercise {
  return isRecord(value) && previewContext(value) && value['type'] === 'csvImportExercise'
    && typeof value['action'] === 'string' && ['start', 'refresh', 'cancel'].includes(value['action']) && (value['options'] === undefined || isCsvLoadOptions(value['options']));
}
export interface CsvImportState {
  type: 'csvImportState'; contextId: string;
  phase: 'loading' | 'ready' | 'importing' | 'opening' | 'opened' | 'error' | 'cancelled';
  message: string; options: CsvLoadOptions; preview?: ImportPreviewResult;
  progress?: import('./loaders/file-loader').Progress;
}
export function isCsvLoadOptions(value: unknown): value is CsvLoadOptions {
  return isRecord(value) && Object.keys(value).every((key) => ['delimiter', 'header', 'allText'].includes(key))
    && (value['delimiter'] === undefined || typeof value['delimiter'] === 'string' && [',', '\t', ';', '|'].includes(value['delimiter']))
    && (value['header'] === undefined || typeof value['header'] === 'boolean') && (value['allText'] === undefined || typeof value['allText'] === 'boolean');
}
export function isCsvImportRequest(value: unknown): value is CsvImportRequest {
  return isRecord(value) && previewContext(value) && (value['type'] === 'csvImportStart' || value['type'] === 'csvImportCancel'
    || value['type'] === 'csvImportRefresh' && isCsvLoadOptions(value['options']));
}
export function isCsvImportProgress(value: unknown): value is import('./loaders/file-loader').Progress {
  return isRecord(value) && ['bytes', 'totalBytes', 'rows'].every((key) => typeof value[key] === 'string' && /^(0|[1-9]\d{0,30})$/u.test(value[key]))
    && BigInt(value['bytes'] as string) <= BigInt(value['totalBytes'] as string)
    && (value['engine'] === 'node:sqlite' || value['engine'] === 'sql.js') && (value['phase'] === 'reading' || value['phase'] === 'publishing')
    && typeof value['notice'] === 'string' && value['notice'].length <= 4096
    && (value['processId'] === undefined || integer(value['processId'], 1, Number.MAX_SAFE_INTEGER));
}
export function isCsvImportState(value: unknown): value is CsvImportState {
  return isRecord(value) && previewContext(value) && value['type'] === 'csvImportState'
    && typeof value['phase'] === 'string' && ['loading', 'ready', 'importing', 'opening', 'opened', 'error', 'cancelled'].includes(value['phase'])
    && typeof value['message'] === 'string' && value['message'].length <= 4096 && isCsvLoadOptions(value['options'])
    && (value['preview'] === undefined || isImportPreviewResult(value['preview']))
    && (value['phase'] !== 'ready' || isImportPreviewResult(value['preview']))
    && (value['progress'] === undefined || isCsvImportProgress(value['progress']));
}

export function isCsvPreviewResult(value: unknown): value is CsvPreviewResult {
  return isRecord(value) && typeof value['delimiter'] === 'string' && [',', '\t', ';', '|'].includes(value['delimiter'])
    && typeof value['header'] === 'boolean' && isFilePreviewResult(value);
}
export function isJsonPreviewResult(value: unknown): value is JsonPreviewResult {
  return isRecord(value) && (value['format'] === 'json' || value['format'] === 'jsonl') && isFilePreviewResult(value, true);
}
export function isXlsxPreviewResult(value: unknown): value is XlsxPreviewResult {
  return isRecord(value) && value['format'] === 'xlsx' && typeof value['sheetName'] === 'string' && value['sheetName'].length > 0
    && value['sheetName'].length <= MAX_PREVIEW_CHARACTERS && integer(value['sheetCount'], 1, Number.MAX_SAFE_INTEGER) && isFilePreviewResult(value, true);
}
export function isImportPreviewResult(value: unknown): value is ImportPreviewResult { return isCsvPreviewResult(value) || isJsonPreviewResult(value) || isXlsxPreviewResult(value); }
function isFilePreviewResult(value: unknown, allowNul = false): value is FilePreviewResult {
  if (!isRecord(value) || !Array.isArray(value['columns']) || value['columns'].length > MAX_PREVIEW_COLUMNS
    || !Array.isArray(value['rows']) || value['rows'].length > MAX_PREVIEW_ROWS
    || typeof value['reachedEnd'] !== 'boolean' || typeof value['notice'] !== 'string' || value['notice'].length > 4096
    || !integer(value['threadId'], 1, Number.MAX_SAFE_INTEGER)
    || typeof value['bytesRead'] !== 'string' || !/^(0|[1-9]\d{0,30})$/u.test(value['bytesRead'])
    || typeof value['totalBytes'] !== 'string' || !/^(0|[1-9]\d{0,30})$/u.test(value['totalBytes'])
    || BigInt(value['bytesRead']) > BigInt(value['totalBytes'])) { return false; }
  let characters = 0;
  const columns = Array.from(value['columns']);
  if (!columns.every((column: unknown) => {
    if (typeof column !== 'string' || column === '' || column.includes('\0')) { return false; }
    characters += column.length; return characters <= MAX_PREVIEW_CHARACTERS;
  }) || (columns.length === 0 && value['rows'].length > 0)) { return false; }
  return Array.from(value['rows']).every((row: unknown) => Array.isArray(row) && row.length === columns.length
    && Array.from(row).every((cell: unknown) => {
      if (cell !== null && (typeof cell !== 'string' || !allowNul && cell.includes('\0'))) { return false; }
      characters += cell === null ? 1 : cell.length + 1;
      return characters <= MAX_PREVIEW_CHARACTERS;
    }));
}
function previewContext(value: Record<string, unknown>): boolean { return typeof value['contextId'] === 'string' && /^[a-f0-9]{32}$/u.test(value['contextId']); }
export function isCsvPreviewRequest(value: unknown): value is CsvPreviewRequest {
  return isRecord(value) && previewContext(value) && (value['type'] === 'csvPreviewReady' || value['type'] === 'csvPreviewCancel');
}
export function isCsvPreviewStatus(value: unknown): value is CsvPreviewStatus {
  return isRecord(value) && previewContext(value) && value['type'] === 'csvPreviewStatus'
    && integer(value['renderedRows'], 0, MAX_PREVIEW_ROWS) && integer(value['renderedColumns'], 0, MAX_PREVIEW_COLUMNS);
}
export function isCsvPreviewState(value: unknown): value is CsvPreviewState {
  return isRecord(value) && previewContext(value) && value['type'] === 'csvPreviewState'
    && typeof value['message'] === 'string' && value['message'].length <= 4096
    && typeof value['phase'] === 'string'
    && (value['phase'] === 'ready' ? isImportPreviewResult(value['preview']) : ['loading', 'cancelled', 'error'].includes(value['phase']));
}

export interface SpikePageRequest { type: 'spikePageRequest'; requestId: number; offset: number; }
export interface SpikePage { type: 'spikePage'; requestId: number; offset: number; rows: string[][]; }
export interface SpikeStatus {
  type: 'spikeStatus'; editorReady: boolean; renderedRows: number;
  cachedRows: number; firstRow: number; requestInFlight: boolean;
}
export type SqliteSaveRequest = { type: 'sqliteSave' | 'sqliteSaveCancel' | 'sqliteSaveReady'; contextId: string };
export interface SqliteSaveState {
  type: 'sqliteSaveState'; contextId: string; phase: 'idle' | 'choosing' | 'copying' | 'saving' | 'saved' | 'cancelled' | 'error';
  message: string; bytes: string; total: string;
}
export interface SqliteSaveDom { type: 'sqliteSaveDom'; contextId: string; phase: SqliteSaveState['phase']; saveDisabled: boolean; cancelDisabled: boolean; }
export interface SqliteSaveExercise { type: 'sqliteSaveExercise'; action: 'save' | 'cancel'; }
export function isSqliteSaveRequest(value: unknown): value is SqliteSaveRequest {
  return isRecord(value) && ['sqliteSave', 'sqliteSaveCancel', 'sqliteSaveReady'].includes(String(value['type']))
    && typeof value['contextId'] === 'string' && /^[a-f0-9]{32}$/u.test(value['contextId']);
}
function savePhase(value: unknown): boolean { return ['idle', 'choosing', 'copying', 'saving', 'saved', 'cancelled', 'error'].includes(String(value)); }
export function isSqliteSaveState(value: unknown): value is SqliteSaveState {
  return isRecord(value) && value['type'] === 'sqliteSaveState' && typeof value['contextId'] === 'string' && /^[a-f0-9]{32}$/u.test(value['contextId'])
    && savePhase(value['phase']) && typeof value['message'] === 'string' && value['message'].length <= 4096 && decimal(value['bytes']) && decimal(value['total']);
}
export function isSqliteSaveDom(value: unknown): value is SqliteSaveDom {
  return isRecord(value) && value['type'] === 'sqliteSaveDom' && typeof value['contextId'] === 'string' && /^[a-f0-9]{32}$/u.test(value['contextId'])
    && savePhase(value['phase']) && typeof value['saveDisabled'] === 'boolean' && typeof value['cancelDisabled'] === 'boolean';
}
export function isSqliteSaveExercise(value: unknown): value is SqliteSaveExercise {
  return isRecord(value) && value['type'] === 'sqliteSaveExercise' && (value['action'] === 'save' || value['action'] === 'cancel');
}
export type WebviewToHostMessage = { type: 'ready' } | SpikePageRequest | SpikeStatus | BrowserRequest | BrowserStatus | CellRequest | CsvPreviewRequest | CsvPreviewStatus | CsvImportRequest | SqliteSaveRequest | SqliteSaveDom;
export type HostToWebviewMessage = { type: 'error'; message: string; context: string }
  | { type: 'spikeInit'; rowCount: number } | SpikePage
  // Integration-only no-op for the SQLite editor. Delivery checks
  // VS Code's outer webview transport readiness, not content rendering.
  | { type: 'sqliteEditorProbe' } | BrowserResponse | BrowserExercise | CellResponse | CsvPreviewState | CsvImportState | CsvImportExercise | SqliteSaveState | SqliteSaveExercise;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWebviewMessage(value: unknown): value is WebviewToHostMessage {
  if (!isRecord(value)) { return false; }
  if (isBrowserRequest(value) || isBrowserStatus(value) || isCellRequest(value)) { return true; }
  if (isCsvPreviewRequest(value) || isCsvPreviewStatus(value)) { return true; }
  if (isCsvImportRequest(value)) { return true; }
  if (isSqliteSaveRequest(value) || isSqliteSaveDom(value)) { return true; }
  if (value['type'] === 'ready') { return true; }
  if (value['type'] === 'spikePageRequest') { return pageAddress(value); }
  return value['type'] === 'spikeStatus' && typeof value['editorReady'] === 'boolean'
    && typeof value['requestInFlight'] === 'boolean'
    && integer(value['renderedRows'], 0, SPIKE_PAGE_SIZE)
    && integer(value['cachedRows'], 0, SPIKE_PAGE_SIZE * SPIKE_CACHE_PAGES)
    && integer(value['firstRow'], 0, SPIKE_ROW_COUNT - 1);
}

export function isHostMessage(value: unknown): value is HostToWebviewMessage {
  if (isCsvPreviewState(value)) { return true; }
  if (isCsvImportState(value)) { return true; }
  if (isCsvImportExercise(value)) { return true; }
  if (isSqliteSaveState(value) || isSqliteSaveExercise(value)) { return true; }
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
export const MAX_COMPLETION_TEXT = 65536;
export interface CompletionSearch { prefix: string; tables: string[]; includeTables: boolean; useSelectedTable?: boolean; }
export interface SchemaSuggestion { name: string; kind: 'table' | 'view' | 'column'; table: string; }
export interface SchemaSuggestions { items: SchemaSuggestion[]; hasMore: boolean; }
export function isCompletionSearch(value: unknown): value is CompletionSearch {
  if (!isRecord(value) || typeof value['includeTables'] !== 'boolean' || !Array.isArray(value['tables']) || value['tables'].length > 16) { return false; }
  let size = 0;
  const name = (text: unknown): boolean => { if (typeof text !== 'string' || text.includes('\0')) { return false; } size += text.length; return size <= MAX_COMPLETION_TEXT; };
  return (value['useSelectedTable'] === undefined || typeof value['useSelectedTable'] === 'boolean') && name(value['prefix']) && Array.from(value['tables']).every(name);
}
function isSchemaSuggestions(value: Record<string, unknown>): boolean {
  if (typeof value['hasMore'] !== 'boolean' || !Array.isArray(value['items']) || value['items'].length > 100) { return false; }
  let size = 0;
  return Array.from(value['items']).every((item: unknown) => {
    if (!isRecord(item) || !identifier(item['name']) || !identifier(item['table']) || !['table', 'view', 'column'].includes(String(item['kind']))) { return false; }
    size += item['name'].length + item['table'].length;
    return size <= MAX_COMPLETION_TEXT;
  });
}
export type BrowserRequest =
  | ({ type: 'browserComplete'; requestId: number } & CompletionSearch)
  | { type: 'browserExport'; requestId: number; format: import('./engine/engine').ExportFormat }
  | { type: 'browserQuery'; requestId: number; sql: string; offset: number; limit: number }
  | { type: 'browserList'; requestId: number; offset: number }
  | { type: 'browserPage'; requestId: number; table: string; offset: number; limit: number; grid?: GridOptions }
  | { type: 'browserCount'; requestId: number; table: string; grid?: GridOptions }
  | { type: 'browserSchema'; requestId: number; table: string; kind: 'columns' | 'indexes' | 'indexColumns'; index?: string; offset: number; limit: number }
  | { type: 'browserCancel'; requestId: number };
export type BrowserResponse =
  | ({ type: 'browserCompletions'; requestId: number } & SchemaSuggestions)
  | ({ type: 'browserExportProgress'; requestId: number } & import('./engine/engine').ExportProgress)
  | { type: 'browserExportDone'; requestId: number; report?: import('./engine/engine').ExportReport }
  | { type: 'browserQueryStarted'; requestId: number }
  | { type: 'browserQueryRows'; requestId: number; offset: number; limit: number; ms: number; page: import('./engine/engine').EnginePage }
  | { type: 'browserTables'; requestId: number; offset: number; objects: BrowserObject[]; hasMore: boolean }
  | { type: 'browserRows'; requestId: number; table: string; offset: number; limit: number; page: import('./engine/engine').EnginePage }
  | { type: 'browserCounted'; requestId: number; table: string; count: string }
  | { type: 'browserSchemaRows'; requestId: number; table: string; kind: 'columns' | 'indexes' | 'indexColumns'; index?: string; offset: number; limit: number; page: import('./engine/engine').EnginePage }
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
  schema?: { table: string | null; kind: 'columns' | 'indexes' | 'indexColumns'; offset: number; rows: number; hasMore: boolean; preview: string; message: string };
  appearance?: { theme: string; foreground: string; background: string };
  completion?: { open: boolean; labels: string[]; selected: string | null; notice: string };
}
/** Local host integration drives the same editor/controls as a user; no file access. */
export interface BrowserExercise {
  type: 'browserExercise'; action: 'next' | 'previous' | 'count' | 'cancel' | 'listNext' | 'listPrevious' | 'select' | 'size' | 'lastCell' | 'sql' | 'run' | 'shortcut' | 'selection' | 'browse' | 'sort' | 'filter' | 'removeFilter' | 'clearGrid' | 'continueSort' | 'dismissSort'
    | 'cell' | 'extendCell' | 'copyCell' | 'copyRow' | 'copySelection' | 'cancelCell'
    | 'exportCsv' | 'exportJson' | 'completionKey'
    | 'schema' | 'schemaKind' | 'schemaNext' | 'schemaPrevious' | 'schemaSize' | 'schemaIndex' | 'appearance' | 'gridKey'
    | 'startResponsiveness' | 'stopResponsiveness' | 'pulseResponsiveness'; value?: string; exerciseId?: number;
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4 * 1024 * 1024 && !value.includes('\0');
}
export function isBrowserRequest(value: unknown): value is BrowserRequest {
  if (!isRecord(value) || !integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)) { return false; }
  switch (value['type']) {
    case 'browserComplete': return isCompletionSearch(value);
    case 'browserExport': return value['format'] === 'csv' || value['format'] === 'json';
    case 'browserQuery': return identifier(value['sql']) && value['sql'].length > 0 && integer(value['limit'], 1, BROWSER_PAGE_SIZE)
      && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    case 'browserCancel': return true;
    case 'browserList': return integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    case 'browserCount': return identifier(value['table']) && (value['grid'] === undefined || isGridOptions(value['grid']));
    case 'browserSchema': return identifier(value['table']) && ['columns', 'indexes', 'indexColumns'].includes(String(value['kind']))
      && (value['kind'] !== 'indexColumns' || identifier(value['index'])) && integer(value['limit'], 1, BROWSER_PAGE_SIZE)
      && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    case 'browserPage': return identifier(value['table']) && integer(value['limit'], 1, BROWSER_PAGE_SIZE)
      && (value['grid'] === undefined || isGridOptions(value['grid']))
      && integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE);
    default: return false;
  }
}
export function isBrowserResponse(value: unknown): value is BrowserResponse {
  if (!isRecord(value) || !integer(value['requestId'], 1, Number.MAX_SAFE_INTEGER)) { return false; }
  switch (value['type']) {
    case 'browserCompletions': return isSchemaSuggestions(value);
    case 'browserExportProgress': return (value['phase'] === 'writing' || value['phase'] === 'saving') && exportReport(value);
    case 'browserExportDone': return value['report'] === undefined || exportReport(value['report']);
    case 'browserQueryStarted':
    case 'browserCancelled': return true;
    case 'browserError': return typeof value['message'] === 'string';
    case 'browserSortWarning': return identifier(value['table']) && typeof value['message'] === 'string';
    case 'browserCounted': return identifier(value['table']) && decimal(value['count']);
    case 'browserTables': return integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE)
      && typeof value['hasMore'] === 'boolean' && Array.isArray(value['objects']) && value['objects'].length <= BROWSER_PAGE_SIZE
      && Array.from(value['objects']).every((object: unknown) => isRecord(object) && identifier(object['name']) && ['table', 'view'].includes(String(object['kind'])));
    case 'browserRows':
    case 'browserSchemaRows':
    case 'browserQueryRows': {
      const page = value['page'];
      const context = value['type'] === 'browserRows' ? identifier(value['table']) : value['type'] === 'browserSchemaRows'
        ? identifier(value['table']) && ['columns', 'indexes', 'indexColumns'].includes(String(value['kind'])) && (value['kind'] !== 'indexColumns' || identifier(value['index']))
        : typeof value['ms'] === 'number' && Number.isFinite(value['ms']) && value['ms'] >= 0;
      if (!context || !integer(value['offset'], 0, Number.MAX_SAFE_INTEGER - BROWSER_PAGE_SIZE)
        || !integer(value['limit'], 1, BROWSER_PAGE_SIZE) || !isRecord(page) || !Array.isArray(page['columns']) || !Array.isArray(page['rows'])
        || page['rows'].length > value['limit'] || typeof page['hasMore'] !== 'boolean'
        || (page['total'] !== undefined && !decimal(page['total']))) { return false; }
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
function exportReport(value: unknown): boolean { return isRecord(value) && decimal(value['rows']) && decimal(value['bytes']) && decimal(value['blobs']); }
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
    && (value['appearance'] === undefined || isAppearanceSummary(value['appearance']))
    && (value['completion'] === undefined || isRecord(value['completion']) && typeof value['completion']['open'] === 'boolean'
      && (value['completion']['selected'] === null || typeof value['completion']['selected'] === 'string' && value['completion']['selected'].length <= 128)
      && typeof value['completion']['notice'] === 'string' && value['completion']['notice'].length <= 2048
      && Array.isArray(value['completion']['labels']) && value['completion']['labels'].length <= 12
      && Array.from(value['completion']['labels']).every((label: unknown) => typeof label === 'string' && label.length <= 128))
    && (value['schema'] === undefined || isRecord(value['schema'])
      && (value['schema']['table'] === null || identifier(value['schema']['table']))
      && ['columns', 'indexes', 'indexColumns'].includes(String(value['schema']['kind']))
      && integer(value['schema']['offset'], 0, Number.MAX_SAFE_INTEGER) && integer(value['schema']['rows'], 0, BROWSER_PAGE_SIZE)
      && typeof value['schema']['hasMore'] === 'boolean' && typeof value['schema']['preview'] === 'string' && value['schema']['preview'].length <= 2048
      && typeof value['schema']['message'] === 'string' && value['schema']['message'].length <= 2048)
    && Array.isArray(value['firstRow']) && value['firstRow'].length <= 12 && Array.from(value['firstRow']).every((cell: unknown) =>
      isRecord(cell) && (cell['text'] === null || typeof cell['text'] === 'string' && cell['text'].length <= 128)
      && integer(cell['length'], 0, 4 * 1024 * 1024) && (cell['label'] === null || typeof cell['label'] === 'string')
      && (cell['column'] === undefined || typeof value['columns'] === 'number' && integer(cell['column'], 0, value['columns'] - 1)));
}
function isAppearanceSummary(value: unknown): boolean {
  return isRecord(value) && ['theme', 'foreground', 'background'].every((key) => typeof value[key] === 'string' && value[key].length <= 128);
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
    && ['next', 'previous', 'count', 'cancel', 'listNext', 'listPrevious', 'select', 'size', 'lastCell', 'sql', 'run', 'shortcut', 'selection', 'browse', 'sort', 'filter', 'removeFilter', 'clearGrid', 'continueSort', 'dismissSort', 'cell', 'extendCell', 'copyCell', 'copyRow', 'copySelection', 'cancelCell', 'exportCsv', 'exportJson', 'completionKey', 'schema', 'schemaKind', 'schemaNext', 'schemaPrevious', 'schemaSize', 'schemaIndex', 'appearance', 'gridKey', 'startResponsiveness', 'stopResponsiveness', 'pulseResponsiveness'].includes(String(value['action']))
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
export interface DatabaseExport {
  type: 'export'; id: number; sql: string; format: import('./engine/engine').ExportFormat; path: string;
}
export type DatabaseWorkerRequest = DatabaseOperation | DatabaseExport | { type: 'consent'; approved: boolean };
export type DatabaseHelperRequest =
  | { type: 'open'; workerPath: string; options: DatabaseWorkerOptions }
  | { type: 'request'; value: DatabaseWorkerRequest };
export type DatabaseResponse =
  | { type: 'mode'; value: import('./engine/engine').EngineMode }
  | { type: 'opened'; value: import('./engine/engine').EngineOpened }
  | { type: 'failed'; message: string }
  | { type: 'started'; id: number }
  | { type: 'exportProgress'; id: number; value: import('./engine/engine').ExportReport }
  | { type: 'exported'; id: number; value: import('./engine/engine').ExportReport }
  | { type: 'result'; id: number; value: import('./engine/engine').EnginePage }
  | { type: 'queryFailed'; id: number; message: string };
