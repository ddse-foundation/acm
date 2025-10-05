#!/usr/bin/env node

// ACM Demo CLI - End-to-end example powered by the ACM Framework helper
import { DefaultStreamSink, type LLMCallFn } from '@acm/sdk';
import { MemoryLedger, FileCheckpointStore } from '@acm/runtime';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
import { ACMFramework, ExecutionEngine } from '@acm/framework';
import { ReplayBundleExporter, type TaskIORecord } from '@acm/replay';
import { goals, contexts } from '../src/goals/index.js';
import {
  SearchTool,
  ExtractEntitiesTool,
  AssessRiskTool,
  CreateRefundTxnTool,
  NotifySupervisorTool,
} from '../src/tools/index.js';
import {
  SearchTask,
  EnrichAndActTask,
  RefundFlowTask,
} from '../src/tasks/index.js';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '../src/registries.js';
import { SimplePolicyEngine } from '../src/policy.js';
import { CLIRenderer } from '../src/renderer.js';
import * as crypto from 'crypto';

type Provider = 'ollama' | 'vllm';
type EngineOption = 'runtime' | 'langgraph' | 'msaf';
type GoalOption = 'refund' | 'issues';

type CliConfig = {
  provider: Provider;
  model: string;
  baseUrl?: string;
  engine: EngineOption;
  goal: GoalOption;
  stream: boolean;
  saveBundle: boolean;
  useMcp: boolean;
  mcpServer?: string;
  resume?: string;
  checkpointDir?: string;
};

