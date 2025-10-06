#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, exit } from 'node:process';

import {
  DefaultStreamSink,
  ExternalContextProviderAdapter,
  type LLMCallFn,
  type Plan,
  normalizePlan,
  normalizePlannerResult,
  type NormalizedPlannerResult,
} from '@acm/sdk';
import { MemoryLedger, FileCheckpointStore } from '@acm/runtime';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
import type { LLM, ToolCall } from '@acm/llm';
import { ACMFramework, ExecutionEngine } from '@acm/framework';
import { ReplayBundleExporter, type TaskIORecord } from '@acm/replay';

import { SimpleCapabilityRegistry, SimpleToolRegistry } from '../src/registries.js';
import { SimplePolicyEngine } from '../src/policy.js';
import { CLIRenderer } from '../src/renderer.js';
import { registerExampleContextProviders } from '../src/context/index.js';
import { getScenario, listScenarioKeys, scenarios, type ScenarioDefinition } from '../src/examples/scenarios.js';

type LLMProvider = 'ollama' | 'vllm';

type CLIOptions = {
  scenarioKey?: string;
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  engine: ExecutionEngine;
  stream: boolean;
  resume?: string;
  checkpointDir: string;
  saveBundle: boolean;
  listOnly: boolean;
};

type RawCLIArgs = {
  scenario?: string;
  goal?: string;
  provider?: string;
  model?: string;
  'base-url'?: string;
  engine?: string;
  stream?: boolean;
  resume?: string;
  'checkpoint-dir'?: string;
  'save-bundle'?: boolean;
  list?: boolean;
  help?: boolean;
};

type PlanTask = NonNullable<Plan['tasks']>[number];

const defaultModelByProvider: Record<LLMProvider, string> = {
  ollama: 'llama3.1',
  vllm: 'qwen2.5:7b',
};

function printHelp(): void {
  console.log(
    `ACM Demo CLI\n\n` +
      `Usage:\n` +
      `  acm-demo [options]\n\n` +
      `Options:\n` +
      `  --scenario <key>         Scenario key to execute (${listScenarioKeys().join(', ')})\n` +
      `  --list                   List available scenarios and exit\n` +
      `  --provider <ollama|vllm> LLM provider (default: ollama)\n` +
      `  --model <name>           Model identifier (defaults per provider)\n` +
      `  --base-url <url>         Override LLM endpoint\n` +
      `  --engine <acm|langgraph|msaf> Execution engine (default: acm)\n` +
      `  --resume <runId>         Resume a prior ACM engine run\n` +
      `  --checkpoint-dir <dir>   Directory for checkpoints (default: ./checkpoints)\n` +
      `  --no-stream              Disable streaming updates\n` +
      `  --save-bundle            Export a replay bundle to ./replay/<runId>/\n` +
      `  -h, --help               Show this help message\n`
  );
}

function mapLegacyGoal(goal?: string): string | undefined {
  if (!goal) return undefined;
  switch (goal.toLowerCase()) {
    case 'refund':
      return 'entitlement';
    case 'issues':
      return 'knowledge';
    default:
      return goal;
  }
}

function resolveExecutionEngine(engine?: string): ExecutionEngine {
  if (!engine) {
    return ExecutionEngine.ACM;
  }

  const normalized = engine.toUpperCase();
  switch (normalized) {
    case 'ACM':
      return ExecutionEngine.ACM;
    case 'LANGGRAPH':
    case 'LANG-GRAPH':
    case 'LANG_GRAPH':
      return ExecutionEngine.LANGGRAPH;
    case 'MSAF':
    case 'MS_AGENT_FRAMEWORK':
    case 'MS-AGENT-FRAMEWORK':
      return ExecutionEngine.MSAF;
    default:
      throw new Error(`Unsupported execution engine: ${engine}`);
  }
}

