import type { EnginePage } from '../src/engine/engine';

/** Successful query context only. No result rows or failed SQL are retained here. */
export class QueryView {
  sql: string | null = null;
  count: string | null = null;
  summary = '';

  commit(sql: string, offset: number, page: EnginePage, ms: number): void {
    this.sql = sql;
    this.count = page.hasMore ? null : String(offset + page.rows.length);
    const range = page.rows.length === 0 ? 'No rows on this page.'
      : `Showing rows ${String(offset + 1)}–${String(offset + page.rows.length)}${page.hasMore ? ' · more rows available' : ''}`;
    this.summary = `${range} · ${this.count === null ? 'Total rows: not yet known' : `Total rows: ${this.count}`} · Page execution time: ${ms.toFixed(1)} ms`;
  }

  reset(): void { this.sql = null; this.count = null; this.summary = ''; }
}
