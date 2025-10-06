import {
  DeterministicNucleus,
  ExternalContextProviderAdapter,
  type CapabilityRegistry,
  type Context,
  type Goal,
  type LedgerEntry,
  type LLMCallFn,
  type NucleusConfig,
  type NucleusFactory,
  type Plan,
  type PolicyEngine,
  type StreamSink,
  type ToolRegistry,
} from '@ddse/acm-sdk';
import {
  StructuredLLMPlanner,
  type PlannerOptions,
  type PlannerResult,
} from '@ddse/acm-planner';
import {
  executeResumablePlan,
  MemoryLedger,
  type ExecutePlanResult,
  type ResumableExecutePlanOptions,
} from '@ddse/acm-runtime';
import { LangGraphAdapter, MSAgentFrameworkAdapter } from '@ddse/acm-adapters';

export type PlanSelector = (result: PlannerResult) => Plan;

export enum ExecutionEngine {
  ACM = 'ACM',
  LANGGRAPH = 'LANGGRAPH',
  MSAF = 'MSAF',
}

export interface ACMExecutionOptions {
  engine?: ExecutionEngine;
  resumeFrom?: ResumableExecutePlanOptions['resumeFrom'];
  checkpointInterval?: ResumableExecutePlanOptions['checkpointInterval'];
  checkpointStore?: ResumableExecutePlanOptions['checkpointStore'];
  runId?: ResumableExecutePlanOptions['runId'];
}

export interface ACMFrameworkOptions {
  capabilityRegistry: CapabilityRegistry;
  toolRegistry: ToolRegistry;
  policyEngine?: PolicyEngine;
  contextProvider?: ExternalContextProviderAdapter;
  planner?: {
    instance?: StructuredLLMPlanner;
    planCount?: PlannerOptions['planCount'];
    selector?: PlanSelector;
  };
  nucleus: {
    call: LLMCallFn;
    llmConfig: NucleusConfig['llmCall'];
    hooks?: NucleusConfig['hooks'];
    allowedTools?: string[];
    factory?: (ledger: MemoryLedger) => NucleusFactory;
  };
  verify?: ResumableExecutePlanOptions['verify'];
  defaultStream?: StreamSink;
  execution?: ACMExecutionOptions;
}

export interface ACMPlanRequest {
  goal: string | Goal;
  context?: Context;
  planCount?: PlannerOptions['planCount'];
  stream?: StreamSink;
  planSelector?: PlanSelector;
  ledger?: MemoryLedger;
}

export interface ACMPlanResponse {
  goal: Goal;
  context: Context;
  result: PlannerResult;
  selectedPlan: Plan;
  ledger: readonly LedgerEntry[];
}

export interface ACMExecuteRequest extends ACMPlanRequest {
  verify?: ResumableExecutePlanOptions['verify'];
  planSelector?: PlanSelector;
  engine?: ExecutionEngine;
  resumeFrom?: ResumableExecutePlanOptions['resumeFrom'];
  checkpointInterval?: ResumableExecutePlanOptions['checkpointInterval'];
  checkpointStore?: ResumableExecutePlanOptions['checkpointStore'];
  runId?: ResumableExecutePlanOptions['runId'];
  ledger?: MemoryLedger;
  existingPlan?: {
    plan: Plan;
    plannerResult: PlannerResult;
  };
}

export interface ACMExecuteResult {
  goal: Goal;
  context: Context;
  plan: Plan;
  planner: PlannerResult;
  execution: ExecutePlanResult;
}

export class ACMFramework {
  static create(options: ACMFrameworkOptions): ACMFramework {
    return new ACMFramework(options);
  }

