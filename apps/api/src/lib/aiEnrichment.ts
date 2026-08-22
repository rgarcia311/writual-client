/**
 * Transport for the writual-ai service (Railway). Provider API keys live only on that service, so
 * everything here goes through its internal HTTP endpoint authenticated by a shared secret.
 */

/** Enrichment runs an LLM over a whole feature script, which is slow but bounded. */
const AI_REQUEST_TIMEOUT_MS = 600_000;

export interface EnrichScreenplayImportResponse {
  characters?: Array<{ name?: string }>;
  sceneAnalyses?: Array<{
    index?: number;
    thesis?: string;
    antithesis?: string;
    synthesis?: string;
  }>;
  warnings?: string[];
}

export function getAiConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = (process.env.AI_SERVICE_URL ?? '').replace(/\/$/, '');
  const secret = process.env.AI_SERVICE_SECRET ?? '';
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

export async function forwardEnrichmentToAi(
  body: Record<string, unknown>,
): Promise<EnrichScreenplayImportResponse> {
  const cfg = getAiConfig();
  if (!cfg) {
    throw new Error('AI service not configured');
  }

  const url = `${cfg.baseUrl}/v1/enrich-screenplay-import`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Writual-Internal-Secret': cfg.secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const cause = (e as { cause?: unknown })?.cause;
    const causeCode =
      cause && typeof cause === 'object' && 'code' in cause
        ? String((cause as { code: unknown }).code)
        : undefined;
    const causeMsg =
      cause instanceof Error ? cause.message : cause ? String(cause) : undefined;
    const baseMsg = e instanceof Error ? e.message : String(e);
    const detail = [baseMsg, causeCode, causeMsg].filter(Boolean).join(' / ');
    throw new Error(
      `Cannot reach writual-ai at ${url} (${detail}). ` +
        'Start `@writual/writual-ai` (e.g. `npm run dev:ai`), and set AI_SERVICE_URL in the API env (e.g. http://127.0.0.1:8790). ' +
        'AI_SERVICE_SECRET must match INTERNAL_SERVICE_SECRET on writual-ai.',
    );
  }

  const text = await upstream.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`AI service returned non-JSON (${upstream.status})`);
  }

  if (!upstream.ok) {
    const err = (parsed as { error?: string })?.error ?? text;
    throw new Error(typeof err === 'string' ? err : `AI service error ${upstream.status}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid AI enrichment response');
  }
  return parsed as EnrichScreenplayImportResponse;
}
