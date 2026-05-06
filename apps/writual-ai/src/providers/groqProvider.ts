import Groq from 'groq-sdk';
import { stripMarkdownJsonWrapper } from '../jsonStrings';
import type {
  AIProvider,
  JsonEnrichmentParams,
  JsonEnrichmentResult,
  CompletionUsage,
  ProviderStatus,
} from './types';

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
    if (!raw) throw new Error('Empty enrichment response from Groq');

    const sanitized = stripMarkdownJsonWrapper(raw.trim());
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitized) as unknown;
    } catch {
      throw new Error('Groq enrichment returned non-JSON');
    }

    const usage: CompletionUsage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      latencyMs,
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
          cacheRead: null,
          cacheWrite: null,
        },
        latencyMs,
      }),
    );

    return { json: parsed, usage };
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
    return [process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'];
  }

  private recordResult(latencyMs: number, success: boolean): void {
    this.recentLatencies.push(latencyMs);
    this.recentOutcomes.push(success);
    if (this.recentLatencies.length > WINDOW) this.recentLatencies.shift();
    if (this.recentOutcomes.length > WINDOW) this.recentOutcomes.shift();
  }
}
