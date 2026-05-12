import type { AIConfig } from '../aiConfig';
import type { AIProvider } from './types';
import { GroqProvider } from './groqProvider';
import { ClaudeProvider } from './claudeProvider';
import { MockProvider } from './mock';
import { CircuitBreakerProvider } from './CircuitBreakerProvider';

export function createProvider(config: AIConfig): AIProvider {
  const isTest = process.env.NODE_ENV === 'test';
  const isDev = process.env.NODE_ENV === 'development';

  if (isTest || config.provider === 'mock') {
    return new MockProvider();
  }

  if (isDev && config.provider === 'claude') {
    console.warn(
      '[writual-ai] WARNING: Using production Claude provider in development. Consider "provider": "mock" for local testing.',
    );
  }

  let rawProvider: AIProvider;

  if (config.provider === 'groq') {
    rawProvider = new GroqProvider(process.env.GROQ_API_KEY ?? '', config.requestTimeoutMs);
  } else if (config.provider === 'claude') {
    rawProvider = new ClaudeProvider(
      process.env.ANTHROPIC_API_KEY ?? '',
      config.cachingEnabled,
      config.requestTimeoutMs,
    );
  } else {
    throw new Error(`Unknown provider: ${String((config as { provider: unknown }).provider)}`);
  }

  rawProvider.validateConfig?.();
  return new CircuitBreakerProvider(rawProvider, config.circuitBreaker);
}
