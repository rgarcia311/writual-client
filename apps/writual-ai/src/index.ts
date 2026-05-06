import 'dotenv/config';
import * as crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { loadAIConfig } from './aiConfig';
import { createProvider } from './providers/factory';
import {
  enrichScreenplayImport,
  MAX_ENRICHMENT_BODY_CHARS,
} from './screenplayEnrichmentService';
import { calculateRoughTokenEstimate } from './tokenEstimate';

const PORT = Number(process.env.PORT) || 8790;
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? '';

const aiConfig = loadAIConfig();
const provider = createProvider(aiConfig);

const json50mb = express.json({ limit: '50mb' });

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
        : true;

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
  '/v1/enrich-screenplay-import',
  json50mb,
  async (req, res) => {
    if (!requireSecret(req, res)) return;

    const rawBody = JSON.stringify(req.body ?? {});
    if (rawBody.length > MAX_ENRICHMENT_BODY_CHARS) {
      res.status(413).json({
        error: `Request body exceeds ${MAX_ENRICHMENT_BODY_CHARS} characters`,
      });
      return;
    }

    const characterNamesRaw = req.body?.characterNames;
    const scenesRaw = req.body?.scenes;

    if (!Array.isArray(characterNamesRaw) || !Array.isArray(scenesRaw)) {
      res.status(400).json({ error: 'Expected characterNames[] and scenes[]' });
      return;
    }

    const characterNames = characterNamesRaw.filter(
      (n: unknown): n is string => typeof n === 'string',
    );
    const scenes: Array<{
      index: number;
      sceneHeading: string;
      synopsis?: string;
      scenePlainText: string;
    }> = [];

    for (const row of scenesRaw) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        res.status(400).json({ error: 'Invalid scenes[] entry' });
        return;
      }
      const r = row as Record<string, unknown>;
      if (typeof r.index !== 'number' || !Number.isFinite(r.index)) {
        res.status(400).json({ error: 'Each scene needs numeric index' });
        return;
      }
      if (typeof r.sceneHeading !== 'string' || !r.sceneHeading.trim()) {
        res.status(400).json({ error: 'Each scene needs sceneHeading string' });
        return;
      }
      if (typeof r.scenePlainText !== 'string') {
        res.status(400).json({ error: 'Each scene needs scenePlainText string' });
        return;
      }
      let synopsis: string | undefined;
      if (typeof r.synopsis === 'string' && r.synopsis.trim()) {
        synopsis = r.synopsis.trim();
      }
      scenes.push({
        index: Math.floor(r.index),
        sceneHeading: r.sceneHeading.trim(),
        synopsis,
        scenePlainText: r.scenePlainText,
      });
    }

    const inputTokenEstimate = calculateRoughTokenEstimate(
      rawBody,
      aiConfig.activeLimits.tokensPerChar,
    );
    if (inputTokenEstimate > aiConfig.maxInputTokensPerRequest) {
      res.status(413).json({
        error: `Payload too large: ~${inputTokenEstimate} estimated tokens exceeds maxInputTokensPerRequest=${aiConfig.maxInputTokensPerRequest}`,
      });
      return;
    }

    const projectId =
      typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    const correlationId = crypto.randomUUID();

    try {
      const result = await enrichScreenplayImport({
        provider,
        providerName: aiConfig.provider,
        model: aiConfig.model,
        aiConfig,
        characterNames,
        scenes,
        correlationId,
        projectId,
      });

      totalRequestsProcessed++;
      totalTokensConsumed +=
        result.totalUsage.promptTokens + result.totalUsage.completionTokens;

      res.json({
        characters: result.characters,
        sceneAnalyses: result.sceneAnalyses,
        warnings: result.warnings,
        totalUsage: result.totalUsage,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Enrichment failed';
      console.error(
        JSON.stringify({
          event: 'enrichment_request_error',
          correlationId,
          projectId: projectId ?? null,
          message,
        }),
      );
      res.status(500).json({ error: message });
    }
  },
);

const HOST = process.env.HOST?.trim();

if (HOST) {
  app.listen(PORT, HOST, () => {
    console.log(
      JSON.stringify({
        event: 'startup',
        service: 'writual-ai',
        provider: aiConfig.provider,
        model: aiConfig.model,
        host: HOST,
        port: PORT,
      }),
    );
  });
} else {
  app.listen(PORT, () => {
    console.log(
      JSON.stringify({
        event: 'startup',
        service: 'writual-ai',
        provider: aiConfig.provider,
        model: aiConfig.model,
        port: PORT,
        binding: 'dual-stack',
      }),
    );
  });
}
