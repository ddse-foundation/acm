// Abstract Task class
import type { RunContext } from './types.js';

export abstract class Task<I = any, O = any> {
  constructor(
    public id: string,
    public capability: string
  ) {}

  abstract execute(ctx: RunContext, input: I): Promise<O>;

  // Optional: idempotency key
  idemKey?(ctx: RunContext, input: I): string | undefined;

  // Optional: policy input
  policyInput?(ctx: RunContext, input: I): Record<string, unknown>;

  // Optional: verification expressions
  verification?(): string[];
}
