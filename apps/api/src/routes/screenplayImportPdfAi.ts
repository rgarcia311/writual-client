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

/** Must match writual-ai `MAX_PLAINTEXT_CHARS`. */
const MAX_AI_PLAINTEXT_CHARS = 200_000;

const AI_REQUEST_TIMEOUT_MS = 600_000;

const json50mb = express.json({ limit: '50mb' });

interface AiParseJson {
  doc?: unknown;
  pageCount?: number;
  titleHint?: string | null;
  characters?: Array<{ name: string }>;
  scenes?: Array<{ sceneHeading: string; synopsis?: string }>;
}

function getAiConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = (process.env.AI_SERVICE_URL ?? '').replace(/\/$/, '');
  const secret = process.env.AI_SERVICE_SECRET ?? '';
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

async function forwardPlainTextToAi(
  plainText: string,
  pageCount: number,
): Promise<AiParseJson> {
  const cfg = getAiConfig();
  if (!cfg) {
    throw new Error('AI service not configured');
  }

  const url = `${cfg.baseUrl}/v1/parse-screenplay-text`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Writual-Internal-Secret': cfg.secret,
      },
      body: JSON.stringify({ plainText, pageCount }),
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
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`AI service returned non-JSON (${upstream.status})`);
  }

  if (!upstream.ok) {
    const err = (body as { error?: string })?.error ?? text;
    throw new Error(typeof err === 'string' ? err : `AI service error ${upstream.status}`);
  }

  return body as AiParseJson;
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

      const plainText = req.body?.plainText;
      if (typeof plainText !== 'string') {
        res.status(400).json({ error: 'Missing or invalid plainText' });
        return;
      }
      if (plainText.length > MAX_AI_PLAINTEXT_CHARS) {
        res.status(400).json({
          error: `Screenplay text exceeds ${MAX_AI_PLAINTEXT_CHARS} characters`,
        });
        return;
      }
      if (!plainText.trim()) {
        res.status(400).json({
          error:
            'No extractable text (scanned PDF?). Use a text-based PDF.',
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

      let parsed: AiParseJson;
      try {
        parsed = await forwardPlainTextToAi(plainText, pageCount);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'AI parse failed';
        console.error('[import-pdf-ai] forward to AI:', message);
        res.status(502).json({ error: message });
        return;
      }

      const doc = parsed.doc;
      if (!doc || typeof doc !== 'object') {
        res.status(502).json({ error: 'AI response missing doc' });
        return;
      }

      try {
        await saveScreenplay(null, { projectId, content: doc });
      } catch (e) {
        console.error('[import-pdf-ai] saveScreenplay:', e);
        res.status(500).json({ error: 'Failed to save screenplay' });
        return;
      }

      const pageCountOut =
        typeof parsed.pageCount === 'number' && Number.isFinite(parsed.pageCount)
          ? parsed.pageCount
          : undefined;
      if (pageCountOut != null && pageCountOut >= 0) {
        await Projects.findByIdAndUpdate(projectId, {
          $set: { pageCountEstimate: pageCountOut },
        }).exec();
      }

      const characters = Array.isArray(parsed.characters) ? parsed.characters : [];
      const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

      const entityErrors: string[] = [];
      let charactersCreated = 0;
      let scenesCreated = 0;

      for (const c of characters) {
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

      for (const s of scenes) {
        const sceneHeading =
          typeof s?.sceneHeading === 'string' ? s.sceneHeading.trim() : '';
        if (!sceneHeading) continue;
        const synopsis =
          typeof s?.synopsis === 'string' && s.synopsis.trim()
            ? s.synopsis.trim()
            : undefined;
        try {
          await createSceneService(projectId, {
            activeVersion: 1,
            versions: [
              {
                version: 1,
                sceneHeading,
                synopsis,
              },
            ],
          });
          scenesCreated++;
        } catch (err) {
          const label =
            sceneHeading.length > 40
              ? `${sceneHeading.slice(0, 40)}…`
              : sceneHeading;
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

      res.json({
        ok: true,
        titleHint:
          typeof parsed.titleHint === 'string' ? parsed.titleHint : null,
        screenplayBlockCount: contentArr.length,
        charactersCreated,
        scenesCreated,
        entityErrors,
      });
    },
  );
}
