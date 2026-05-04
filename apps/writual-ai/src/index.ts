import 'dotenv/config';
import * as crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { loadAIConfig } from './aiConfig';
import { createProvider } from './providers/factory';
import {
  parseScreenplay,
  MAX_PLAINTEXT_CHARS,
} from './screenplayImportService';
import { calculateRoughTokenEstimate } from './tokenEstimate';

const PORT = Number(process.env.PORT) || 8790;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? '';

// Load config and create provider at startup — throws if misconfigured.
const aiConfig = loadAIConfig();
const provider = createProvider(aiConfig);

const json50mb = express.json({ limit: '50mb' });

// In-memory analytics (reset on restart)
let totalRequestsProcessed = 0;
let totalTokensConsumed = 0;

function requireSecret(req: express.Request, res: express.Response): boolean {
  const got = req.headers['x-writual-internal-secret'];
  if (!INTERNAL_SECRET || got !== INTERNAL_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const app = express();
app.use(cors({ origin: false }));

app.get('/health', (_req, res) => {
  const providerKeyPresent =
    aiConfig.provider === 'groq'
      ? Boolean(process.env.GROQ_API_KEY)
      : aiConfig.provider === 'claude'
        ? Boolean(process.env.ANTHROPIC_API_KEY)
        : true; // mock provider has no key requirement

  const providerStatus = provider.getProviderStatus?.() ?? null;

  res.json({
    ok: true,
    service: 'writual-ai',
    provider: aiConfig.provider,
    model: aiConfig.model,
    configIntegrity: {
      providerKeyPresent,
      internalSecretPresent: Boolean(process.env.INTERNAL_SERVICE_SECRET),
    },
    analytics: {
      totalRequestsProcessed,
      totalTokensConsumed,
    },
    providerStatus,
    supportedModels: provider.getSupportedModels?.() ?? null,
  });
});

app.post(
  '/v1/parse-screenplay-text',
  json50mb,
  async (req, res) => {
    if (!requireSecret(req, res)) return;

    const plainText = req.body?.plainText;
    if (typeof plainText !== 'string') {
      res.status(400).json({ error: 'Missing or invalid plainText' });
      return;
    }
    if (plainText.length > MAX_PLAINTEXT_CHARS) {
      res
        .status(400)
        .json({ error: `plainText exceeds ${MAX_PLAINTEXT_CHARS} characters` });
      return;
    }
    if (!plainText.trim()) {
      res
        .status(400)
        .json({ error: 'No extractable text (scanned PDF?). Use a text-based PDF.' });
      return;
    }

    // Pre-flight cost budget check — reject before any API call
    const inputTokenEstimate = calculateRoughTokenEstimate(
      plainText,
      aiConfig.activeLimits.tokensPerChar,
    );
    if (inputTokenEstimate > aiConfig.maxInputTokensPerRequest) {
      res.status(413).json({
        error: `Input too large: ~${inputTokenEstimate} estimated tokens exceeds maxInputTokensPerRequest=${aiConfig.maxInputTokensPerRequest}`,
      });
      return;
    }

    const pageCountRaw = req.body?.pageCount;
    const pageCount =
      typeof pageCountRaw === 'number' &&
      Number.isFinite(pageCountRaw) &&
      pageCountRaw >= 0
        ? Math.floor(pageCountRaw)
        : 0;

    const projectId =
      typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;

    const correlationId = crypto.randomUUID();

    try {
      const result = await parseScreenplay({
        plainText,
        pageCount,
        provider,
        providerName: aiConfig.provider,
        model: aiConfig.model,
        maxChunkChars: aiConfig.activeLimits.chunkMaxChars,
        maxOutputTokensPerChunk: aiConfig.activeLimits.maxOutputTokensPerChunk,
        contextWindowTokens: aiConfig.activeLimits.contextWindowTokens,
        tokensPerChar: aiConfig.activeLimits.tokensPerChar,
        chunkInterDelayMs: aiConfig.chunkInterDelayMs,
        temperature: aiConfig.temperature,
        requestTimeoutMs: aiConfig.requestTimeoutMs,
        maxConcurrency: aiConfig.maxConcurrency,
        maxTotalChunksPerRequest: aiConfig.maxTotalChunksPerRequest,
        maxTotalTokensPerRequest: aiConfig.maxTotalTokensPerRequest,
        correlationId,
        projectId,
      });

      totalRequestsProcessed++;
      totalTokensConsumed +=
        result.totalUsage.promptTokens + result.totalUsage.completionTokens;

      res.json({
        doc: result.doc,
        pageCount: result.pageCount,
        titleHint: result.titleHint,
        logline: result.logline,
        authors: result.authors,
        genre: result.genre,
        characters: result.characters,
        scenes: result.scenes,
        status: result.status,
        unprocessedChunkIndices: result.unprocessedChunkIndices,
        totalUsage: result.totalUsage,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Parse failed';
      console.error(JSON.stringify({
        event: 'request_error',
        correlationId,
        projectId: projectId ?? null,
        message,
      }));
      res.status(500).json({ error: message });
    }
  },
);

const HOST = process.env.HOST?.trim();

if (HOST) {
  app.listen(PORT, HOST, () => {
    console.log(JSON.stringify({
      event: 'startup',
      service: 'writual-ai',
      provider: aiConfig.provider,
      model: aiConfig.model,
      host: HOST,
      port: PORT,
    }));
  });
} else {
  app.listen(PORT, () => {
    console.log(JSON.stringify({
      event: 'startup',
      service: 'writual-ai',
      provider: aiConfig.provider,
      model: aiConfig.model,
      port: PORT,
      binding: 'dual-stack',
    }));
  });
}
