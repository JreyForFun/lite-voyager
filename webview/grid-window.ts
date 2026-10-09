import { SPIKE_CACHE_PAGES, SPIKE_PAGE_SIZE, type SpikePage, type SpikePageRequest } from '../src/protocol';

export const ROW_HEIGHT = 28;
const OVERSCAN = 6;
const MAX_TRACK_HEIGHT = 8_000_000;
function clamp(value: number, max: number): number { return Math.max(0, Math.min(value, Math.max(0, max))); }
export function trackHeight(count: number): number { return Math.min(MAX_TRACK_HEIGHT, count * ROW_HEIGHT); }
export function logicalOffset(count: number, physical: number, height: number): number {
  const extent = trackHeight(count) - height;
  return extent <= 0 ? 0 : clamp(physical, extent) / extent * Math.max(0, count * ROW_HEIGHT - height);
}
export function physicalOffset(count: number, logical: number, height: number): number {
  const extent = count * ROW_HEIGHT - height;
  return extent <= 0 ? 0 : clamp(logical, extent) / extent * Math.max(0, trackHeight(count) - height);
}
export function gridWindow(count: number, offset: number, height: number): { start: number; end: number } {
  const top = clamp(offset, count * ROW_HEIGHT - height);
  return { start: Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN),
    end: Math.min(count, Math.ceil((top + height) / ROW_HEIGHT) + OVERSCAN) };
}

export class GridPages {
  private readonly pages = new Map<number, string[][]>();
  private pending: SpikePageRequest | undefined;
  private sequence = 0;
  get inFlight(): boolean { return this.pending !== undefined; }
  get cachedRows(): number { return [...this.pages.values()].reduce((sum, rows) => sum + rows.length, 0); }
  row(index: number): string[] | undefined {
    const offset = Math.floor(index / SPIKE_PAGE_SIZE) * SPIKE_PAGE_SIZE;
    return this.pages.get(offset)?.[index - offset];
  }
  request(start: number, end: number): SpikePageRequest | undefined {
    if (this.pending !== undefined) { return undefined; }
    for (let offset = Math.floor(start / SPIKE_PAGE_SIZE) * SPIKE_PAGE_SIZE; offset < end; offset += SPIKE_PAGE_SIZE) {
      const cached = this.pages.get(offset);
      if (cached !== undefined) {
        this.pages.delete(offset);
        this.pages.set(offset, cached);
        continue;
      }
      this.pending = { type: 'spikePageRequest', requestId: ++this.sequence, offset };
      return this.pending;
    }
    return undefined;
  }
  accept(page: SpikePage): boolean {
    if (page.requestId !== this.pending?.requestId || page.offset !== this.pending.offset) { return false; }
    this.pending = undefined;
    this.pages.set(page.offset, page.rows);
    while (this.pages.size > SPIKE_CACHE_PAGES) {
      const oldest = this.pages.keys().next().value;
      if (oldest !== undefined) { this.pages.delete(oldest); }
    }
    return true;
  }
  clear(): void { this.pending = undefined; this.pages.clear(); }
}
