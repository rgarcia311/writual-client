import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  JsonEnrichmentParams,
  JsonEnrichmentResult,
  CompletionUsage,
  ProviderStatus,
} from './types';

const PROVIDER_NAME = 'claude';
const WINDOW = 20;

const CHARACTER_ENRICHMENT_TOOL: Anthropic.Tool = {
  name: 'screenplay_character_refine',
  description: 'Return refined screenplay character cues as JSON.',
  input_schema: {
    type: 'object',
    properties: {
      characters: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    },
    required: ['characters'],
  },
};

const SCENE_ENRICHMENT_TOOL: Anthropic.Tool = {
  name: 'screenplay_scene_batch_enrich',
  description: 'Return thesis/antithesis/synthesis per scene index for this batch.',
  input_schema: {
    type: 'object',
    properties: {
      sceneAnalyses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            thesis: { type: 'string' },
            antithesis: { type: 'string' },
            synthesis: { type: 'string' },
          },
          required: ['index', 'thesis', 'antithesis', 'synthesis'],
        },
      },
    },
    required: ['sceneAnalyses'],
  },
};

export class ClaudeProvider implements AIProvider {
  private readonly anthropic: Anthropic;
  private readonly cachingEnabled: boolean;
  private readonly timeoutMs: number;
  private recentLatencies: number[] = [];
  private recentOutcomes: boolean[] = [];

  constructor(apiKey: string, cachingEnabled: boolean, timeoutMs: number) {
    this.anthropic = new Anthropic({ apiKey });
    this.cachingEnabled = cachingEnabled;
    this.timeoutMs = timeoutMs;
  }

  validateConfig(): void {
    const key = process.env.ANTHROPIC_API_KEY ?? '';
    if (!key) throw new Error('ANTHROPIC_API_KEY env var is not set');
  }

  async generateJsonEnrichment(
    params: JsonEnrichmentParams,
  ): Promise<JsonEnrichmentResult> {
    const estimatedInput = Math.ceil(
      (params.systemPrompt.length + params.userMessage.length) * params.tokensPerChar,
    );
    if (estimatedInput + params.maxOutputTokens > params.contextWindowTokens * 0.85) {
      throw new Error(
        `Enrichment input ~${estimatedInput} estimated tokens exceeds 85% of ${params.contextWindowTokens} context window for "${params.model}".`,
      );
    }

    const tool =
      params.kind === 'character_refine'
        ? CHARACTER_ENRICHMENT_TOOL
        : SCENE_ENRICHMENT_TOOL;

    const systemContent: Anthropic.TextBlockParam =
      this.cachingEnabled
        ? { type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }
        : { type: 'text', text: params.systemPrompt };

    const start = Date.now();
    const response = await this.anthropic.messages.create(
      {
        model: params.model,
        max_tokens: params.maxOutputTokens,
        temperature: params.temperature,
        system: [systemContent],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: params.userMessage }],
      },
      { signal: AbortSignal.timeout(this.timeoutMs) },
    );
    const latencyMs = Date.now() - start;

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse || toolUse.name !== tool.name) {
      throw new Error(`Claude did not call enrichment tool (${tool.name})`);
    }

    const { usage: apiUsage } = response;
    const apiUsageAny = apiUsage as unknown as Record<string, unknown>;
    const usage: CompletionUsage = {
      promptTokens: apiUsage.input_tokens,
      completionTokens: apiUsage.output_tokens,
      latencyMs,
      cacheCreationTokens: typeof apiUsageAny.cache_creation_input_tokens === 'number'
        ? apiUsageAny.cache_creation_input_tokens
        : undefined,
      cacheReadTokens: typeof apiUsageAny.cache_read_input_tokens === 'number'
        ? apiUsageAny.cache_read_input_tokens
        : undefined,
    };

    this.recordResult(latencyMs, true);

    console.log(
      JSON.stringify({
        event: 'enrichment_complete',
        correlationId: params.correlationId,
        projectId: params.projectId ?? null,
        provider: PROVIDER_NAME,
        model: params.model,
        kind: params.kind,
        tokens: {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
          cacheRead: usage.cacheReadTokens ?? null,
          cacheWrite: usage.cacheCreationTokens ?? null,
        },
        latencyMs,
      }),
    );

    return { json: toolUse.input, usage };
  }

  getProviderStatus(): ProviderStatus {
    const n = this.recentOutcomes.length;
    const errors = this.recentOutcomes.filter((s) => !s).length;
    const avgLatencyMs =
      this.recentLatencies.length > 0
        ? this.recentLatencies.reduce((s, v) => s + v, 0) / this.recentLatencies.length
        : null;
    return {
      isReady: true,
      circuitState: 'CLOSED',
      avgLatencyMs,
      errorRate: n > 0 ? errors / n : null,
      totalCompletions: n,
    };
  }

  getSupportedModels(): string[] {
    return ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'];
  }

  private recordResult(latencyMs: number, success: boolean): void {
    this.recentLatencies.push(latencyMs);
    this.recentOutcomes.push(success);
    if (this.recentLatencies.length > WINDOW) this.recentLatencies.shift();
    if (this.recentOutcomes.length > WINDOW) this.recentOutcomes.shift();
  }
}
