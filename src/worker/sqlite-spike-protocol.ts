export type SpikeParameter = string | number | null | Uint8Array;
export type SpikeCell = string | null;

export interface SpikeOpened {
  engine: 'node:sqlite' | 'sql.js';
  threadId: number;
  processId: number;
  node: string;
  sqlite: string;
  memoryLimited: boolean;
  notice: string;
  trustedSchemaOff: boolean;
  extensionLoadingDisabled: boolean;
}

export interface SpikeResult {
  columns: string[];
  rows: SpikeCell[][];
  hasMore: boolean;
}

export interface SpikeWorkerOptions {
  path: string;
  fallbackDirectory: string;
  simulateUnavailable: boolean;
}

export interface SpikeRequest {
  id: number;
  sql: string;
  parameters: SpikeParameter[];
}

export type SpikeHelperRequest =
  | { type: 'open'; workerPath: string; options: SpikeWorkerOptions }
  | { type: 'query'; value: SpikeRequest };

export type SpikeResponse =
  | { type: 'opened'; value: SpikeOpened }
  | { type: 'failed'; message: string }
  | { type: 'started'; id: number }
  | { type: 'result'; id: number; value: SpikeResult }
  | { type: 'queryFailed'; id: number; message: string };
