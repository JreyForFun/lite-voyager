// Explicit layout stand-ins. Real Chromium/CSP/message flow is tested in the host.
export class BrowserElement extends EventTarget {
  readonly children: BrowserElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  textContent = '';
  className = '';
  title = '';
  tabIndex = -1;
  clientHeight = 280;
  clientWidth = 480;
  scrollTop = 0;
  scrollLeft = 0;
  value = '';
  disabled = false;
  hidden = false;
  focused = false;
  append(...children: BrowserElement[]): void { this.children.push(...children); }
  replaceChildren(...children: BrowserElement[]): void { this.children.splice(0, this.children.length, ...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  get firstElementChild(): BrowserElement | null { return this.children[0] ?? null; }
  focus(): void { this.focused = true; }
  querySelector(selector: string): BrowserElement | null { return this.elements.get(selector.slice(1)) ?? null; }
  readonly elements = new Map<string, BrowserElement>();
}

export function browserRoot(ids: string[]): BrowserElement {
  const root = new BrowserElement();
  for (const id of ids) { root.elements.set(id, new BrowserElement()); }
  return root;
}
