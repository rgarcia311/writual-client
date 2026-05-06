export type EnrichmentKind = 'character_refine' | 'scene_batch';

export interface CompletionUsage {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderStatus {
  isReady: boolean;
  circuitState: CircuitState;
  avgLatencyMs: number | null;
  errorRate: number | null;
  totalCompletions: number;
}

export interface JsonEnrichmentParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  contextWindowTokens: number;
  tokensPerChar: number;
  correlationId: string;
  projectId?: string;
  kind: EnrichmentKind;
}

export interface JsonEnrichmentResult {
  json: unknown;
  usage: CompletionUsage;
}

export interface AIProvider {
  generateJsonEnrichment(params: JsonEnrichmentParams): Promise<JsonEnrichmentResult>;
  validateConfig?(): void;
  getProviderStatus?(): ProviderStatus;
  getSupportedModels?(): string[];
}
