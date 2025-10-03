#!/usr/bin/env node

// ACM Demo CLI - End-to-end example
import { DefaultStreamSink } from '@acm/sdk';
import { MemoryLedger, executePlan } from '@acm/runtime';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
import { LLMPlanner } from '@acm/planner';
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

// Parse command-line arguments
function parseArgs(): {
  provider: 'ollama' | 'vllm';
  model: string;
  baseUrl?: string;
  engine: 'runtime' | 'langgraph' | 'msaf';
  goal: 'refund' | 'issues';
  stream: boolean;
  saveBundle: boolean;
} {
  const args = process.argv.slice(2);
  const parsed: any = {
    provider: 'ollama',
    model: 'llama3.1',
    engine: 'runtime',
    goal: 'refund',
    stream: true,
    saveBundle: false,
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
  -h, --help                  Show this help

Examples:
  acm-demo --provider ollama --model llama3.1 --goal refund
  acm-demo --provider vllm --model qwen2.5:7b --engine runtime
  acm-demo --goal issues --save-bundle
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
    console.log(`Context Ref: ${plannerResult.contextRef}`);
    console.log(`Tasks: ${plan.tasks.length}`);
    console.log();

    // Create policy engine
    const policy = new SimplePolicyEngine();

    // Create ledger
    const ledger = new MemoryLedger();

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

    if (config.engine === 'runtime') {
      console.log('⚙️  Executing with ACM runtime...\n');
      result = await executePlan({
        goal,
        context,
        plan,
        capabilityRegistry,
        toolRegistry,
        policy,
        verify,
        stream: config.stream ? stream : undefined,
        ledger,
      });
    } else if (config.engine === 'langgraph') {
      console.log('⚙️  LangGraph adapter not yet implemented');
      console.log('   Falling back to runtime...\n');
      result = await executePlan({
        goal,
        context,
        plan,
        capabilityRegistry,
        toolRegistry,
        policy,
        verify,
        stream: config.stream ? stream : undefined,
        ledger,
      });
    } else if (config.engine === 'msaf') {
      console.log('⚙️  MS Agent Framework adapter not yet implemented');
      console.log('   Falling back to runtime...\n');
      result = await executePlan({
        goal,
        context,
        plan,
        capabilityRegistry,
        toolRegistry,
        policy,
        verify,
        stream: config.stream ? stream : undefined,
        ledger,
      });
    }

    if (!result) {
      throw new Error('Execution failed');
    }

    // Render summary
    renderer.renderSummary(result);

    // Save bundle if requested
    if (config.saveBundle) {
      console.log('\n💾 Saving replay bundle...');
      // TODO: Implement replay bundle export
      console.log('   (Replay bundle export not yet implemented)');
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
