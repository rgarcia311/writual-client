import Groq from 'groq-sdk';
import type { AIProvider, CompletionParams, CompletionResult, CompletionUsage, ProviderStatus } from './types';
import { parseAndValidateChunkJSON } from '../chunkNormalize';

const PROVIDER_NAME = 'groq';
const WINDOW = 20;

export class GroqProvider implements AIProvider {
  private readonly groq: Groq;
  private readonly timeoutMs: number;
  private recentLatencies: number[] = [];
  private recentOutcomes: boolean[] = [];

  constructor(apiKey: string, timeoutMs: number) {
    this.groq = new Groq({ apiKey });
    this.timeoutMs = timeoutMs;
  }

  validateConfig(): void {
    const key = process.env.GROQ_API_KEY ?? '';
    if (!key) throw new Error('GROQ_API_KEY env var is not set');
  }

  async generateCompletion(params: CompletionParams): Promise<CompletionResult> {
    const estimatedInput = Math.ceil(params.userMessage.length * params.tokensPerChar);
    if (estimatedInput + params.maxOutputTokens > params.contextWindowTokens * 0.85) {
      throw new Error(
        `Chunk ~${estimatedInput} estimated tokens exceeds 85% of ${params.contextWindowTokens} context window for "${params.model}". Lower chunkMaxChars in ai-config.json.`,
      );
    }

    const start = Date.now();
    const completion = await this.groq.chat.completions.create(
      {
        model: params.model,
        temperature: params.temperature,
        max_tokens: params.maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userMessage },
        ],
      },
      { signal: AbortSignal.timeout(this.timeoutMs) },
    );
    const latencyMs = Date.now() - start;

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from Groq');

    const parsed = parseAndValidateChunkJSON(raw);

    const usage: CompletionUsage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      latencyMs,
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
        cacheRead: null,
        cacheWrite: null,
      },
      latencyMs,
    }));

    return { ...parsed, usage };
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
    return [process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'];
  }

  private recordResult(latencyMs: number, success: boolean): void {
    this.recentLatencies.push(latencyMs);
    this.recentOutcomes.push(success);
    if (this.recentLatencies.length > WINDOW) this.recentLatencies.shift();
    if (this.recentOutcomes.length > WINDOW) this.recentOutcomes.shift();
  }
}
