import type { AIProvider, CompletionParams, CompletionResult, ProviderStatus } from './types';
import type { ScriptBlock } from '../screenplaySchema';

const DEFAULT_BLOCKS: ScriptBlock[] = [
  {
    type: 'scriptBlock',
    attrs: { elementType: 'action' },
    content: [{ type: 'text', text: 'Mock action block.' }],
  },
];

export class MockProvider implements AIProvider {
  private readonly blocks: ScriptBlock[];

  constructor(blocks?: ScriptBlock[]) {
    this.blocks = blocks ?? DEFAULT_BLOCKS;
  }

  async generateCompletion(params: CompletionParams): Promise<CompletionResult> {
    return {
      content: this.blocks,
      titleHint: params.chunkIndex === 0 ? 'Mock Title' : null,
      logline: params.chunkIndex === 0 ? 'A mock logline for testing.' : null,
      authors: params.chunkIndex === 0 ? ['Mock Author'] : null,
      genre: params.chunkIndex === 0 ? 'Drama' : null,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
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
