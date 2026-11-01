type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/**
 * Minimal DOM builder. Text is always inserted via text nodes (never innerHTML),
 * so data coming from OpenStreetMap or APIs cannot inject markup.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = String(value);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

/** Build a safe Wikipedia URL from an OSM `wikipedia` tag like "en:Registan". */
export function wikipediaUrl(tag: string | undefined): string | null {
  if (!tag) return null;
  const match = /^([a-z-]{2,12}):(.+)$/.exec(tag);
  if (!match) return null;
  return `https://${match[1]}.wikipedia.org/wiki/${encodeURIComponent(match[2].replace(/ /g, '_'))}`;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 4500);
}
