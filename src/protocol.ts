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
export type WebviewToHostMessage = { type: 'ready' } | SpikePageRequest | SpikeStatus;
export type HostToWebviewMessage = { type: 'error'; message: string; context: string }
  | { type: 'spikeInit'; rowCount: number } | SpikePage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isWebviewMessage(value: unknown): value is WebviewToHostMessage {
  if (!isRecord(value)) { return false; }
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
export type DatabaseWorkerRequest = DatabaseQuery | { type: 'consent'; approved: boolean };
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
