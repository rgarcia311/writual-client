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
 * In the browser with no explicit override, route through Next's own origin at
 * `/api/graphql` (proxied server-side to the real API origin — see next.config.js's
 * `rewrites()`) rather than hitting `<host>:8080` directly. A direct host:port fetch only
 * works when the browser can reach that port on that host itself, which holds for
 * localhost and plain LAN-IP access but breaks for a single-port tunnel (ngrok et al.) —
 * the tunnel only forwards Next's own port, so `<tunnel-host>:8080` doesn't route anywhere
 * and REST/GraphQL calls fail with "Failed to fetch". Same-origin + server-side proxy works
 * for all three cases uniformly.
 */
function browserOrigin(): string | undefined {
  return typeof window !== 'undefined' ? window.location.origin : undefined;
}

/** Used by HOCUSPOCUS_URL below — unrelated to the GraphQL same-origin fix above. */
function browserHost(): string | undefined {
  return typeof window !== 'undefined' ? window.location.hostname : undefined;
}

export const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ||
  (browserOrigin() ? `${browserOrigin()}/api/graphql` : "http://localhost:8080");

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
