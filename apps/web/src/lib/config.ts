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

export const HOCUSPOCUS_URL = ensureSecureWsIfNeeded(
  process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "ws://localhost:8787"
);
