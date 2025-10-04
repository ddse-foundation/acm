// Abstract Task class
import type { RunContext } from './types.js';
import type { Nucleus, NucleusFactory } from './nucleus.js';

export abstract class Task<I = any, O = any> {
  constructor(
    public id: string,
    public capability: string,
    protected nucleusFactory?: NucleusFactory
  ) {}

  abstract execute(ctx: RunContext, input: I): Promise<O>;

  // Optional: idempotency key
  idemKey?(ctx: RunContext, input: I): string | undefined;

  // Optional: policy input
  policyInput?(ctx: RunContext, input: I): Record<string, unknown>;

  // Optional: verification expressions
  verification?(): string[];

  // Optional: tool bindings for this task
  toolBindings?(): Array<{ name: string; version: string }>;

  // Optional: policy references
  policyRefs?(): string[];

  // Optional: retry policy configuration
  retryPolicy?(): {
    maxAttempts?: number;
    backoffSeconds?: number[];
    retryOn?: string[];
  };

  // Get or create nucleus instance for this task
  protected getNucleus?(ctx: RunContext): Nucleus | undefined;
}