  private readonly capabilityRegistry: CapabilityRegistry;
  private readonly toolRegistry: ToolRegistry;
  private readonly policyEngine?: PolicyEngine;
  private readonly contextProvider?: ExternalContextProviderAdapter;
  private readonly planner: StructuredLLMPlanner;
  private readonly defaultPlanCount: PlannerOptions['planCount'];
  private readonly planSelector: PlanSelector;
  private readonly nucleusOptions: ACMFrameworkOptions['nucleus'];
  private readonly defaultVerify?: ResumableExecutePlanOptions['verify'];
  private readonly defaultStream?: StreamSink;
  private readonly executionDefaults: Required<Pick<ACMExecutionOptions, 'engine'>> & Omit<ACMExecutionOptions, 'engine'>;

  private constructor(options: ACMFrameworkOptions) {
    this.capabilityRegistry = options.capabilityRegistry;
    this.toolRegistry = options.toolRegistry;
    this.policyEngine = options.policyEngine;
    this.contextProvider = options.contextProvider;
    this.planner = options.planner?.instance ?? new StructuredLLMPlanner();
    this.defaultPlanCount = options.planner?.planCount ?? 1;
    this.planSelector = options.planner?.selector ?? ((result) => {
      if (!result.plans.length) {
        throw new Error('Planner did not return any plans.');
      }
      return result.plans[0];
    });
    this.nucleusOptions = options.nucleus;
    this.defaultVerify = options.verify;
    this.defaultStream = options.defaultStream;
    const executionDefaults = options.execution ?? {};
    this.executionDefaults = {
      engine: executionDefaults.engine ?? ExecutionEngine.ACM,
      resumeFrom: executionDefaults.resumeFrom,
      checkpointInterval: executionDefaults.checkpointInterval,
      checkpointStore: executionDefaults.checkpointStore,
      runId: executionDefaults.runId,
    };
  }

  async plan(request: ACMPlanRequest): Promise<ACMPlanResponse> {
    const goal = normalizeGoal(request.goal);
    const context = normalizeContext(request.context);
    const planCount = request.planCount ?? this.defaultPlanCount;
    const stream = request.stream ?? this.defaultStream;
    const ledger = request.ledger ?? new MemoryLedger();
    const nucleusFactory = this.getNucleusFactory(ledger);
    const plannerResult = await this.planner.plan({
      goal,
      context,
      capabilities: this.capabilityRegistry.list(),
      nucleusFactory,
      nucleusConfig: {
        llmCall: this.nucleusOptions.llmConfig,
        hooks: this.nucleusOptions.hooks,
        allowedTools: this.nucleusOptions.allowedTools,
      },
      stream,
      planCount,
    });

    if (!plannerResult.plans.length) {
      throw new Error('Planner did not emit any plans.');
    }

  const selector = request.planSelector ?? this.planSelector;
    const selectedPlan = selector(plannerResult);

    return {
      goal,
      context,
      result: plannerResult,
      selectedPlan,
      ledger: ledger.getEntries(),
    };
  }

