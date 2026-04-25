import type { Express, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Projects } from '@writual/db';
import { verifyUser } from '../lib/verifyUser';
import { verifyProjectWriteAccess } from '../lib/projectAccess';
import { requireTier } from '../utils/tierUtils';
import { saveScreenplay } from '../mutations/project-mutations';
import { createCharacter as createCharacterService } from '../services/CharacterService';
import { createScene as createSceneService } from '../services/SceneService';

const AI_REQUEST_TIMEOUT_MS = 600_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

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

async function forwardPdfToAi(
  buffer: Buffer,
  originalname: string,
): Promise<AiParseJson> {
  const cfg = getAiConfig();
  if (!cfg) {
    throw new Error('AI service not configured');
  }

  const form = new FormData();
  const bytes = new Uint8Array(buffer);
  form.append(
    'file',
    new Blob([bytes], { type: 'application/pdf' }),
    originalname || 'screenplay.pdf',
  );

  const res = await fetch(`${cfg.baseUrl}/v1/parse-screenplay-pdf`, {
    method: 'POST',
    headers: {
      'X-Writual-Internal-Secret': cfg.secret,
    },
    body: form,
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`AI service returned non-JSON (${res.status})`);
  }

  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? text;
    throw new Error(typeof err === 'string' ? err : `AI service error ${res.status}`);
  }

  return body as AiParseJson;
}

export function registerScreenplayImportPdfAiRoute(app: Express): void {
  app.post(
    '/api/screenplay/import-pdf-ai',
    upload.single('file'),
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

      const file = req.file;
      if (!file?.buffer) {
        res.status(400).json({ error: 'Missing file' });
        return;
      }

      let parsed: AiParseJson;
      try {
        parsed = await forwardPdfToAi(file.buffer, file.originalname);
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

      const pageCount =
        typeof parsed.pageCount === 'number' && Number.isFinite(parsed.pageCount)
          ? parsed.pageCount
          : undefined;
      if (pageCount != null && pageCount >= 0) {
        await Projects.findByIdAndUpdate(projectId, {
          $set: { pageCountEstimate: pageCount },
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

      res.json({
        ok: true,
        titleHint:
          typeof parsed.titleHint === 'string' ? parsed.titleHint : null,
        charactersCreated,
        scenesCreated,
        entityErrors,
      });
    },
  );
}
