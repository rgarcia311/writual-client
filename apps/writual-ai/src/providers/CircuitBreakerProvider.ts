import type {
  AIProvider,
  CircuitState,
  JsonEnrichmentParams,
  JsonEnrichmentResult,
  ProviderStatus,
} from './types';
import type { CircuitBreakerConfig } from '../aiConfig';

export class CircuitBreakerProvider implements AIProvider {
  private state: CircuitState = 'CLOSED';
  private openUntil: number | null = null;
  private halfOpenInProgress = false;
  private recentOutcomes: boolean[] = [];

  constructor(
    private readonly inner: AIProvider,
    private readonly cfg: CircuitBreakerConfig,
  ) {}

  async generateJsonEnrichment(
    params: JsonEnrichmentParams,
  ): Promise<JsonEnrichmentResult> {
    if (this.state === 'OPEN') {
      if (Date.now() < (this.openUntil ?? 0)) {
        throw new Error(
          `[circuit-breaker] Provider OPEN. Cooldown until ${new Date(this.openUntil!).toISOString()}`,
        );
      }
      this.state = 'HALF_OPEN';
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenInProgress) {
      throw new Error('[circuit-breaker] Provider HALF_OPEN, test request already in flight');
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenInProgress = true;
    }

    try {
      const result = await this.inner.generateJsonEnrichment(params);
      this.record(true);
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.halfOpenInProgress = false;
        console.log(
          JSON.stringify({ event: 'circuit_closed', correlationId: params.correlationId }),
        );
      }
      return result;
    } catch (e) {
      this.record(false);
      if (this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.openUntil = Date.now() + this.cfg.cooldownMs;
        this.halfOpenInProgress = false;
      }
      throw e;
    }
  }

  private record(success: boolean): void {
    this.recentOutcomes.push(success);
    if (this.recentOutcomes.length > this.cfg.windowSize) this.recentOutcomes.shift();

    if (this.state === 'CLOSED' && this.recentOutcomes.length >= this.cfg.windowSize) {
      const errors = this.recentOutcomes.filter((s) => !s).length;
      const rate = errors / this.recentOutcomes.length;
      if (rate >= this.cfg.errorThresholdRate) {
        this.state = 'OPEN';
        this.openUntil = Date.now() + this.cfg.cooldownMs;
        console.error(
          JSON.stringify({
            event: 'circuit_open',
            errorRate: rate,
            cooldownMs: this.cfg.cooldownMs,
          }),
        );
      }
    }
  }

  getProviderStatus(): ProviderStatus {
    const innerStatus = this.inner.getProviderStatus?.();
    const n = this.recentOutcomes.length;
    const errors = this.recentOutcomes.filter((s) => !s).length;
    return {
      isReady: this.state === 'CLOSED',
      circuitState: this.state,
      avgLatencyMs: innerStatus?.avgLatencyMs ?? null,
      errorRate: n > 0 ? errors / n : null,
      totalCompletions: innerStatus?.totalCompletions ?? n,
    };
  }

  validateConfig(): void {
    this.inner.validateConfig?.();
  }

  getSupportedModels(): string[] {
    return this.inner.getSupportedModels?.() ?? [];
  }
}