// Parse command-line arguments
function parseArgs(): CliConfig {
  const args = process.argv.slice(2);
  const parsed: CliConfig = {
    provider: 'ollama',
    model: 'llama3.1',
    engine: 'runtime',
    goal: 'refund',
    stream: true,
    saveBundle: false,
    useMcp: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--provider' && next) {
      parsed.provider = next as Provider;
      i++;
    } else if (arg === '--model' && next) {
      parsed.model = next;
      i++;
    } else if (arg === '--base-url' && next) {
      parsed.baseUrl = next;
      i++;
    } else if (arg === '--engine' && next) {
      parsed.engine = next as EngineOption;
      i++;
    } else if (arg === '--goal' && next) {
      parsed.goal = next as GoalOption;
      i++;
    } else if (arg === '--no-stream') {
      parsed.stream = false;
    } else if (arg === '--save-bundle') {
      parsed.saveBundle = true;
    } else if (arg === '--use-mcp') {
      parsed.useMcp = true;
    } else if (arg === '--mcp-server' && next) {
      parsed.mcpServer = next;
      i++;
    } else if (arg === '--resume' && next) {
      parsed.resume = next;
      i++;
    } else if (arg === '--checkpoint-dir' && next) {
      parsed.checkpointDir = next;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
ACM Demo CLI - End-to-end ACM v0.5 example

Usage: acm-demo [options]

Options:
  --provider <ollama|vllm>    LLM provider (default: ollama)
  --model <name>              Model name (default: llama3.1)
  --base-url <url>            Override API base URL
  --engine <runtime|langgraph|msaf>  Execution engine (default: runtime)
  --goal <refund|issues>      Goal to execute (default: refund)
  --no-stream                 Disable streaming output
  --save-bundle               Save replay bundle to replay/<runId>/
  --use-mcp                   Enable MCP tool integration
  --mcp-server <command>      MCP server command (e.g., 'npx -y @modelcontextprotocol/server-filesystem /tmp')
  --resume <runId>            Resume from a previous execution
  --checkpoint-dir <path>     Directory for checkpoint storage (default: ./checkpoints)
  -h, --help                  Show this help

Examples:
  acm-demo --provider ollama --model llama3.1 --goal refund
  acm-demo --provider vllm --model qwen2.5:7b --engine langgraph
  acm-demo --goal issues --save-bundle
  acm-demo --engine msaf --use-mcp --mcp-server 'npx -y @modelcontextprotocol/server-filesystem /tmp'
  acm-demo --resume run-1234567890 --checkpoint-dir ./checkpoints
  `);
}

function resolveExecutionEngine(engine: EngineOption): ExecutionEngine {
  switch (engine) {
    case 'langgraph':
      return ExecutionEngine.LANGGRAPH;
    case 'msaf':
      return ExecutionEngine.MSAF;
    case 'runtime':
    default:
      return ExecutionEngine.ACM;
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  console.log('🚀 ACM v0.5 Demo CLI');
  console.log('='.repeat(60));
  console.log(`Provider: ${config.provider}`);
  console.log(`Model: ${config.model}`);
  console.log(`Engine: ${config.engine}`);
  console.log(`Goal: ${config.goal}`);
  console.log('='.repeat(60));
  console.log();

  const llm =
    config.provider === 'ollama'
      ? createOllamaClient(config.model, config.baseUrl)
      : createVLLMClient(config.model, config.baseUrl);

  if (!llm.generateWithTools) {
    throw new Error('Selected LLM provider does not support structured tool calls required by Nucleus.');
  }

  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new SearchTool());
  toolRegistry.register(new ExtractEntitiesTool());
  toolRegistry.register(new AssessRiskTool());
  toolRegistry.register(new CreateRefundTxnTool());
  toolRegistry.register(new NotifySupervisorTool());

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'search', sideEffects: false },
    new SearchTask()
  );
  capabilityRegistry.register(
    { name: 'enrich_and_act', sideEffects: false },
    new EnrichAndActTask()
  );
  capabilityRegistry.register(
    { name: 'refund_flow', sideEffects: true },
    new RefundFlowTask()
  );

  const goal = goals[config.goal];
  const context = contexts[config.goal];

  if (!goal || !context) {
    console.error(`Unknown goal: ${config.goal}`);
    process.exit(1);
  }

  const stream = new DefaultStreamSink();
  const renderer = new CLIRenderer();

  if (config.stream) {
    stream.attach('planner', chunk => renderer.renderPlannerToken(chunk));
    stream.attach('task', update => renderer.renderTaskUpdate(update));
  }

  const verify = async (taskId: string, output: any, expressions: string[]): Promise<boolean> => {
    for (const expr of expressions) {
      try {
        const func = new Function('output', `return ${expr};`);
        const result = func(output);
        if (!result) {
          console.error(`Verification failed for ${taskId}: ${expr}`);
          return false;
        }
      } catch (err) {
        console.error(`Verification error for ${taskId}: ${expr}`, err);
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

    return {
      reasoning: response.text,
      toolCalls: (response.toolCalls ?? []).map(tc => ({
        id: tc.id,
        name: tc.name,
        input: tc.arguments,
      })),
      raw: response.raw,
    };
  };

  const nucleusConfig = {
    llmCall: {
      provider: llm.name(),
      model: config.model,
      temperature: 0.1,
      maxTokens: 512,
    },
    hooks: {
      preflight: true,
      postcheck: true,
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
    defaultStream: config.stream ? stream : undefined,
  });

  const ledger = new MemoryLedger();

  console.log('📋 Planning...\n');

  const planResponse = await framework.plan({
    goal,
    context,
    stream: config.stream ? stream : undefined,
    ledger,
  });

  const plannerResult = planResponse.result;
  const plan = planResponse.selectedPlan;

  console.log(`\n✅ Plans generated: ${plannerResult.plans.length}`);
  if (plannerResult.rationale) {
    console.log(`Rationale: ${plannerResult.rationale}`);
  }

  console.log(`\n📋 Executing Plan: ${plan.id}`);
  const contextPacket = JSON.stringify(planResponse.context);
  const contextRef = plan.contextRef ?? crypto.createHash('sha256').update(contextPacket).digest('hex');
  console.log(`Context Ref: ${contextRef}`);
  console.log(`Tasks: ${plan.tasks.length}`);
  console.log();

  const executionEngine = resolveExecutionEngine(config.engine);

  if (executionEngine !== ExecutionEngine.ACM && config.resume) {
    console.warn('⚠️  Resume not supported for selected engine, ignoring --resume flag');
  }

  const checkpointDir = config.checkpointDir || './checkpoints';
  const checkpointStore = new FileCheckpointStore(checkpointDir);

  if (config.stream) {
    stream.attach('checkpoint', (update: any) => {
      console.log(`💾 Checkpoint created: ${update.checkpointId} (${update.tasksCompleted} tasks completed)`);
    });
  }

  const runId = config.resume || `run-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const executeResult = await framework.execute({
    goal,
    context,
    stream: config.stream ? stream : undefined,
    engine: executionEngine,
    ledger,
    runId,
    existingPlan: {
      plan,
      plannerResult,
    },
    resumeFrom: executionEngine === ExecutionEngine.ACM ? config.resume : undefined,
    checkpointStore: executionEngine === ExecutionEngine.ACM ? checkpointStore : undefined,
    checkpointInterval: executionEngine === ExecutionEngine.ACM ? 1 : undefined,
  });

  const completedAt = new Date().toISOString();

  renderer.renderSummary(executeResult.execution);

  if (config.saveBundle) {
    console.log('\n💾 Saving replay bundle...');

    const taskIO: TaskIORecord[] = [];
    for (const taskSpec of plan.tasks) {
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
      goal,
      context,
      plans: plannerResult.plans,
      selectedPlanId: plan.id,
      ledger: Array.from(executeResult.execution.ledger) as any[],
      taskIO,
      engineTrace: {
        runId,
        engine: config.engine,
        startedAt,
        completedAt,
        status: 'success',
        tasks: plan.tasks.map((task: typeof plan.tasks[number]) => ({
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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
