// Core types for ACM v0.5

export type Goal = {
  id: string;
  intent: string;
  constraints?: Record<string, any>;
};

export type Context = {
  id: string;
  facts: Record<string, any>;
  version?: string;
};

export type GuardExpr = string; // boolean expression over {context, outputs, policy}

export type TaskSpec = {
  id: string;
  capability: string;
  input?: any;
  retry?: {
    attempts: number;
    backoff: 'fixed' | 'exp';
    baseMs?: number;
    jitter?: boolean;
  };
  verification?: string[];
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
  type: 'PLAN_SELECTED' | 'GUARD_EVAL' | 'TASK_START' | 'TASK_END' | 'POLICY_PRE' | 'POLICY_POST' | 'VERIFICATION' | 'ERROR' | 'COMPENSATION';
  details: Record<string, any>;
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
};
