import Anthropic from '@anthropic-ai/sdk';

export interface ProviderErrorDetail {
  provider: string;
  model: string;
  chunkIndex: number;
  message: string;
  status?: number;
}

function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const o = err as { status?: number; response?: { status?: number } };
  if (typeof o.status === 'number') return o.status;
  if (typeof o.response?.status === 'number') return o.response.status;
  return undefined;
}

function getRetryAfterMsFromHeaders(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const o = err as { response?: { headers?: unknown } } & { headers?: unknown };
  const h =
    o.response && typeof o.response === 'object' && o.response !== null
      ? (o.response as { headers?: unknown }).headers
      : o.headers;
  if (h == null) return null;

  const getHeader = (name: string): string | undefined => {
    if (typeof (h as Headers).get === 'function') {
      return (h as Headers).get(name) ?? (h as Headers).get(name.toLowerCase()) ?? undefined;
    }
    const rec = h as Record<string, string | undefined>;
    return rec[name] ?? rec[name.toLowerCase()];
  };

  const ra = getHeader('retry-after');
  if (ra != null) {
    const sec = Number(ra);
    if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
  }
  return null;
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIError) {
    if (err.status === 413) return false;
    if (err.status === 429) return true;
    if (err.status >= 500) return true;
    return false;
  }
  // Groq SDK duck-typed HTTP status
  const s = getHttpStatus(err);
  if (s === 413) return false;
  if (s === 429) return true;
  if (s !== undefined && s >= 500) return true;
  return false;
}

export function getRetryAfterMs(err: unknown): number | null {
  if (err instanceof Anthropic.RateLimitError && err.headers) {
    const ra = (err.headers as Record<string, string | undefined>)['retry-after'];
    if (ra) {
      const sec = Number(ra);
      if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
    }
  }
  return getRetryAfterMsFromHeaders(err);
}

export function buildProviderErrorDetail(
  err: unknown,
  ctx: { provider: string; model: string; chunkIndex: number },
): ProviderErrorDetail {
  const message = err instanceof Error ? err.message : String(err);
  const status =
    err instanceof Anthropic.APIError
      ? err.status
      : typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : undefined;
  return { ...ctx, message, status };
}
