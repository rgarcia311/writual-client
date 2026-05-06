import type {
  AIProvider,
  JsonEnrichmentParams,
  JsonEnrichmentResult,
  ProviderStatus,
} from './types';

export class MockProvider implements AIProvider {
  async generateJsonEnrichment(
    params: JsonEnrichmentParams,
  ): Promise<JsonEnrichmentResult> {
    if (params.kind === 'character_refine') {
      let names: string[] = [];
      try {
        const parsed = JSON.parse(params.userMessage) as { characterNames?: unknown };
        if (
          Array.isArray(parsed.characterNames) &&
          parsed.characterNames.every((n) => typeof n === 'string')
        ) {
          names = parsed.characterNames.filter((s) => s.trim().length > 0);
        }
      } catch {
        names = [];
      }
      const characters = names.map((name) => ({ name }));
      return {
        json: { characters },
        usage: {
          promptTokens: 8,
          completionTokens: 12,
          latencyMs: 0,
        },
      };
    }

    let scenesIn: Array<{ index: number }> = [];
    try {
      const parsed = JSON.parse(params.userMessage) as { scenes?: unknown };
      if (Array.isArray(parsed.scenes)) {
        for (const row of parsed.scenes) {
          if (row && typeof row === 'object' && !Array.isArray(row)) {
            const idx = (row as { index?: unknown }).index;
            if (typeof idx === 'number' && Number.isFinite(idx)) {
              scenesIn.push({ index: idx });
            }
          }
        }
      }
    } catch {
      scenesIn = [];
    }

    const sceneAnalyses = scenesIn.map(({ index }) => ({
      index,
      thesis: 'Protagonist needs a concrete outcome before the scene ends.',
      antithesis: 'A rival force shuts down the quickest path.',
      synthesis: 'They pivot through a risky backup plan. They advance but owe a visible cost.',
    }));

    return {
      json: { sceneAnalyses },
      usage: {
        promptTokens: 24,
        completionTokens: 64,
        latencyMs: 0,
      },
    };
  }

  getProviderStatus(): ProviderStatus {
    return {
      isReady: true,
      circuitState: 'CLOSED',
      avgLatencyMs: 0,
      errorRate: 0,
      totalCompletions: 0,
    };
  }

  getSupportedModels(): string[] {
    return ['mock'];
  }
}
