import type { Nucleus } from './nucleus.js';

// Core types for ACM v0.5

export type GoalCard = {
  id: string;
  intent: string;
  actors?: string[];
  constraints?: Record<string, any>;
  acceptance?: {
    must_include?: string[];
    verification_refs?: string[];
  };
  policy_context?: {
    policy_sheet?: string;
    approvals_required?: Array<{ role: string; validUntil?: string }>;
  };
  context_required?: boolean; // Optional for backward compatibility
  contextRef?: string;
  metadata?: Record<string, any>;
};

// Backward compatibility alias
export type Goal = GoalCard;

export type ContextPacket = {
  id: string;
  version?: string;
  sources?: Array<{
    uri: string;
    digest: string;
    type?: string;
  }>;
  facts: Record<string, any>;
  assumptions?: string[];
  constraints_inherited?: Record<string, any>;
  augmentations?: Array<{
    type: string;
    artifact: string;
  }>;
  provenance?: {
    retrieval_snapshot?: string;
    llm?: {
      provider: string;
      model: string;
      temperature?: number;
    };
    prompt_digest?: string;
    [key: string]: any;
  };
};

// Backward compatibility alias
export type Context = ContextPacket;

export type GuardExpr = string; // boolean expression over {context, outputs, policy}

export type TaskSpec = {
  id: string;
  capabilityRef?: string; // name@version format (preferred)
  capability?: string; // Backward compatibility, use capabilityRef
  input?: any;
  policyInput?: Record<string, unknown>;
  verificationRefs?: string[];
  verification?: string[]; // Backward compatibility
  idemKey?: string;
  retryPolicy?: {
    maxAttempts?: number;
    backoffSeconds?: number[];
    retryOn?: string[];
  };
  retry?: { // Backward compatibility
    attempts: number;
    backoff: 'fixed' | 'exp';
    baseMs?: number;
    jitter?: boolean;
  };
  compensation?: {
    capabilityRef: string;
    triggerOn?: string[];
  };
  tools?: Array<{
    name: string;
    version: string;
    timeout_sec?: number;
  }>;
  nucleusRef?: string;
  internalTools?: Array<{
    name: string;
    version?: string;
  }>;
  telemetry?: {
    tracing?: {
      otelSpanName?: string;
      attributes?: Record<string, any>;
    };
  };
};

export type PlanEdge = {
  from: string;
  to: string;
  guard?: GuardExpr;
  onError?: 'RETRYABLE_ERROR' | 'FATAL_ERROR' | 'COMPENSATION_REQUIRED';
};

export type Plan = {
  id: string;
  contextRef: string;
  capabilityMapVersion: string;
  tasks: TaskSpec[];
  edges: PlanEdge[];
  join?: 'all' | 'any';
  alternatives?: string[];
  rationale?: string;
};

export type PolicyDecision = {
  allow: boolean;
  limits?: {
    timeoutMs?: number;
    retries?: number;
  };
  reason?: string;
};

export type LedgerEntry = {
  id: string;
  ts: number;
  type: 
    | 'PLAN_SELECTED' 
    | 'BRANCH_TAKEN'
    | 'GUARD_EVAL' 
    | 'TASK_START' 
    | 'TASK_END' 
    | 'POLICY_PRE' 
    | 'POLICY_POST'
    | 'POLICY_DECISION'
    | 'VERIFICATION' 
    | 'ERROR' 
    | 'COMPENSATION'
    | 'NUCLEUS_INFERENCE'
    | 'CONTEXT_INTERNALIZED'
    | 'TOOL_CALL';
  details: Record<string, any>;
  digest?: string; // Content hash for tamper detection
  signature?: string; // Optional cryptographic signature
};

export type Capability = {
  name: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  sideEffects?: boolean;
};

export type StreamSink = {
  attach(source: string, callback: (chunk: any) => void): void;
  emit(source: string, chunk: any): void;
  close(source: string): void;
};

export type RunContext = {
  goal: Goal;
  context: Context;
  outputs: Record<string, any>;
  metrics: {
    costUsd: number;
    elapsedSec: number;
  };
  getTool(name: string): any;
  getCapabilityRegistry(): any;
  stream?: StreamSink;
  nucleus: Nucleus;
  internalContext?: InternalContextScope;
};

// Tool call envelope for structured tool invocations
export type ToolCallEnvelope = {
  id: string;
  name: string;
  version?: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    timestamp: number;
    duration_ms?: number;
    digest?: string;
  };
};

// Planner-specific tool call schema
export type PlannerToolCall = {
  toolName: string;
  input: Record<string, any>;
  expectedOutputType: string;
  promptDigest?: string;
  alternativeIds?: string[];
};

// Internal context scope for Nucleus
export type InternalContextScope = {
  artifacts: Array<{
    id: string;
    type: string;
    content: any;
    digest: string;
    provenance?: {
      retrievedAt: number;
      tool?: string;
      rationale?: string;
    };
  }>;
  promote(artifactId: string): Promise<void>;
  getArtifact(id: string): any;
};
