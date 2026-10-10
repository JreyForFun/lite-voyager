import type { Engine } from '../engine/engine';
import { quoteIdentifier } from '../engine/read-engine';
import { BROWSER_PAGE_SIZE, isBrowserRequest, type BrowserObject, type BrowserRequest, type BrowserResponse } from '../protocol';

interface Pending { request: BrowserRequest; send: (message: BrowserResponse) => void; resolve: () => void; }

/** One worker operation and at most one superseding request. Never cache rows here. */
export class SqliteBrowser {
  private disposed = false;
  private lastId = 0;
  private queued: Pending | undefined;
  private running = false;
  private recovering = false;

  constructor(private readonly engine: Engine) {}

  handle(request: BrowserRequest, send: (message: BrowserResponse) => void): Promise<void> {
    if (this.disposed || !isBrowserRequest(request) || request.requestId <= this.lastId) { return Promise.resolve(); }
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
          const result = await this.execute(pending.request);
          if (!this.disposed && pending.request.requestId === this.lastId) { pending.send(result); }
        } catch (error: unknown) {
          if (!this.disposed && pending.request.requestId === this.lastId) {
            const detail = error instanceof Error ? error.message : 'The database operation failed.';
            pending.send({ type: 'browserError', requestId: pending.request.requestId,
              message: `${detail} Retry with a smaller page if needed, or reopen the file to recover.` });
          }
        } finally { pending.resolve(); }
      }
    } finally { this.running = false; }
  }

  private async execute(request: BrowserRequest): Promise<BrowserResponse> {
    const requestId = request.requestId;
    switch (request.type) {
      case 'browserList': {
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
      case 'browserPage': return { type: 'browserRows', requestId, table: request.table, offset: request.offset, limit: request.limit,
        page: await this.engine.page(request.table, { offset: request.offset, limit: request.limit }) };
      case 'browserCount': {
        const page = await this.engine.query(`SELECT COUNT(*) FROM ${quoteIdentifier(request.table)}`, [], { limit: 1 });
        const count = page.rows[0]?.[0];
        if (typeof count !== 'string' || !/^(0|[1-9]\d{0,18})$/u.test(count)) { throw new Error('The row count was not an exact nonnegative integer.'); }
        return { type: 'browserCounted', requestId, table: request.table, count };
      }
      case 'browserCancel': return { type: 'browserCancelled', requestId };
    }
  }

  private async cancel(requestId: number, send: (message: BrowserResponse) => void): Promise<void> {
    this.recovering = true;
    try {
      await this.engine.cancel();
      if (!this.disposed && requestId === this.lastId) { send({ type: 'browserCancelled', requestId }); }
    } catch {
      if (!this.disposed && requestId === this.lastId) { send({ type: 'browserError', requestId, message: 'The database could not recover after cancellation. Close and reopen the file.' }); }
    } finally {
      this.recovering = false;
      void this.drain();
    }
  }

  dispose(): void { this.disposed = true; this.queued?.resolve(); this.queued = undefined; }
}
