// Provider metadata for budget governance
// Token costs and context limits per model/provider

export interface ProviderMetadata {
  provider: string;
  model: string;
  
  // Cost per 1M tokens (USD)
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  
  // Context window
  maxContextTokens?: number;
  
  // Concurrency limits
  maxConcurrentRequests?: number;
  
  // Recommended settings
  recommendedTemperature?: number;
  supportsStreaming: boolean;
}

// Provider metadata registry
// Sources: OpenAI pricing, Anthropic pricing, Azure OpenAI, local models
export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  // OpenAI models
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    maxContextTokens: 128000,
    maxConcurrentRequests: 10,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxContextTokens: 128000,
    maxConcurrentRequests: 10,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    inputCostPer1M: 10.00,
    outputCostPer1M: 30.00,
    maxContextTokens: 128000,
    maxConcurrentRequests: 10,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    inputCostPer1M: 0.50,
    outputCostPer1M: 1.50,
    maxContextTokens: 16385,
    maxConcurrentRequests: 10,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  
  // Anthropic models
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    maxContextTokens: 200000,
    maxConcurrentRequests: 5,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'claude-3-sonnet-20240229': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    maxContextTokens: 200000,
    maxConcurrentRequests: 5,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'claude-3-haiku-20240307': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    maxContextTokens: 200000,
    maxConcurrentRequests: 5,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  
  // Local/self-hosted models (no cost)
  'llama3.1': {
    provider: 'ollama',
    model: 'llama3.1',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    maxContextTokens: 128000,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'qwen2.5:7b': {
    provider: 'ollama',
    model: 'qwen2.5:7b',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    maxContextTokens: 32768,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
  'deepseek-coder': {
    provider: 'ollama',
    model: 'deepseek-coder',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    maxContextTokens: 16000,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  },
};

export function getProviderMetadata(model: string): ProviderMetadata {
  // Try exact match first
  if (PROVIDER_METADATA[model]) {
    return PROVIDER_METADATA[model];
  }
  
  // Try prefix match (e.g., "gpt-4o-2024-05-13" matches "gpt-4o")
  for (const [key, metadata] of Object.entries(PROVIDER_METADATA)) {
    if (model.startsWith(key)) {
      return metadata;
    }
  }
  
  // Default metadata for unknown models (assume local/free)
  return {
    provider: 'unknown',
    model,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    maxContextTokens: 8192,
    recommendedTemperature: 0.7,
    supportsStreaming: true,
  };
}

export function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // More accurate would use tiktoken library, but this is sufficient for budget estimation
  return Math.ceil(text.length / 4);
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  metadata: ProviderMetadata
): number {
  if (!metadata.inputCostPer1M || !metadata.outputCostPer1M) {
    return 0;
  }
  
  const inputCost = (inputTokens / 1_000_000) * metadata.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * metadata.outputCostPer1M;
  
  return inputCost + outputCost;
}
