#!/usr/bin/env node

// ACM Demo CLI - End-to-end example
import { DefaultStreamSink } from '@acm/sdk';
import { MemoryLedger, executePlan, executeResumablePlan, FileCheckpointStore } from '@acm/runtime';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
import { LLMPlanner } from '@acm/planner';
import { asLangGraph, wrapAgentNodes } from '@acm/adapters';
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

// Parse command-line arguments
function parseArgs(): {
  provider: 'ollama' | 'vllm';
  model: string;
  baseUrl?: string;
  engine: 'runtime' | 'langgraph' | 'msaf';
  goal: 'refund' | 'issues';
  stream: boolean;
  saveBundle: boolean;
  useMcp: boolean;
  mcpServer?: string;
  resume?: string;
  checkpointDir?: string;
} {
  const args = process.argv.slice(2);
  const parsed: any = {
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
      parsed.provider = next;
      i++;
    } else if (arg === '--model' && next) {
      parsed.model = next;
      i++;
    } else if (arg === '--base-url' && next) {
      parsed.baseUrl = next;
      i++;
    } else if (arg === '--engine' && next) {
      parsed.engine = next;
      i++;
    } else if (arg === '--goal' && next) {
      parsed.goal = next;
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

async function main() {
  const config = parseArgs();

  console.log('🚀 ACM v0.5 Demo CLI');
  console.log('='.repeat(60));
  console.log(`Provider: ${config.provider}`);
  console.log(`Model: ${config.model}`);
  console.log(`Engine: ${config.engine}`);
  console.log(`Goal: ${config.goal}`);
  console.log('='.repeat(60));
  console.log();

  // Create LLM client
  const llm =
    config.provider === 'ollama'
      ? createOllamaClient(config.model, config.baseUrl)
      : createVLLMClient(config.model, config.baseUrl);

  // Setup registries
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

  // Get goal and context
  const goal = goals[config.goal];
  const context = contexts[config.goal];

  if (!goal || !context) {
    console.error(`Unknown goal: ${config.goal}`);
    process.exit(1);
  }

  // Setup streaming
  const stream = new DefaultStreamSink();
  const renderer = new CLIRenderer();

  if (config.stream) {
    stream.attach('planner', chunk => renderer.renderPlannerToken(chunk));
    stream.attach('task', update => renderer.renderTaskUpdate(update));
  }

  // Create planner
  const planner = new LLMPlanner();

  console.log('📋 Planning...\n');

  try {
    // Generate plans
    const plannerResult = await planner.plan({
      goal,
      context,
      capabilities: capabilityRegistry.list(),
      llm,
      stream: config.stream ? stream : undefined,
    });

    console.log(`\n✅ Plans generated: ${plannerResult.plans.length}`);
    if (plannerResult.rationale) {
      console.log(`Rationale: ${plannerResult.rationale}`);
    }

    // Select first plan (Plan-A)
    const plan = plannerResult.plans[0];
    console.log(`\n📋 Executing Plan: ${plan.id}`);
    
    // Compute context ref (hash)
    const contextPacket = JSON.stringify(context);
    const contextRef = crypto.createHash('sha256').update(contextPacket).digest('hex');
    console.log(`Context Ref: ${contextRef}`);
    console.log(`Tasks: ${plan.tasks.length}`);
    console.log();

    // Create policy engine
    const policy = new SimplePolicyEngine();

    // Create ledger
    const ledger = new MemoryLedger();
    
    // Track task I/O for replay bundle
    const taskIO: TaskIORecord[] = [];

    // Verification function
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

    // Execute based on engine
    let result;
    const runId = config.resume || `run-${Date.now()}`;
    const startedAt = new Date().toISOString();
    
    // Setup checkpoint store if resume is enabled or runtime engine
    const checkpointDir = config.checkpointDir || './checkpoints';
    const checkpointStore = new FileCheckpointStore(checkpointDir);

    // Add checkpoint event listener
    if (config.stream) {
      stream.attach('checkpoint', (update: any) => {
        console.log(`💾 Checkpoint created: ${update.checkpointId} (${update.tasksCompleted} tasks completed)`);
      });
    }

    if (config.engine === 'runtime') {
      if (config.resume) {
        console.log(`⚙️  Resuming execution from checkpoint...\n`);
        result = await executeResumablePlan({
          goal,
          context,
          plan,
          capabilityRegistry,
          toolRegistry,
          policy,
          verify,
          stream: config.stream ? stream : undefined,
          ledger,
          runId,
          resumeFrom: config.resume,
          checkpointStore,
          checkpointInterval: 1,
        });
      } else {
        console.log('⚙️  Executing with ACM runtime (with checkpointing)...\n');
        result = await executeResumablePlan({
          goal,
          context,
          plan,
          capabilityRegistry,
          toolRegistry,
          policy,
          verify,
          stream: config.stream ? stream : undefined,
          ledger,
          runId,
          checkpointStore,
          checkpointInterval: 1,
        });
      }
    } else if (config.engine === 'langgraph') {
      console.log('⚙️  Executing with LangGraph adapter...\n');
      if (config.resume) {
        console.warn('⚠️  Resume not supported for LangGraph adapter, ignoring --resume flag');
      }
      const adapter = asLangGraph({
        goal,
        context,
        plan,
        capabilityRegistry,
        toolRegistry,
        policy,
        stream: config.stream ? stream : undefined,
        ledger,
      });
      result = await adapter.execute();
    } else if (config.engine === 'msaf') {
      console.log('⚙️  Executing with MS Agent Framework adapter...\n');
      if (config.resume) {
        console.warn('⚠️  Resume not supported for MSAF adapter, ignoring --resume flag');
      }
      const adapter = wrapAgentNodes({
        goal,
        context,
        plan,
        capabilityRegistry,
        toolRegistry,
        policy,
        stream: config.stream ? stream : undefined,
        ledger,
      });
      result = await adapter.execute();
    }

    if (!result) {
      throw new Error('Execution failed');
    }

    const completedAt = new Date().toISOString();

    // Render summary
    renderer.renderSummary(result);

    // Save bundle if requested
    if (config.saveBundle) {
      console.log('\n💾 Saving replay bundle...');
      
      // Prepare task I/O from outputs
      for (const taskSpec of plan.tasks) {
        const output = result.outputsByTask?.[taskSpec.id];
        if (output) {
          taskIO.push({
            taskId: taskSpec.id,
            capability: taskSpec.capabilityRef || taskSpec.capability || 'unknown',
            input: taskSpec.input || {},
            output,
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
        ledger: ledger.getEntries() as any[],
        taskIO,
        engineTrace: {
          runId,
          engine: config.engine,
          startedAt,
          completedAt,
          status: 'success',
          tasks: plan.tasks.map(t => ({
            taskId: t.id,
            status: 'completed',
            startedAt,
            completedAt,
          })),
        },
      });
      
      console.log(`   ✅ Bundle saved to: ${bundlePath}`);
    }

    console.log('\n✅ Demo completed successfully!');
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