function parseCliOptions(): { options: CLIOptions; showHelp: boolean } {
  const { values } = parseArgs({
    options: {
      scenario: { type: 'string' },
      goal: { type: 'string' },
      provider: { type: 'string' },
      model: { type: 'string' },
      'base-url': { type: 'string' },
      engine: { type: 'string' },
      stream: { type: 'boolean', default: true },
      resume: { type: 'string' },
      'checkpoint-dir': { type: 'string' },
      'save-bundle': { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  }) as { values: RawCLIArgs };

  const provider = (values.provider ?? 'ollama').toLowerCase();
  if (provider !== 'ollama' && provider !== 'vllm') {
    throw new Error(`Unsupported provider: ${values.provider}`);
  }

  const engine = resolveExecutionEngine(values.engine);

  const scenarioKey = values.scenario ?? mapLegacyGoal(values.goal);
  const model = values.model ?? defaultModelByProvider[provider as LLMProvider];
  return {
    options: {
      scenarioKey,
      provider: provider as LLMProvider,
      model,
      baseUrl: values['base-url'],
      engine,
      stream: values.stream ?? true,
      resume: values.resume,
      checkpointDir: values['checkpoint-dir'] ?? './checkpoints',
      saveBundle: values['save-bundle'] ?? false,
      listOnly: values.list ?? false,
    },
    showHelp: Boolean(values.help),
  };
}

async function resolveScenario(options: CLIOptions): Promise<ScenarioDefinition> {
  if (options.scenarioKey) {
    const direct = getScenario(options.scenarioKey);
    if (!direct) {
      throw new Error(`Unknown scenario: ${options.scenarioKey}`);
    }
    return direct;
  }

  if (!output.isTTY) {
    throw new Error('No scenario provided and terminal is non-interactive. Use --scenario <key>.');
  }

  console.log('Please choose a scenario to run:\n');
  const keys = listScenarioKeys();
  keys.forEach((key, index) => {
    const scenario = scenarios[key];
    console.log(`  [${index + 1}] ${scenario.name} (${key})`);
    console.log(`      ${scenario.description}`);
  });
  console.log();

  const rl = createInterface({ input, output });
  try {
    while (true) {
      const answer = (await rl.question('Enter scenario number or key: ')).trim();
      if (!answer) {
        continue;
      }

      const numeric = Number.parseInt(answer, 10);
      if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= keys.length) {
        return scenarios[keys[numeric - 1]];
      }

      const byKey = getScenario(answer);
      if (byKey) {
        return byKey;
      }

      console.log(`Invalid selection: ${answer}`);
    }
  } finally {
    rl.close();
  }
}

function createLLMClient(provider: LLMProvider, model: string, baseUrl?: string): LLM {
  switch (provider) {
    case 'ollama':
      return createOllamaClient(model, baseUrl);
    case 'vllm':
      return createVLLMClient(model, baseUrl);
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }
}

function attachStreaming(renderer: CLIRenderer, stream: DefaultStreamSink): void {
  stream.attach('planner', chunk => renderer.renderPlannerToken(chunk));
  stream.attach('task', update => renderer.renderTaskUpdate(update));
  stream.attach('checkpoint', update => {
    if (typeof update?.checkpointId === 'string') {
      console.log(`💾 Checkpoint created: ${update.checkpointId} (${update.tasksCompleted} tasks completed)`);
    }
  });
}


async function main(): Promise<void> {
  const { options, showHelp } = parseCliOptions();

  if (showHelp) {
    printHelp();
    return;
  }

  if (options.listOnly) {
    console.log('Available scenarios:\n');
    listScenarioKeys().forEach(key => {
      const scenario = scenarios[key];
      console.log(`- ${key}: ${scenario.name}`);
      console.log(`    ${scenario.description}`);
    });
    return;
  }

  const scenario = await resolveScenario(options);

  console.log(`\n🎯 Scenario: ${scenario.name}`);
  console.log(`   Key: ${scenario.key}`);
  console.log(`   Description: ${scenario.description}\n`);

  const toolRegistry = new SimpleToolRegistry();
  const capabilityRegistry = new SimpleCapabilityRegistry();
  scenario.registerTools(toolRegistry);
  scenario.registerCapabilities(capabilityRegistry);

  const adapter = new ExternalContextProviderAdapter();
  registerExampleContextProviders(adapter);

  const llm = createLLMClient(options.provider, options.model, options.baseUrl);
  const stream = new DefaultStreamSink();
  const renderer = new CLIRenderer();

  if (options.stream) {
    attachStreaming(renderer, stream);
  }

  const verify = async (taskId: string, output: any, expressions: string[]): Promise<boolean> => {
    for (const expr of expressions) {
      try {
        const fn = new Function('output', `return ${expr};`);
        const result = fn(output);
        if (!result) {
          console.error(`Verification failed for ${taskId}: ${expr}`);
          return false;
        }
      } catch (error) {
        console.error(`Verification error for ${taskId}: ${expr}`, error);
        return false;
      }
    }
    return true;
  };

  const nucleusLLMCall: LLMCallFn = async (prompt, tools, callConfig) => {
    const toolDefs = tools.map(tool => ({
      name: tool.name,
      description: tool.description ?? 'Nucleus tool',
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
    }));

    const response = await llm.generateWithTools!(
      [
        {
          role: 'system',
          content: prompt,
        },
      ],
      toolDefs,
      {
        temperature: callConfig.temperature,
        seed: callConfig.seed,
        maxTokens: callConfig.maxTokens,
      }
    );

    const responseToolCalls = (response.toolCalls ?? []) as ToolCall[];
    const toolCalls = responseToolCalls.map(tc => ({
      id: tc.id,
      name: tc.name,
      input: tc.arguments,
    }));

    return {
      reasoning: response.text,
      toolCalls,
      raw: response.raw,
    };
  };

  const nucleusConfig = {
    llmCall: {
      provider: llm.name(),
      model: options.model,
      temperature: 0.5,
      maxTokens: 8096,
    },
    hooks: {
      preflight: false,
      postcheck: false,
    },
  } as const;

  const framework = ACMFramework.create({
    capabilityRegistry,
    toolRegistry,
    policyEngine: new SimplePolicyEngine(),
    nucleus: {
      call: nucleusLLMCall,
      llmConfig: nucleusConfig.llmCall,
      hooks: nucleusConfig.hooks,
    },
    verify,
    defaultStream: options.stream ? stream : undefined,
    contextProvider: adapter,
  });

  const ledger = new MemoryLedger();
  const checkpointStore = new FileCheckpointStore(options.checkpointDir);
  const runId = options.resume ?? `run-${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log('📋 Planning...\n');
  const planResponse = await framework.plan({
    goal: scenario.goal,
    context: scenario.context,
    stream: options.stream ? stream : undefined,
    ledger,
  });

  const rawPlannerResult = planResponse.result;
  const rawPlan = planResponse.selectedPlan;

  if (!rawPlan) {
    throw new Error('Structured planner did not return a plan');
  }

  const normalizeOptions = {
    capabilityRegistry,
    defaultContextRef: scenario.context.id ?? scenario.key,
    planIdPrefix: `${scenario.key}-plan`,
  } as const;

  const plan = normalizePlan(rawPlan, normalizeOptions);
  const plannerResult: NormalizedPlannerResult = normalizePlannerResult(
    rawPlannerResult,
    plan,
    normalizeOptions
  );

  if (plannerResult?.rationale) {
    console.log('🧠 Planner rationale:\n');
    console.log(plannerResult.rationale);
    console.log();
  }

  if (plannerResult?.plans?.length) {
    console.log('📝 Planner plan summary (first plan):');
    const firstPlan = plannerResult.plans[0];
    console.log(JSON.stringify({
      id: firstPlan.id,
      contextRef: firstPlan.contextRef,
      tasks: (firstPlan.tasks ?? []).map((task: PlanTask) => ({
        id: task.id,
        capability: task.capability ?? task.capabilityRef,
        hasInput: Boolean(task.input && Object.keys(task.input).length > 0),
        inputPreview: task.input ?? null,
      })),
    }, null, 2));
    console.log();
  }

  console.log(`\n✅ Plans generated: ${plannerResult?.plans?.length ?? 0}`);
  if (plan.id) {
    console.log(`Executing plan ${plan.id}`);
  }
  console.log(`Context Ref: ${plan.contextRef ?? 'n/a'}`);
  console.log('Tasks:');
  plan.tasks?.forEach((task: PlanTask, index: number) => {
    console.log(`  ${index + 1}. ${task.id} -> ${task.capability ?? task.capabilityRef ?? 'unknown'}`);
  });
  console.log();

  const executionEngine = options.engine;
  if (executionEngine !== ExecutionEngine.ACM && options.resume) {
    console.warn('⚠️  Resume is only supported with the ACM engine. Ignoring --resume.');
  }

  const executeResult = await framework.execute({
    goal: scenario.goal,
    context: scenario.context,
    stream: options.stream ? stream : undefined,
    engine: executionEngine,
    ledger,
    existingPlan: {
      plan,
      plannerResult,
    },
    resumeFrom: executionEngine === ExecutionEngine.ACM ? options.resume : undefined,
    checkpointStore: executionEngine === ExecutionEngine.ACM ? checkpointStore : undefined,
    checkpointInterval: executionEngine === ExecutionEngine.ACM ? 1 : undefined,
    runId,
  });

  const completedAt = new Date().toISOString();

  renderer.renderSummary(executeResult.execution);
  scenario.assertExecution(executeResult.execution);

  if (options.saveBundle) {
    console.log('\n💾 Saving replay bundle...');
    const taskIO: TaskIORecord[] = [];
    for (const taskSpec of plan.tasks as PlanTask[]) {
      const record = executeResult.execution.outputsByTask?.[taskSpec.id];
      if (record?.output !== undefined) {
        taskIO.push({
          taskId: taskSpec.id,
          capability: taskSpec.capabilityRef || taskSpec.capability || 'unknown',
          input: taskSpec.input || {},
          output: record.output,
          ts: new Date().toISOString(),
        });
      }
    }

    const bundlePath = await ReplayBundleExporter.export({
      outputDir: `./replay/${runId}`,
      goal: scenario.goal,
      context: scenario.context,
      plans: plannerResult.plans,
      selectedPlanId: plan.id,
      ledger: Array.from(executeResult.execution.ledger) as any[],
      taskIO,
      engineTrace: {
        runId,
        engine: executionEngine,
        startedAt,
        completedAt,
        status: 'success',
        tasks: (plan.tasks as PlanTask[]).map(task => ({
          taskId: task.id,
          status: executeResult.execution.outputsByTask?.[task.id] ? 'completed' : 'skipped',
          startedAt,
          completedAt,
        })),
      },
    });

    console.log(`   ✅ Bundle saved to: ${bundlePath}`);
  }

  console.log('\n✅ Demo completed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    exit(1);
  });
}
