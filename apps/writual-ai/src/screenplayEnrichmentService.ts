import type { AIConfig } from './aiConfig';
import type { AIProvider } from './providers/types';
import type { CompletionUsage } from './providers/types';
import { characterRefineOutputSchema, sceneBatchOutputSchema } from './screenplaySchema';

export const MAX_ENRICHMENT_BODY_CHARS = 200_000;

const CHARACTER_REFINE_SYSTEM = `You receive JSON with "characterNames": dialogue cue names auto-extracted from a screenplay. The list may include noise, duplicates, or non-characters.

Return JSON { "characters": [ { "name": "..." } ] } with a cleaned subset drawn only from cues in "characterNames" (normalize spelling or merge duplicates; do not invent new people who are absent from that list unless two entries are obvious duplicates needing one canonical name).

Use screenplay-style ALL CAPS cue names when conventional. Remove sound labels, crowds, or directions that are not playable characters.

If "characterNames" is empty return { "characters": [] }.`;

const SCENE_ENRICH_SYSTEM = `You analyze screenplay scenes for dramatic structure.

The user message JSON has a "scenes" array. Each item has:
- "index" (number — you must echo it),
- "sceneHeading" (slugline),
- "scenePlainText" (full scene body for that beat).

For each scene, identify the main on-screen protagonist when possible; if unclear, pick the clearest driver of the conflict.

Explicit output rules from the product owner — follow exactly:

Limit the Thesis to 1 sentence, the Antithesis to 1 sentence, and the Synthesis to 2 sentences. Use this as an example for tone:

"thesis": "Elara needs to steal the access key from the captain's quarters to bypass the ship's lockdown.",
"antithesis": "The captain returns unexpectedly early, accompanied by a heavily armed security droid.",
"synthesis": "Elara hides in the ventilation shaft but accidentally drops her comms device. She escapes with the key, but the captain is now alerted to an intruder on board."

Be punchy and direct. Do not use filler words.

Return JSON { "sceneAnalyses": [ ... ] } — one entry per input scene, preserving each "index", with "thesis", "antithesis", "synthesis" strings. Do not omit scenes.`;

function addUsage(a: CompletionUsage, b: CompletionUsage): CompletionUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    latencyMs: a.latencyMs + b.latencyMs,
    cacheCreationTokens: (a.cacheCreationTokens ?? 0) + (b.cacheCreationTokens ?? 0),
    cacheReadTokens: (a.cacheReadTokens ?? 0) + (b.cacheReadTokens ?? 0),
  };
}

function emptyUsage(): CompletionUsage {
  return { promptTokens: 0, completionTokens: 0, latencyMs: 0 };
}

export interface EnrichSceneInput {
  index: number;
  sceneHeading: string;
  synopsis?: string;
  scenePlainText: string;
}

export interface EnrichScreenplayImportParams {
  provider: AIProvider;
  providerName: string;
  model: string;
  aiConfig: AIConfig;
  characterNames: string[];
  scenes: EnrichSceneInput[];
  correlationId: string;
  projectId?: string;
}

export interface EnrichScreenplayImportResult {
  characters: Array<{ name: string }>;
  sceneAnalyses: Array<{
    index: number;
    thesis: string;
    antithesis: string;
    synthesis: string;
  }>;
  warnings: string[];
  totalUsage: CompletionUsage;
}

