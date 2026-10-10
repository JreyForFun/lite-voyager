export const FALLBACK_PROMPT_BYTES = 200_000_000;
export const MAX_PAGE_ROWS = 1000;
export const MAX_PAGE_BYTES = 4 * 1024 * 1024;

export type EngineName = 'node:sqlite' | 'sql.js';
export type Parameter = string | number | null | Uint8Array;
export type Cell = string | null;
export interface PageAddress { offset?: number; limit?: number; }
export interface EnginePage { columns: string[]; rows: Cell[][]; hasMore: boolean; }
export interface EngineMode {
  engine: EngineName;
  memoryLimited: boolean;
  bytes: string;
  needsConsent: boolean;
  notice: string;
}
export interface EngineOpened extends EngineMode { threadId: number; processId: number; sqlite: string; }
export interface OpenOptions {
  onMode?: (mode: EngineMode) => void;
  confirmLargeFile?: (mode: EngineMode) => Promise<boolean>;
}

/** All callers use the supervised helper/worker client, never a synchronous backend. */
export interface Engine {
  open(path: string, options?: OpenOptions): Promise<EngineOpened>;
  schema(page?: PageAddress): Promise<EnginePage>;
  /** cid, name, type, notNull, defaultValue, primaryKey, hidden; ordered by cid. */
  columns(table: string, page?: PageAddress): Promise<EnginePage>;
  /** name, unique, origin, partial, sql; ordered by name, including implicit indexes. */
  indexes(table: string, page?: PageAddress): Promise<EnginePage>;
  /** seqno, cid, name, desc, coll, key; includes expression and auxiliary markers. */
  indexColumns(table: string, index: string, page?: PageAddress): Promise<EnginePage>;
  page(table: string, page?: PageAddress): Promise<EnginePage>;
  query(sql: string, parameters?: Parameter[], page?: PageAddress, started?: () => void): Promise<EnginePage>;
  /** Interrupt execution, confirm helper exit, and reopen a previously opened file. */
  cancel(): Promise<void>;
  close(): Promise<void>;
}

export interface Cursor { columns: string[]; rows: Iterable<unknown[]>; close(): void; }
/** Worker-only implementations of the common database operations. */
export interface ReadBackend {
  cursor(sql: string, parameters: Parameter[]): Cursor;
  close(): void;
}
