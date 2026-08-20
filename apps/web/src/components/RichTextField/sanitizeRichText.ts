/**
 * Allowlist sanitizer for note HTML.
 *
 * Note bodies round-trip through the API, so by the time they come back they are just a
 * string — anything could be in there. Rather than trusting it, reparse and keep only the
 * tags/attributes the Tiptap StarterKit schema can produce. Everything else (scripts,
 * event handlers, iframes, `javascript:` URLs) is dropped; disallowed elements are
 * unwrapped so their text survives.
 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'PRE',
  'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'SPAN', 'A',
]);

/** Per-tag attribute allowlist. Any attribute not listed here is removed. */
const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ['href', 'title'],
  OL: ['start'],
};

const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;

export function sanitizeRichTextHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // Server render: emit nothing rather than unchecked markup; the client pass fills it in.
    return '';
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Element) => {
    // Snapshot children: unwrapping mutates the live child list mid-iteration.
    for (const child of Array.from(node.children)) walk(child);

    if (!ALLOWED_TAGS.has(node.tagName)) {
      // Script/style content is markup, not prose — discard it instead of unwrapping.
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') node.remove();
      else node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    const allowed = ALLOWED_ATTRS[node.tagName] ?? [];
    for (const attr of Array.from(node.attributes)) {
      if (!allowed.includes(attr.name.toLowerCase())) node.removeAttribute(attr.name);
    }
    const href = node.getAttribute('href');
    if (href != null && !SAFE_HREF.test(href.trim())) node.removeAttribute('href');
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }
  };

  walk(root);
  return root.innerHTML;
}

/** Plain-text projection of note HTML, for previews, search and empty-state checks. */
export function richTextToPlainText(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
