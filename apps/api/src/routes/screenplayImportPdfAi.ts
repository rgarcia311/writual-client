import type { Express, Request, Response } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Projects } from '@writual/db';
import { verifyUser } from '../lib/verifyUser';
import { verifyProjectWriteAccess } from '../lib/projectAccess';
import { requireTier } from '../utils/tierUtils';
import { saveScreenplay } from '../mutations/project-mutations';
import { createCharacter as createCharacterService } from '../services/CharacterService';
import { createScene as createSceneService } from '../services/SceneService';
import {
  extractDialogueCueCharacters,
  extractOutlineScenesForEnrichment,
} from '../lib/entitiesFromScreenplayDoc';

const AI_REQUEST_TIMEOUT_MS = 600_000;

const json50mb = express.json({ limit: '50mb' });

interface EnrichScreenplayImportResponse {
  characters?: Array<{ name?: string }>;
  sceneAnalyses?: Array<{
    index?: number;
    thesis?: string;
    antithesis?: string;
    synthesis?: string;
  }>;
  warnings?: string[];
}

function getAiConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = (process.env.AI_SERVICE_URL ?? '').replace(/\/$/, '');
  const secret = process.env.AI_SERVICE_SECRET ?? '';
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

async function forwardEnrichmentToAi(
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

export function registerScreenplayImportPdfAiRoute(app: Express): void {
  app.post(
    '/api/screenplay/import-pdf-ai',
    json50mb,
    async (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      const uid = await verifyUser(
        typeof authHeader === 'string' ? authHeader : undefined,
      );
      if (!uid) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        await requireTier({ uid }, 'greenlit');
      } catch (e) {
        res.status(403).json({
          error: e instanceof Error ? e.message : 'Requires greenlit tier or higher',
        });
        return;
      }

      if (!getAiConfig()) {
        res.status(503).json({ error: 'AI import is not configured on the server' });
        return;
      }

      const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ error: 'Invalid or missing projectId' });
        return;
      }

      try {
        await verifyProjectWriteAccess(projectId, uid);
      } catch (e) {
        if (e instanceof GraphQLError) {
          res.status(403).json({ error: e.message });
          return;
        }
        throw e;
      }

      const doc = req.body?.doc;
      if (!doc || typeof doc !== 'object' || doc === null) {
        res.status(400).json({ error: 'Missing or invalid doc' });
        return;
      }

      const pageCountRaw = req.body?.pageCount;
      const pageCount =
        typeof pageCountRaw === 'number' &&
        Number.isFinite(pageCountRaw) &&
        pageCountRaw >= 0
          ? Math.floor(pageCountRaw)
          : 0;

      try {
        await saveScreenplay(null, { projectId, content: doc });
      } catch (e) {
        console.error('[import-pdf-ai] saveScreenplay:', e);
        res.status(500).json({ error: 'Failed to save screenplay' });
        return;
      }

      await Projects.findByIdAndUpdate(projectId, {
        $set: { pageCountEstimate: pageCount },
      }).exec();

      const deterministicChars = extractDialogueCueCharacters(doc);
      const outlineScenes = extractOutlineScenesForEnrichment(doc);

      let finalChars = deterministicChars;
      let sceneAnalyses: NonNullable<EnrichScreenplayImportResponse['sceneAnalyses']> = [];
      const enrichmentWarnings: string[] = [];

      try {
        const enriched = await forwardEnrichmentToAi({
          projectId,
          characterNames: deterministicChars.map((c) => c.name),
          scenes: outlineScenes.map((s) => ({
            index: s.index,
            sceneHeading: s.sceneHeading,
            synopsis: s.synopsis,
            scenePlainText: s.scenePlainText,
          })),
        });
        const aiChars =
          Array.isArray(enriched.characters) && enriched.characters.length > 0
            ? enriched.characters
                .filter((c) => c && typeof c.name === 'string' && c.name.trim() !== '')
                .map((c) => ({ name: (c.name as string).trim() }))
            : [];
        if (aiChars.length > 0) {
          finalChars = aiChars;
        } else {
          finalChars = deterministicChars;
        }
        sceneAnalyses = Array.isArray(enriched.sceneAnalyses) ? enriched.sceneAnalyses : [];
        if (Array.isArray(enriched.warnings)) {
          enrichmentWarnings.push(...enriched.warnings);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'AI enrichment unavailable';
        console.error('[import-pdf-ai] forward to AI:', message);
        enrichmentWarnings.push(message);
        finalChars = deterministicChars;
        sceneAnalyses = [];
      }

      const analysisByIndex = new Map<number, NonNullable<(typeof sceneAnalyses)[number]>>();
      for (const a of sceneAnalyses) {
        if (
          !a ||
          typeof a.index !== 'number' ||
          !Number.isFinite(a.index)
        ) {
          continue;
        }
        analysisByIndex.set(Math.floor(a.index), a);
      }

      const entityErrors: string[] = [];
      let charactersCreated = 0;
      let scenesCreated = 0;

      for (const c of finalChars) {
        const name = typeof c?.name === 'string' ? c.name.trim() : '';
        if (!name) continue;
        try {
          await createCharacterService(projectId, {
            activeVersion: 1,
            details: [{ name, version: 1 }],
          });
          charactersCreated++;
        } catch (err) {
          entityErrors.push(
            `character "${name}": ${err instanceof Error ? err.message : 'failed'}`,
          );
        }
      }

      for (const meta of outlineScenes) {
        const sceneHeading = meta.sceneHeading.trim();
        if (!sceneHeading) continue;
        const synopsis =
          typeof meta.synopsis === 'string' && meta.synopsis.trim()
            ? meta.synopsis.trim()
            : undefined;
        const ana = analysisByIndex.get(meta.index);

        try {
          await createSceneService(projectId, {
            activeVersion: 1,
            versions: [
              {
                version: 1,
                sceneHeading,
                synopsis,
                thesis:
                  ana && typeof ana.thesis === 'string' ? ana.thesis.trim() : undefined,
                antithesis:
                  ana && typeof ana.antithesis === 'string'
                    ? ana.antithesis.trim()
                    : undefined,
                synthesis:
                  ana && typeof ana.synthesis === 'string'
                    ? ana.synthesis.trim()
                    : undefined,
              },
            ],
          });
          scenesCreated++;
        } catch (err) {
          const label =
            sceneHeading.length > 40 ? `${sceneHeading.slice(0, 40)}…` : sceneHeading;
          entityErrors.push(
            `scene "${label}": ${err instanceof Error ? err.message : 'failed'}`,
          );
        }
      }

      const contentArr =
        doc &&
        typeof doc === 'object' &&
        doc !== null &&
        'content' in doc &&
        Array.isArray((doc as { content?: unknown }).content)
          ? (doc as { content: unknown[] }).content
          : [];

      for (const w of enrichmentWarnings.slice(0, 12)) {
        entityErrors.push(`enrichment: ${w}`);
      }

      res.json({
        ok: true,
        titleHint: null,
        screenplayBlockCount: contentArr.length,
        charactersCreated,
        scenesCreated,
        entityErrors,
      });
    },
  );
}