  async execute(request: ACMExecuteRequest): Promise<ACMExecuteResult> {
    const goal = normalizeGoal(request.goal);
    const context = normalizeContext(request.context);
    const planCount = request.planCount ?? this.defaultPlanCount;
    const stream = request.stream ?? this.defaultStream;
    const verify = request.verify ?? this.defaultVerify;
    const engine = request.engine ?? this.executionDefaults.engine;
    const resumeFrom = request.resumeFrom ?? this.executionDefaults.resumeFrom;
    const checkpointInterval = request.checkpointInterval ?? this.executionDefaults.checkpointInterval;
    const checkpointStore = request.checkpointStore ?? this.executionDefaults.checkpointStore;
    const runId = request.runId ?? this.executionDefaults.runId;

    const ledger = request.ledger ?? new MemoryLedger();
    const nucleusFactory = this.getNucleusFactory(ledger);
    let plannerResult: PlannerResult;
    let plan: Plan;

    if (request.existingPlan) {
      plannerResult = request.existingPlan.plannerResult;
      plan = request.existingPlan.plan;
    } else {
      plannerResult = await this.planner.plan({
        goal,
        context,
        capabilities: this.capabilityRegistry.list(),
        nucleusFactory,
        nucleusConfig: {
          llmCall: this.nucleusOptions.llmConfig,
          hooks: this.nucleusOptions.hooks,
          allowedTools: this.nucleusOptions.allowedTools,
        },
        stream,
        planCount,
      });

      if (!plannerResult.plans.length) {
        throw new Error('Planner did not emit any plans.');
      }

      const selector = request.planSelector ?? this.planSelector;
      plan = selector(plannerResult);
    }

    let execution: ExecutePlanResult;

    switch (engine) {
      case ExecutionEngine.LANGGRAPH: {
        const adapter = new LangGraphAdapter({
          goal,
          context,
          plan,
          capabilityRegistry: this.capabilityRegistry,
          toolRegistry: this.toolRegistry,
          policy: this.policyEngine,
          stream,
          ledger,
          nucleusFactory,
          nucleusConfig: {
            llmCall: this.nucleusOptions.llmConfig,
            hooks: this.nucleusOptions.hooks,
            allowedTools: this.nucleusOptions.allowedTools,
          },
        });
  const result = await adapter.execute();
  execution = this.toExecutionResult(result.outputsByTask, result.ledger as LedgerEntry[]);
        break;
      }
      case ExecutionEngine.MSAF: {
        const adapter = new MSAgentFrameworkAdapter({
          goal,
          context,
          plan,
          capabilityRegistry: this.capabilityRegistry,
          toolRegistry: this.toolRegistry,
          policy: this.policyEngine,
          stream,
          ledger,
          nucleusFactory,
          nucleusConfig: {
            llmCall: this.nucleusOptions.llmConfig,
            hooks: this.nucleusOptions.hooks,
            allowedTools: this.nucleusOptions.allowedTools,
          },
        });
        const result = await adapter.execute();
        execution = this.toExecutionResult(result.outputsByTask, result.ledger as LedgerEntry[]);
        break;
      }
      case ExecutionEngine.ACM:
      default: {
        execution = await executeResumablePlan({
          goal,
          context,
          plan,
          capabilityRegistry: this.capabilityRegistry,
          toolRegistry: this.toolRegistry,
          policy: this.policyEngine,
          verify,
          stream,
          ledger,
          nucleusFactory,
          nucleusConfig: {
            llmCall: this.nucleusOptions.llmConfig,
            hooks: this.nucleusOptions.hooks,
            allowedTools: this.nucleusOptions.allowedTools,
          },
          contextProvider: this.contextProvider,
          resumeFrom,
          checkpointInterval,
          checkpointStore,
          runId,
        });
        break;
      }
    }

    return {
      goal,
      context,
      plan,
      planner: plannerResult,
      execution,
    };
  }

  private getNucleusFactory(ledger: MemoryLedger): NucleusFactory {
    if (this.nucleusOptions.factory) {
      return this.nucleusOptions.factory(ledger);
    }

    return (config: NucleusConfig) =>
      new DeterministicNucleus(config, this.nucleusOptions.call, (entry: LedgerEntry) => {
        ledger.append(entry.type, entry.details);
      });
  }

  private toExecutionResult(outputsByTask: Record<string, any>, ledger: readonly LedgerEntry[]): ExecutePlanResult {
    const taskRecords = Object.fromEntries(
      Object.entries(outputsByTask).map(([taskId, output]) => [taskId, { output }])
    );

    return {
      outputsByTask: taskRecords,
      ledger,
    };
  }
}

function normalizeGoal(input: string | Goal): Goal {
  if (typeof input === 'string') {
    return {
      id: `goal-${Date.now()}`,
      intent: input,
    };
  }

  return {
    ...input,
    id: input.id ?? `goal-${Date.now()}`,
  };
}

function normalizeContext(context?: Context): Context {
  if (!context) {
    return {
      id: `ctx-${Date.now()}`,
      facts: {},
    };
  }

  return {
    ...context,
    id: context.id ?? `ctx-${Date.now()}`,
    facts: context.facts ?? {},
  };
}
