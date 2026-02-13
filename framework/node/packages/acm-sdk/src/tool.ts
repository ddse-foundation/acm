// ACM Tool — first-class tool abstraction with spec metadata

/**
 * Declarative tool specification.
 * Describes what a tool does, what it accepts, and its constraints.
 * The planner uses this to select tools; the executor uses it for validation.
 */
export interface ToolSpec {
  /** Unique tool identifier (e.g. 'fs.readLines', 'context.retrieve') */
  id: string;
  /** Human-friendly display name */
  name?: string;
  /** LLM-facing description — tells the planner what this tool does */
  description?: string;
  /** JSON Schema for input validation ({ type: 'object', properties, required }) */
  inputSchema?: Record<string, any>;
  /** Output artifact type hint (e.g. 'ADR', 'CDR') */
  outputArtifactType?: string;
  /** Model preference for tools that benefit from a specific model class */
  modelPreference?: 'reasoning' | 'coder' | 'either';
  /** Capability tags for planner selection (e.g. 'retrieve', 'generate') */
  capabilities?: string[];
  /** Resource limits and side-effect declarations */
  limits?: ToolLimits;
}

export interface ToolLimits {
  maxTokens?: number;
  maxRuntimeMs?: number;
  sideEffects?: Array<'fileRead' | 'fileWrite' | 'network' | 'shell'>;
}

/**
 * Structured tool invocation result.
 */
export interface ToolResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  metrics?: { tokensIn?: number; tokensOut?: number; runtimeMs?: number };
}

/**
 * Tool execution function signature.
 */
export type ToolExecuteFn = (inputs: any, context?: any) => Promise<ToolResult>;

/**
 * Abstract base for all ACM tools.
 *
 * A Tool has a ToolSpec (identity + schema + metadata) and a call() method.
 * Host apps create concrete tools; the framework invokes them through the
 * ToolRegistry during plan execution.
 */
export abstract class Tool<I = any, O = any> {
  abstract name(): string;
  abstract call(input: I, idemKey?: string): Promise<O>;

  /** Tool specification — identity, schema, description, limits */
  spec?: ToolSpec;

  /** Convenience: get the spec id (falls back to name()) */
  get id(): string {
    return this.spec?.id ?? this.name();
  }
}
