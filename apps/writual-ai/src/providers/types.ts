import type { ScreenplayDoc } from '../screenplaySchema';

export interface CompletionParams {
  systemPrompt: string;
  userMessage: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  contextWindowTokens: number;
  tokensPerChar: number;
  chunkIndex: number;
  totalChunks: number;
  isLastChunk: boolean;
  correlationId: string;
  projectId?: string;
}

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

export interface CompletionResult {
  content: ScreenplayDoc['content'];
  titleHint?: string | null;
  logline?: string | null;
  authors?: string[] | null;
  genre?: string | null;
  usage?: CompletionUsage;
}

export interface AIProvider {
  generateCompletion(params: CompletionParams): Promise<CompletionResult>;
  validateConfig?(): void;
  getProviderStatus?(): ProviderStatus;
  getSupportedModels?(): string[];
}
