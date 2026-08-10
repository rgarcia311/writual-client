function ensureSecureWsIfNeeded(url: string): string {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    url.startsWith('ws://')
  ) {
    return url.replace(/^ws:\/\//, 'wss://')
  }
  return url
}

/**
 * In the browser with no explicit override, default to the page's own hostname
 * (rather than a hardcoded "localhost") so the app also works when accessed
 * over the LAN from another device — the API/Hocuspocus servers run on the
 * same machine that served the page, just on different ports.
 */
function browserHost(): string | undefined {
  return typeof window !== 'undefined' ? window.location.hostname : undefined;
}

export const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ||
  (browserHost() ? `http://${browserHost()}:8080` : "http://localhost:8080");

/** REST API origin (same host as GraphQL by default). Used for PDF AI import. */
export function getApiOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  try {
    const u = new URL(GRAPHQL_ENDPOINT);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:8080';
  }
}

export const HOCUSPOCUS_URL = ensureSecureWsIfNeeded(
  process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ||
    (browserHost() ? `ws://${browserHost()}:8787` : "ws://localhost:8787")
);
