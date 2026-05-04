import * as fs from 'fs';
import * as path from 'path';

const SUPPORTED_VERSION = '1';

export interface ModelLimits {
  chunkMaxChars: number;
  maxOutputTokensPerChunk: number;
  contextWindowTokens: number;
  tokensPerChar: number;
}

export interface CircuitBreakerConfig {
  errorThresholdRate: number;
  windowSize: number;
  cooldownMs: number;
}

export interface AIConfig {
  version: string;
  provider: 'groq' | 'claude' | 'mock';
  model: string;
  cachingEnabled: boolean;
  requestTimeoutMs: number;
  chunkInterDelayMs: number;
  temperature: number;
  maxConcurrency: number;
  maxTotalChunksPerRequest: number;
  maxTotalTokensPerRequest: number;
  maxInputTokensPerRequest: number;
  circuitBreaker: CircuitBreakerConfig;
  activeLimits: ModelLimits;
}

const FALLBACK_LLAMA_LIMITS: ModelLimits = {
  chunkMaxChars: 4500,
  maxOutputTokensPerChunk: 2048,
  contextWindowTokens: 32768,
  tokensPerChar: 0.33,
};

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  errorThresholdRate: 0.2,
  windowSize: 10,
  cooldownMs: 60_000,
};

function applyModelLimitDefaults(raw: Partial<ModelLimits>): ModelLimits {
  return {
    chunkMaxChars: raw.chunkMaxChars ?? 4500,
    maxOutputTokensPerChunk: raw.maxOutputTokensPerChunk ?? 2048,
    contextWindowTokens: raw.contextWindowTokens ?? 32768,
    tokensPerChar: raw.tokensPerChar ?? 0.33,
  };
}

function applyCircuitBreakerDefaults(raw?: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  if (!raw) return DEFAULT_CIRCUIT_BREAKER;
  return {
    errorThresholdRate: raw.errorThresholdRate ?? DEFAULT_CIRCUIT_BREAKER.errorThresholdRate,
    windowSize: raw.windowSize ?? DEFAULT_CIRCUIT_BREAKER.windowSize,
    cooldownMs: raw.cooldownMs ?? DEFAULT_CIRCUIT_BREAKER.cooldownMs,
  };
}

export function loadAIConfig(): AIConfig {
  // Pre-flight: INTERNAL_SERVICE_SECRET must be set regardless of provider
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? '';
  if (!secret) {
    throw new Error(
      '[writual-ai] INTERNAL_SERVICE_SECRET env var is not set. This is required for route authentication.',
    );
  }

  const configPath = path.resolve(__dirname, '..', 'ai-config.json');

  if (!fs.existsSync(configPath)) {
    // Backward-compat fallback when no config file exists
    const legacyModel = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
    console.warn(
      `[writual-ai] ai-config.json not found; defaulting to groq/${legacyModel}`,
    );
    return {
      version: SUPPORTED_VERSION,
      provider: 'groq',
      model: legacyModel,
      cachingEnabled: false,
      requestTimeoutMs: 60_000,
      chunkInterDelayMs: 200,
      temperature: 0.15,
      maxConcurrency: 1,
      maxTotalChunksPerRequest: 50,
      maxTotalTokensPerRequest: 250_000,
      maxInputTokensPerRequest: 150_000,
      circuitBreaker: DEFAULT_CIRCUIT_BREAKER,
      activeLimits: FALLBACK_LLAMA_LIMITS,
    };
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

  // Version check
  const version = typeof raw.version === 'string' ? raw.version : undefined;
  if (!version) {
    console.warn('[writual-ai] ai-config.json is missing "version" field. Expected version "1".');
  } else if (version !== SUPPORTED_VERSION) {
    console.warn(
      `[writual-ai] ai-config.json version "${version}" is unsupported. Expected "${SUPPORTED_VERSION}".`,
    );
  }

  const provider = raw.provider;
  if (provider !== 'groq' && provider !== 'claude' && provider !== 'mock') {
    throw new Error(
      `[writual-ai] ai-config.json "provider" must be "groq", "claude", or "mock". Got: ${String(provider)}`,
    );
  }

  const model = raw.model;
  if (typeof model !== 'string' || !model.trim()) {
    throw new Error('[writual-ai] ai-config.json "model" must be a non-empty string.');
  }

  // Resolve active model limits
  const modelsMap = raw.models as Record<string, Partial<ModelLimits>> | undefined;
  const rawLimits = modelsMap?.[model.trim()];
  if (!rawLimits && provider !== 'mock') {
    throw new Error(
      `[writual-ai] No limits defined for model "${model}" in ai-config.json. Add an entry to the "models" map.`,
    );
  }
  const activeLimits = rawLimits ? applyModelLimitDefaults(rawLimits) : FALLBACK_LLAMA_LIMITS;

  return {
    version: version ?? SUPPORTED_VERSION,
    provider,
    model: model.trim(),
    cachingEnabled: raw.cachingEnabled === true,
    requestTimeoutMs:
      typeof raw.requestTimeoutMs === 'number' && raw.requestTimeoutMs > 0
        ? raw.requestTimeoutMs
        : provider === 'claude' ? 120_000 : 60_000,
    chunkInterDelayMs:
      typeof raw.chunkInterDelayMs === 'number' && raw.chunkInterDelayMs >= 0
        ? raw.chunkInterDelayMs
        : 200,
    temperature:
      typeof raw.temperature === 'number' ? raw.temperature : 0.15,
    maxConcurrency:
      typeof raw.maxConcurrency === 'number' && raw.maxConcurrency >= 1
        ? Math.floor(raw.maxConcurrency)
        : 1,
    maxTotalChunksPerRequest:
      typeof raw.maxTotalChunksPerRequest === 'number' && raw.maxTotalChunksPerRequest > 0
        ? raw.maxTotalChunksPerRequest
        : 50,
    maxTotalTokensPerRequest:
      typeof raw.maxTotalTokensPerRequest === 'number' && raw.maxTotalTokensPerRequest > 0
        ? raw.maxTotalTokensPerRequest
        : 250_000,
    maxInputTokensPerRequest:
      typeof raw.maxInputTokensPerRequest === 'number' && raw.maxInputTokensPerRequest > 0
        ? raw.maxInputTokensPerRequest
        : 150_000,
    circuitBreaker: applyCircuitBreakerDefaults(
      raw.circuitBreaker as Partial<CircuitBreakerConfig> | undefined,
    ),
    activeLimits,
  };
}
