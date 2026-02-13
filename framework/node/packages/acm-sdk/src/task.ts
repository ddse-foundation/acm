// Abstract Task class
import type { RunContext } from './types.js';
import type { Nucleus, NucleusFactory } from './nucleus.js';

/**
 * Task metadata — declarative properties for planner, registry, and validation.
 * Tasks set these as instance properties; the framework reads them during
 * registration and plan execution.
 */
export interface TaskMetadata<I = any> {
  /** Human-readable task title */
  title?: string;
  /** Description shown to the LLM planner for capability selection */
  description?: string;
  /** Classifier tags (e.g. 'artifact', 'coding', 'git') */
  tags?: string[];
  /** JSON‑Schema for input validation */
  inputSchema?: Record<string, any>;
  /** JSON‑Schema for output validation */
  outputSchema?: Record<string, any>;
  /** Tool IDs this task needs the executor to expose */
  exposedTools?: string[];
  /** Resume / dedup checkpoint labels */
  checkpoints?: string[];
  /** Default input values merged before execution */
  defaultInput?: Partial<I>;
}

export abstract class Task<I = any, O = any> {
  // Metadata fields — set by subclass constructors
  title?: string;
  description?: string;
  tags?: string[];
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  exposedTools?: string[];
  checkpoints?: string[];
  defaultInput?: Partial<I>;

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
