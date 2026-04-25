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

export const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:8080";

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
  process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "ws://localhost:8787"
);
