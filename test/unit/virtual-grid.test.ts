import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { VirtualGrid } from '../../webview/virtual-grid';
import { physicalOffset } from '../../webview/grid-window';
import { createSpikePage } from '../../src/webview-spike';
import type { SpikePageRequest, SpikeStatus, WebviewToHostMessage } from '../../src/protocol';

// Layout dimensions are explicit stand-ins here. The integration test separately
// exercises real Chromium, CodeMirror, CSP and VS Code message delivery.
class Element extends EventTarget {
  readonly children: Element[] = [];
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  textContent = '';
  className = '';
  clientHeight = 560;
  scrollTop = 0;
  scrollLeft = 0;
  focused = false;
  append(child: Element): void { this.children.push(child); }
  replaceChildren(fragment?: Element): void {
    this.children.splice(0);
    if (fragment !== undefined) { this.children.push(...fragment.children); }
  }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  querySelector(selector: string): Element | null { return elements.get(selector.slice(1)) ?? null; }
  focus(): void { this.focused = true; }
}
const elements = new Map<string, Element>();
let frames: Map<number, FrameRequestCallback>;
let resize: () => void;
let grid: VirtualGrid;
let requests: SpikePageRequest[];
let statuses: SpikeStatus[];
function element(id: string): Element {
  const found = elements.get(id);
  if (found === undefined) { throw new Error(`Missing test element ${id}`); }
  return found;
}
function flush(): void {
  const pending = [...frames.values()]; frames.clear();
  for (const callback of pending) { callback(0); }
}
function settle(): void {
  for (let step = 0; step < 8; step++) {
    flush();
    const request = requests.shift();
    if (request === undefined) { return; }
    grid.receive(createSpikePage(request));
  }
  throw new Error('Page delivery did not settle');
}
beforeEach(() => {
  vi.useFakeTimers();
  elements.clear(); frames = new Map(); requests = []; statuses = [];
  for (const id of ['grid', 'viewport', 'track', 'rows', 'grid-header', 'status']) { elements.set(id, new Element()); }
  let sequence = 0;
  vi.stubGlobal('document', { createElement: () => new Element(), createDocumentFragment: () => new Element() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe(): void { /* Explicit dimensions replace browser layout in these tests. */ }
    disconnect(): void { /* No native observer is allocated. */ }
  });
  const post = (message: WebviewToHostMessage): void => {
    if (message.type === 'spikePageRequest') { requests.push(message); }
    if (message.type === 'spikeStatus') { statuses.push(message); }
  };
  grid = new VirtualGrid(element('grid') as unknown as HTMLElement, element('status') as unknown as HTMLElement, post);
  grid.initialize(10_000_000);
});
afterEach(() => { grid.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('T-008: Given real grid rendering code, When pages arrive, Then row indices and literal text match and the DOM stays bounded', () => {
  settle();
  const first = element('rows').children[0];
  expect(first?.attributes.get('aria-rowindex')).toBe('2');
  expect(first?.children[1]?.textContent).toBe('9007199254740993');
  expect(first?.children[4]?.textContent).toBe('<script>alert("demo")</script>');
  expect(first?.children[4]?.children).toEqual([]);
  expect(element('rows').children).toHaveLength(26);
  expect(element('grid').attributes.get('aria-busy')).toBe('false');
  grid.jump(5_000_000); settle();
  expect(statuses.at(-1)?.firstRow).toBe(4_999_999);
  expect(element('rows').children).toHaveLength(32);
  expect(element('rows').children[6]?.children[0]?.textContent).toBe('5000000');
});

test('T-008: Given wheel keyboard and native scrollbar input, When navigating and resizing, Then precise rows and the last row remain reachable', () => {
  settle();
  element('viewport').dispatchEvent(Object.assign(new Event('wheel', { cancelable: true }),
    { ctrlKey: false, shiftKey: false, deltaMode: 0, deltaY: 28, deltaX: 0 }));
  settle();
  expect(statuses.at(-1)?.firstRow).toBe(1);
  element('grid').dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'End' }));
  settle();
  expect(element('rows').children.at(-1)?.children[0]?.textContent).toBe('10000000');
  element('viewport').scrollTop = physicalOffset(10_000_000, 2_800_000, 560);
  element('viewport').dispatchEvent(new Event('scroll')); settle();
  expect(statuses.at(-1)?.firstRow).toBe(100_000);
  element('viewport').clientHeight = 280; resize(); settle();
  expect(statuses.at(-1)?.firstRow).toBe(100_000);
  expect(element('rows').children).toHaveLength(22);
});

test('T-008: Given a viewport change during a request, When the old page arrives, Then only the latest viewport is rendered', () => {
  flush();
  const old = requests.shift();
  expect(old).toBeDefined();
  grid.jump(8_000_000); flush();
  expect(requests).toHaveLength(0);
  if (old === undefined) { throw new Error('Missing initial request'); }
  grid.receive(createSpikePage(old)); settle();
  expect(statuses.at(-1)?.firstRow).toBe(7_999_999);
  expect(element('rows').children[6]?.children[0]?.textContent).toBe('8000000');
  expect(statuses.every((status) => status.cachedRows <= 512)).toBe(true);
});

test('T-008: Given a lost page, When its deadline expires, Then a visible error appears and disposal removes pending work', () => {
  flush();
  expect(element('status').textContent).toContain('Loading');
  vi.advanceTimersByTime(10000);
  expect(element('status').textContent).toContain('Rows did not arrive');
  grid.dispose();
  element('grid').dispatchEvent(Object.assign(new Event('keydown'), { key: 'End' }));
  expect(frames.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  expect(element('rows').children).toHaveLength(0);
});
