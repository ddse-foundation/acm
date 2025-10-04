// Token budget manager
// Tracks cumulative token usage and ensures calls stay within provider limits

import {
  ProviderMetadata,
  getProviderMetadata,
  estimateTokenCount,
} from '../config/providers.js';

export interface BudgetEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface BudgetStatus {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  maxTokens?: number;
  remainingTokens?: number;
  callCount: number;
}

export class BudgetManager {
  private metadata: ProviderMetadata;
  private maxTokens?: number;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private callCount = 0;

  constructor(model: string, overrideMaxTokens?: number) {
    this.metadata = getProviderMetadata(model);
    this.maxTokens = overrideMaxTokens ?? this.metadata.maxContextTokens;
  }

  /**
   * Estimate whether an upcoming inference fits within the token allowance
   * @param inputText Planned prompt text
   * @param estimatedOutputTokens Rough guess for completion tokens
   */
  checkBudget(inputText: string, estimatedOutputTokens: number = 1000): BudgetEstimate {
    const inputTokens = estimateTokenCount(inputText);
    const totalTokens = inputTokens + estimatedOutputTokens;

    if (this.maxTokens !== undefined) {
      const projected = this.totalTokensConsumed() + totalTokens;
      if (projected > this.maxTokens) {
        throw new TokenBudgetExceededError(
          `Token allowance exceeded: projected ${projected} tokens > limit ${this.maxTokens}`,
          {
            inputTokens,
            outputTokens: estimatedOutputTokens,
            totalTokens,
          },
          this.getStatus()
        );
      }
    }

    return {
      inputTokens,
      outputTokens: estimatedOutputTokens,
      totalTokens,
    };
  }

  /**
   * Record actual token usage after a call completes
   */
  recordUsage(actualInputTokens: number, actualOutputTokens: number): void {
    this.totalInputTokens += actualInputTokens;
    this.totalOutputTokens += actualOutputTokens;
    this.callCount += 1;
  }

  getStatus(): BudgetStatus {
    const totalTokens = this.totalTokensConsumed();
    const status: BudgetStatus = {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens,
      maxTokens: this.maxTokens,
      callCount: this.callCount,
    };

    if (this.maxTokens !== undefined) {
      status.remainingTokens = Math.max(0, this.maxTokens - totalTokens);
    }

    return status;
  }

  getMetadata(): ProviderMetadata {
    return this.metadata;
  }

  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.callCount = 0;
  }

  private totalTokensConsumed(): number {
    return this.totalInputTokens + this.totalOutputTokens;
  }
}

export class TokenBudgetExceededError extends Error {
  constructor(
    message: string,
    public estimate: BudgetEstimate,
    public status: BudgetStatus
  ) {
    super(message);
    this.name = 'TokenBudgetExceededError';
  }
}
