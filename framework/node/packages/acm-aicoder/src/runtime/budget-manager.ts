// Budget Manager for cost control
// Enforces spending limits and tracks usage across the session

import {
  ProviderMetadata,
  getProviderMetadata,
  estimateTokenCount,
  estimateCost,
} from '../config/providers.js';

export interface BudgetEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface BudgetStatus {
  totalSpentUsd: number;
  limitUsd?: number;
  remainingUsd?: number;
  percentUsed?: number;
  callCount: number;
}

export class BudgetManager {
  private metadata: ProviderMetadata;
  private limitUsd?: number;
  private spentUsd: number = 0;
  private callCount: number = 0;
  
  constructor(model: string, limitUsd?: number) {
    this.metadata = getProviderMetadata(model);
    this.limitUsd = limitUsd;
  }
  
  /**
   * Check if a planned inference fits within budget
   * @param inputText Text to send to LLM
   * @param estimatedOutputTokens Estimated response length
   * @returns Budget estimate or throws if over budget
   */
  checkBudget(inputText: string, estimatedOutputTokens: number = 1000): BudgetEstimate {
    const inputTokens = estimateTokenCount(inputText);
    const cost = estimateCost(inputTokens, estimatedOutputTokens, this.metadata);
    
    const estimate: BudgetEstimate = {
      inputTokens,
      outputTokens: estimatedOutputTokens,
      estimatedCostUsd: cost,
    };
    
    // If no limit, allow everything
    if (!this.limitUsd) {
      return estimate;
    }
    
    // Check if this would exceed budget
    const projectedTotal = this.spentUsd + cost;
    if (projectedTotal > this.limitUsd) {
      throw new BudgetExceededError(
        `Budget limit exceeded: ${projectedTotal.toFixed(4)} > ${this.limitUsd}`,
        estimate,
        this.getStatus()
      );
    }
    
    return estimate;
  }
  
  /**
   * Record actual spend after an inference completes
   * @param actualInputTokens Actual input tokens used
   * @param actualOutputTokens Actual output tokens generated
   */
  recordSpend(actualInputTokens: number, actualOutputTokens: number): void {
    const cost = estimateCost(actualInputTokens, actualOutputTokens, this.metadata);
    this.spentUsd += cost;
    this.callCount += 1;
  }
  
  /**
   * Get current budget status
   */
  getStatus(): BudgetStatus {
    const status: BudgetStatus = {
      totalSpentUsd: this.spentUsd,
      limitUsd: this.limitUsd,
      callCount: this.callCount,
    };
    
    if (this.limitUsd !== undefined) {
      status.remainingUsd = Math.max(0, this.limitUsd - this.spentUsd);
      status.percentUsed = (this.spentUsd / this.limitUsd) * 100;
    }
    
    return status;
  }
  
  /**
   * Get provider metadata
   */
  getMetadata(): ProviderMetadata {
    return this.metadata;
  }
  
  /**
   * Reset budget tracking
   */
  reset(): void {
    this.spentUsd = 0;
    this.callCount = 0;
  }
}

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public estimate: BudgetEstimate,
    public status: BudgetStatus
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}
