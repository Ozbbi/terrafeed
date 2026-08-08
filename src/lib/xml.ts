/** Namespace-agnostic XML helpers. Feeds disagree wildly about prefixes
 *  (`geo:lat`, `georss:point`, `dc:date`), so everything matches on local name. */

export function children(node: Element | Document, localName: string): Element[] {
  const wanted = localName.toLowerCase();
  const out: Element[] = [];
  const walk = (parent: Element | Document): void => {
    for (const child of Array.from(parent.children)) {
      const name = (child.localName || child.nodeName.split(':').pop() || '').toLowerCase();
      if (name === wanted) out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

export function firstChild(node: Element | Document, localName: string): Element | null {
  return children(node, localName)[0] ?? null;
}

export function text(node: Element | Document | null, localName: string): string {
  if (!node) return '';
  return firstChild(node, localName)?.textContent?.trim() ?? '';
}

export function attr(node: Element | null, name: string): string {
  return node?.getAttribute(name)?.trim() ?? '';
}

/** RSS `pubDate`, Atom `updated`, Dublin Core `date` — whichever exists. */
export function itemDate(item: Element): number {
  for (const key of ['pubDate', 'published', 'updated', 'date']) {
    const raw = text(item, key);
    if (!raw) continue;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function itemLink(item: Element): string {
  const direct = text(item, 'link');
  if (direct) return direct;
  const atom = firstChild(item, 'link');
  return attr(atom, 'href');
}

/**
 * Best-effort thumbnail for a feed item. Publishers disagree completely about
 * where the picture goes, so this checks the four conventions in rough order of
 * how reliably they carry a real image rather than a tracking pixel or logo.
 */
export function itemImage(item: Element): string | undefined {
  const usable = (url: string): boolean =>
    /^https?:\/\//i.test(url) && !/\.(svg|gif)(\?|$)/i.test(url);

  for (const node of children(item, 'content')) {
    const url = attr(node, 'url');
    const type = attr(node, 'type');
    const medium = attr(node, 'medium');
    if (url && usable(url) && (medium === 'image' || type.startsWith('image/') || !type)) {
      return url;
    }
  }

  for (const node of children(item, 'thumbnail')) {
    const url = attr(node, 'url');
    if (url && usable(url)) return url;
  }

  for (const node of children(item, 'enclosure')) {
    const url = attr(node, 'url');
    if (url && usable(url) && attr(node, 'type').startsWith('image/')) return url;
  }

  // Last resort: the first <img> inside the rendered description.
  for (const key of ['encoded', 'description', 'summary']) {
    const html = firstChild(item, key)?.textContent ?? '';
    const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
    if (match && usable(match[1])) return match[1];
  }

  return undefined;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
