import type { Engine } from '../engine/engine';
import { quoteIdentifier } from '../engine/read-engine';
import { BROWSER_PAGE_SIZE, isBrowserRequest, type BrowserObject, type BrowserRequest, type BrowserResponse } from '../protocol';
import type { ExportRunner } from './export-service';

interface Pending { request: BrowserRequest; send: (message: BrowserResponse) => void; resolve: () => void; }

/** One worker operation and at most one superseding request. Never cache rows here. */
export class SqliteBrowser {
  private disposed = false;
  private lastId = 0;
  private queued: Pending | undefined;
  private running = false;
  private recovering = false;
  private successfulSql: string | undefined;
  private exporter: ExportRunner | undefined;
  private exportSaving = false;
  private exportRunning = false;
  private committedCancel: { requestId: number; send: (message: BrowserResponse) => void; resolve: () => void } | undefined;
  private saveOutcome: BrowserResponse | undefined;

  constructor(private readonly engine: Engine) {}
  setExporter(exporter: ExportRunner): void { this.exporter = exporter; }

  handle(request: BrowserRequest, send: (message: BrowserResponse) => void): Promise<void> {
    if (this.disposed || !isBrowserRequest(request) || request.requestId <= this.lastId) { return Promise.resolve(); }
    if (request.type === 'browserCancel' && (this.exportSaving || this.saveOutcome?.requestId === this.lastId)) {
      this.lastId = request.requestId;
      if (this.saveOutcome !== undefined) {
        const outcome = { ...this.saveOutcome, requestId: request.requestId }; this.saveOutcome = outcome; send(outcome); return Promise.resolve();
      }
      this.committedCancel?.resolve();
      return new Promise((resolve) => { this.committedCancel = { requestId: request.requestId, send, resolve }; });
    }
    this.saveOutcome = undefined;
    this.lastId = request.requestId;
    this.queued?.resolve(); this.queued = undefined;
    if (request.type === 'browserCancel') { return this.cancel(request.requestId, send); }
    return new Promise((resolve) => {
      this.queued = { request, send, resolve };
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.running || this.recovering || this.disposed) { return; }
    this.running = true;
    try {
      while (this.queued !== undefined && !this.disposed && !this.recovering) {
        const pending = this.queued; this.queued = undefined;
        try {
          const result = await this.execute(pending.request, pending.send);
          this.deliver(pending, result);
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : 'The database operation failed.';
          this.deliver(pending, { type: 'browserError', requestId: pending.request.requestId,
            message: `${detail} Retry with a smaller page if needed, or reopen the file to recover.` });
        } finally { pending.resolve(); }
      }
    } finally { this.running = false; }
  }

  private deliver(pending: Pending, result: BrowserResponse): void {
    if (pending.request.type === 'browserExport') {
      if (result.type === 'browserExportDone' && result.report !== undefined) { this.saveOutcome = result; }
      const cancellation = this.committedCancel; this.committedCancel = undefined;
      if (cancellation !== undefined) {
        const outcome = { ...result, requestId: cancellation.requestId }; this.saveOutcome = outcome;
        if (!this.disposed && cancellation.requestId === this.lastId) { cancellation.send(outcome); }
        cancellation.resolve(); return;
      }
    }
    if (!this.disposed && pending.request.requestId === this.lastId) { pending.send(result); }
  }

  private async execute(request: BrowserRequest, send: (message: BrowserResponse) => void): Promise<BrowserResponse> {
    const requestId = request.requestId;
    switch (request.type) {
      case 'browserExport': {
        if (this.successfulSql === undefined || this.exporter === undefined) { throw new Error('Run a successful SQL query before exporting its results.'); }
        this.exportRunning = true;
        try {
          const report = await this.exporter.run(this.successfulSql, request.format, (progress) => {
            if (!this.disposed && requestId === this.lastId) {
              this.exportSaving = progress.phase === 'saving'; send({ type: 'browserExportProgress', requestId, ...progress });
            }
          });
          return { type: 'browserExportDone', requestId, ...(report === undefined ? {} : { report }) };
        } finally { this.exportSaving = false; this.exportRunning = false; }
      }
      case 'browserQuery': {
        const started = performance.now();
        const page = await this.engine.query(request.sql, [], { offset: request.offset, limit: request.limit }, () => {
          if (!this.disposed && requestId === this.lastId) { send({ type: 'browserQueryStarted', requestId }); }
        });
        if (!this.disposed && requestId === this.lastId) { this.successfulSql = request.sql; }
        return { type: 'browserQueryRows', requestId, offset: request.offset, limit: request.limit,
          ms: performance.now() - started, page };
      }
      case 'browserList': {
        this.successfulSql = undefined;
        // The browser needs names/kinds only. Large CREATE statements belong to
        // schema inspection and must not consume a table-list page's byte budget.
        const page = await this.engine.query("SELECT type, name FROM main.sqlite_schema WHERE type IN ('table', 'view') AND name NOT GLOB 'sqlite_*' ORDER BY name", [], { offset: request.offset, limit: BROWSER_PAGE_SIZE });
        const objects = page.rows.map((row): BrowserObject => {
          const kind = row[0]; const name = row[1];
          if ((kind !== 'table' && kind !== 'view') || typeof name !== 'string') { throw new Error('The database returned invalid table metadata.'); }
          return { name, kind };
        });
        return { type: 'browserTables', requestId, offset: request.offset, objects, hasMore: page.hasMore };
      }
      case 'browserPage': {
        const address = { offset: request.offset, limit: request.limit };
        const page = request.grid === undefined ? await this.engine.page(request.table, address)
          : await this.engine.grid(request.table, request.grid, address);
        if (!this.disposed && requestId === this.lastId && page.sortWarning === undefined) { this.successfulSql = undefined; }
        return page.sortWarning === undefined
          ? { type: 'browserRows', requestId, table: request.table, offset: request.offset, limit: request.limit, page }
          : { type: 'browserSortWarning', requestId, table: request.table, message: page.sortWarning };
      }
      case 'browserCount': {
        const page = request.grid === undefined ? await this.engine.query(`SELECT COUNT(*) FROM ${quoteIdentifier(request.table)}`, [], { limit: 1 })
          : await this.engine.grid(request.table, request.grid, { limit: 1 }, 'count');
        const count = page.rows[0]?.[0];
        if (typeof count !== 'string' || !/^(0|[1-9]\d{0,18})$/u.test(count)) { throw new Error('The row count was not an exact nonnegative integer.'); }
        return { type: 'browserCounted', requestId, table: request.table, count };
      }
      case 'browserCancel': return { type: 'browserCancelled', requestId };
    }
  }

  private async cancel(requestId: number, send: (message: BrowserResponse) => void): Promise<void> {
    this.recovering = true;
    const cancellingExport = this.exportRunning;
    this.exporter?.abort();
    try {
      await this.engine.cancel();
      if (cancellingExport) { await this.exporter?.settled(); }
      if (!this.disposed && requestId === this.lastId) { send({ type: 'browserCancelled', requestId }); }
    } catch (error: unknown) {
      if (!this.disposed && requestId === this.lastId) { send({ type: 'browserError', requestId, message: error instanceof Error && error.message.startsWith('Export temporary')
        ? error.message : 'The database could not recover after cancellation. Close and reopen the file.' }); }
    } finally {
      this.recovering = false;
      void this.drain();
    }
  }

  dispose(): void {
    this.disposed = true; this.exporter?.abort(); this.queued?.resolve(); this.queued = undefined;
    this.committedCancel?.resolve(); this.committedCancel = undefined;
  }
  async finishExportCleanup(): Promise<void> { await this.exporter?.settled(); }
}
