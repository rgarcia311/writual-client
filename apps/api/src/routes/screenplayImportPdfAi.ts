import type { Express, Request, Response } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { verifyUser } from '../lib/verifyUser';
import { verifyProjectWriteAccess } from '../lib/projectAccess';
import { requireTier } from '../utils/tierUtils';
import { MULTI_SCREENPLAY_MIN_TIER } from '@writual/tier-logic';
import { getAiConfig } from '../lib/aiEnrichment';
import {
  importScreenplayPdf,
  type EntityStrategy,
  type ImportMode,
} from '../services/ScreenplayImportService';

/**
 * Server-side screenplay import. The client parses the PDF (pdf.js runs in the browser) and posts
 * the resulting TipTap document here; this route persists it and, for the AI-enabled path, derives
 * characters and scenes via the writual-ai service.
 *
 * Reached from two places: the create-project flow (new project, always `mode: 'replace'` against
 * the fresh primary document) and the screenplay page's import dialog (`replace` or `add`).
 */

/** Parsed feature scripts routinely exceed Express's 100kb default. */
const json50mb = express.json({ limit: '50mb' });

const VALID_MODES: readonly ImportMode[] = ['replace', 'add'];
const VALID_ENTITY_STRATEGIES: readonly EntityStrategy[] = ['all', 'selected', 'none'];

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

      const body = (req.body ?? {}) as Record<string, unknown>;

      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ error: 'Invalid or missing projectId' });
        return;
      }

      const doc = body.doc;
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        res.status(400).json({ error: 'Missing or invalid doc' });
        return;
      }

      const mode: ImportMode = VALID_MODES.includes(body.mode as ImportMode)
        ? (body.mode as ImportMode)
        : 'replace';

      // `withAi` opts into character/scene generation. Defaults true so the existing create-project
      // caller, which predates the flag, keeps its behaviour.
      const withAi = body.withAi !== false;

      // Landing the PDF in a *new* document leaves the project holding several screenplays, which
      // is the same greenlit+ capability the "New screenplay" button is gated on. Replacing an
      // existing document adds no document and stays open to every tier.
      if (mode === 'add') {
        try {
          await requireTier({ uid }, MULTI_SCREENPLAY_MIN_TIER);
        } catch (e) {
          res.status(403).json({
            error:
              e instanceof Error
                ? e.message
                : `Requires ${MULTI_SCREENPLAY_MIN_TIER} tier or higher`,
          });
          return;
        }
      }

      // Deriving characters and scenes is the greenlit+ feature; writing screenplay content is not.
      if (withAi) {
        try {
          await requireTier({ uid }, 'greenlit');
        } catch (e) {
          res.status(403).json({
            error:
              e instanceof Error ? e.message : 'Requires greenlit tier or higher',
          });
          return;
        }
        if (!getAiConfig()) {
          res
            .status(503)
            .json({ error: 'AI import is not configured on the server' });
          return;
        }
      } else {
        try {
          await requireTier({ uid }, 'spec');
        } catch (e) {
          res
            .status(403)
            .json({ error: e instanceof Error ? e.message : 'Forbidden' });
          return;
        }
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

      const documentId =
        typeof body.documentId === 'string' &&
        mongoose.Types.ObjectId.isValid(body.documentId)
          ? body.documentId
          : null;

      const entityStrategy: EntityStrategy = VALID_ENTITY_STRATEGIES.includes(
        body.entityStrategy as EntityStrategy,
      )
        ? (body.entityStrategy as EntityStrategy)
        : 'all';

      try {
        const result = await importScreenplayPdf({
          projectId,
          doc: doc as Record<string, unknown>,
          pageCount: coercePageCount(body.pageCount),
          layout: coerceLayout(body.layout),
          mode,
          documentId,
          documentName:
            typeof body.documentName === 'string' ? body.documentName : null,
          sourceFileName:
            typeof body.sourceFileName === 'string' ? body.sourceFileName : null,
          withAi,
          entityStrategy,
          replaceCharacterIds: coerceIdList(body.replaceCharacterIds),
          replaceSceneIds: coerceIdList(body.replaceSceneIds),
        });

        res.json({ ok: true, ...result });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to import screenplay';
        console.error('[import-pdf-ai]', message);
        // A bad documentId is the caller's mistake, not a server fault.
        const status = /not found/i.test(message) ? 400 : 500;
        res.status(status).json({ error: message });
      }
    },
  );
}

function coercePageCount(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? Math.floor(raw)
    : 0;
}

function coerceLayout(raw: unknown): Record<string, unknown> | undefined {
  return raw != null && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : undefined;
}

function coerceIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (id): id is string =>
      typeof id === 'string' && mongoose.Types.ObjectId.isValid(id),
  );
}
