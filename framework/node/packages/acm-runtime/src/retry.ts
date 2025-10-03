// Retry logic with backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: {
    attempts: number;
    backoff: 'fixed' | 'exp';
    baseMs?: number;
    jitter?: boolean;
  }
): Promise<T> {
  const baseMs = config.baseMs ?? 1000;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      
      if (attempt < config.attempts - 1) {
        let delayMs = baseMs;
        
        if (config.backoff === 'exp') {
          delayMs = baseMs * Math.pow(2, attempt);
        }
        
        if (config.jitter) {
          delayMs = delayMs * (0.5 + Math.random() * 0.5);
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
