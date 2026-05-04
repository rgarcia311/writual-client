import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, CompletionParams, CompletionResult, CompletionUsage, ProviderStatus } from './types';
import { normalizeChunkPayload } from '../chunkNormalize';
import { groqChunkResponseSchema } from '../screenplaySchema';

const PROVIDER_NAME = 'claude';
const WINDOW = 20;

const SCREENPLAY_CHUNK_TOOL: Anthropic.Tool = {
  name: 'format_screenplay_chunk',
  description: 'Output the parsed screenplay chunk as structured JSON.',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['scriptBlock'] },
            attrs: {
              type: 'object',
              properties: {
                elementType: {
                  type: 'string',
                  enum: ['action', 'slugline', 'character', 'parenthetical', 'dialogue', 'transition'],
                },
              },
              required: ['elementType'],
            },
            content: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['text'] },
                  text: { type: 'string' },
                },
                required: ['type', 'text'],
              },
              minItems: 1,
            },
          },
          required: ['type', 'attrs', 'content'],
        },
      },
      titleHint: { type: 'string' },
      logline: { type: 'string' },
      authors: { type: 'array', items: { type: 'string' } },
      genre: { type: 'string' },
    },
    required: ['content'],
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

  async generateCompletion(params: CompletionParams): Promise<CompletionResult> {
    const estimatedInput = Math.ceil(params.userMessage.length * params.tokensPerChar);
    if (estimatedInput + params.maxOutputTokens > params.contextWindowTokens * 0.85) {
      throw new Error(
        `Chunk ~${estimatedInput} estimated tokens exceeds 85% of ${params.contextWindowTokens} context window for "${params.model}". Lower chunkMaxChars in ai-config.json.`,
      );
    }

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
        tools: [SCREENPLAY_CHUNK_TOOL],
        tool_choice: { type: 'tool', name: 'format_screenplay_chunk' },
        messages: [{ role: 'user', content: params.userMessage }],
      },
      { signal: AbortSignal.timeout(this.timeoutMs) },
    );
    const latencyMs = Date.now() - start;

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) {
      throw new Error('Claude did not call the format_screenplay_chunk tool');
    }

    const coerced = normalizeChunkPayload(toolUse.input);
    const validated = groqChunkResponseSchema.safeParse(coerced);
    if (!validated.success) {
      throw new Error(`Invalid chunk JSON from Claude: ${validated.error.message}`);
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

    console.log(JSON.stringify({
      event: 'chunk_complete',
      correlationId: params.correlationId,
      projectId: params.projectId ?? null,
      provider: PROVIDER_NAME,
      model: params.model,
      chunkIndex: params.chunkIndex,
      totalChunks: params.totalChunks,
      tokens: {
        prompt: usage.promptTokens,
        completion: usage.completionTokens,
        cacheRead: usage.cacheReadTokens ?? null,
        cacheWrite: usage.cacheCreationTokens ?? null,
      },
      latencyMs,
    }));

    return {
      content: validated.data.content,
      titleHint: validated.data.titleHint,
      logline: validated.data.logline,
      authors: validated.data.authors,
      genre: validated.data.genre,
      usage,
    };
  }

  getProviderStatus(): ProviderStatus {
    const n = this.recentOutcomes.length;
    const errors = this.recentOutcomes.filter(s => !s).length;
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