function buildSceneBatches(
  scenes: EnrichSceneInput[],
  systemPrompt: string,
  limits: { contextWindowTokens: number; maxOutputTokensPerChunk: number; tokensPerChar: number },
): EnrichSceneInput[][] {
  const batches: EnrichSceneInput[][] = [];
  const systemCost = Math.ceil(systemPrompt.length * limits.tokensPerChar);
  const overhead = 400;
  const maxInputBudget = Math.floor(
    limits.contextWindowTokens * 0.85 - limits.maxOutputTokensPerChunk,
  );

  let current: EnrichSceneInput[] = [];

  const estimateFor = (tentative: EnrichSceneInput[]): number => {
    const userMessage = JSON.stringify({
      scenes: tentative.map((sc) => ({
        index: sc.index,
        sceneHeading: sc.sceneHeading,
        scenePlainText: sc.scenePlainText,
      })),
    });
    return (
      systemCost + overhead + Math.ceil(userMessage.length * limits.tokensPerChar)
    );
  };

  for (const s of scenes) {
    const tentative = [...current, s];
    const est = estimateFor(tentative);
    if (current.length > 0 && est > maxInputBudget) {
      batches.push(current);
      current = [s];
    } else {
      current = tentative;
    }
  }
  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichScreenplayImport(
  params: EnrichScreenplayImportParams,
): Promise<EnrichScreenplayImportResult> {
  const warnings: string[] = [];
  const limits = params.aiConfig.activeLimits;
  let totalUsage = emptyUsage();

  const deterministicCharacters = params.characterNames
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((name) => ({ name }));

  let refinedCharacters = deterministicCharacters;

  if (deterministicCharacters.length > 0) {
    try {
      const out = await params.provider.generateJsonEnrichment({
        systemPrompt: CHARACTER_REFINE_SYSTEM,
        userMessage: JSON.stringify({
          characterNames: deterministicCharacters.map((c) => c.name),
        }),
        model: params.model,
        maxOutputTokens: limits.maxOutputTokensPerChunk,
        temperature: params.aiConfig.temperature,
        requestTimeoutMs: params.aiConfig.requestTimeoutMs,
        contextWindowTokens: limits.contextWindowTokens,
        tokensPerChar: limits.tokensPerChar,
        correlationId: params.correlationId,
        projectId: params.projectId,
        kind: 'character_refine',
      });
      totalUsage = addUsage(totalUsage, out.usage);
      const parsed = characterRefineOutputSchema.safeParse(out.json);
      if (parsed.success && parsed.data.characters.length > 0) {
        refinedCharacters = parsed.data.characters
          .map((c) => ({ name: c.name.trim() }))
          .filter((c) => c.name.length > 0);
      } else {
        warnings.push('character_refine: invalid or empty model output; using deterministic cues');
        refinedCharacters = deterministicCharacters;
      }
    } catch (e) {
      warnings.push(
        `character_refine failed: ${e instanceof Error ? e.message : 'unknown error'}; using deterministic cues`,
      );
      refinedCharacters = deterministicCharacters;
    }
  }

  const sceneAnalyses: Array<{
    index: number;
    thesis: string;
    antithesis: string;
    synthesis: string;
  }> = [];

  if (params.scenes.length === 0) {
    return { characters: refinedCharacters, sceneAnalyses, warnings, totalUsage };
  }

  const batches = buildSceneBatches(params.scenes, SCENE_ENRICH_SYSTEM, limits);

  for (let b = 0; b < batches.length; b++) {
    if (b > 0 && params.aiConfig.chunkInterDelayMs > 0) {
      await sleep(params.aiConfig.chunkInterDelayMs);
    }
    const batch = batches[b]!;
    const userMessage = JSON.stringify({
      scenes: batch.map((s) => ({
        index: s.index,
        sceneHeading: s.sceneHeading,
        scenePlainText: s.scenePlainText,
      })),
    });
    try {
      const out = await params.provider.generateJsonEnrichment({
        systemPrompt: SCENE_ENRICH_SYSTEM,
        userMessage,
        model: params.model,
        maxOutputTokens: limits.maxOutputTokensPerChunk,
        temperature: params.aiConfig.temperature,
        requestTimeoutMs: params.aiConfig.requestTimeoutMs,
        contextWindowTokens: limits.contextWindowTokens,
        tokensPerChar: limits.tokensPerChar,
        correlationId: params.correlationId,
        projectId: params.projectId,
        kind: 'scene_batch',
      });
      totalUsage = addUsage(totalUsage, out.usage);
      const parsed = sceneBatchOutputSchema.safeParse(out.json);
      if (!parsed.success) {
        warnings.push(`scene_batch ${b}: schema validation failed`);
        continue;
      }
      const allowed = new Set(batch.map((s) => s.index));
      for (const row of parsed.data.sceneAnalyses) {
        if (!allowed.has(row.index)) continue;
        sceneAnalyses.push({
          index: row.index,
          thesis: row.thesis.trim(),
          antithesis: row.antithesis.trim(),
          synthesis: row.synthesis.trim(),
        });
      }
      if (parsed.data.sceneAnalyses.length < batch.length) {
        warnings.push(`scene_batch ${b}: model returned fewer analyses than scenes`);
      }
    } catch (e) {
      warnings.push(
        `scene_batch ${b}: ${e instanceof Error ? e.message : 'request failed'}`,
      );
    }
  }

  console.log(
    JSON.stringify({
      event: 'enrich_screenplay_import_complete',
      correlationId: params.correlationId,
      projectId: params.projectId ?? null,
      batches: batches.length,
      scenes: params.scenes.length,
      warnings: warnings.length,
      provider: params.providerName,
    }),
  );

  return { characters: refinedCharacters, sceneAnalyses, warnings, totalUsage };
}
