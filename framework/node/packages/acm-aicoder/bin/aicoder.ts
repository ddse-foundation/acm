#!/usr/bin/env node

// ACM AI Coder CLI - Production-ready developer workflow automation
import { DefaultStreamSink } from '@acm/sdk';
import { MemoryLedger, executeResumablePlan, FileCheckpointStore } from '@acm/runtime';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
import { LLMPlanner } from '@acm/planner';
import enquirer from 'enquirer';
import chalk from 'chalk';
import {
  CodeReadTool,
  CodeEditTool,
  CodeAnalyzeTool,
  TestRunnerTool,
  AnalyzeCodebaseTask,
  FixBugTask,
  ImplementFeatureTask,
  RunTestsTask,
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
  SimplePolicyEngine,
  CLIRenderer,
  goals,
  contexts,
} from '../src/index.js';

// Parse command-line arguments
function parseArgs(): {
  provider: 'ollama' | 'vllm';
  model: string;
  baseUrl?: string;
  goal: 'analyze' | 'fixBug' | 'implementFeature' | 'runTests' | 'custom';
  stream: boolean;
  autoApprove: boolean;
  dryRun: boolean;
  resume?: string;
  checkpointDir?: string;
  analysisOnly: boolean;
} {
  const args = process.argv.slice(2);
  const parsed: any = {
    provider: 'ollama',
    model: 'llama3.1',
    goal: 'analyze',
    stream: true,
    autoApprove: false,
    dryRun: false,
    analysisOnly: false,
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
    } else if (arg === '--goal' && next) {
      parsed.goal = next;
      i++;
    } else if (arg === '--no-stream') {
      parsed.stream = false;
    } else if (arg === '--auto-approve') {
      parsed.autoApprove = true;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--analysis-only') {
      parsed.analysisOnly = true;
    } else if (arg === '--resume' && next) {
      parsed.resume = next;
      i++;
    } else if (arg === '--checkpoint-dir' && next) {
      parsed.checkpointDir = next;
      i++;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
${chalk.bold.cyan('ACM AI Coder CLI')} - Production-ready developer workflow automation

${chalk.bold('Usage:')} acm-aicoder [options]

${chalk.bold('Options:')}
  --provider <ollama|vllm>    LLM provider (default: ollama)
  --model <name>              Model name (default: llama3.1)
  --base-url <url>            Override API base URL
  --goal <goal>               Goal to execute:
                              - analyze: Analyze codebase
                              - fixBug: Fix a bug with AI assistance
                              - implementFeature: Scaffold new feature
                              - runTests: Run test suite
                              - custom: Interactive custom goal
  --no-stream                 Disable streaming output
  --auto-approve              Auto-approve all operations (use with caution!)
  --dry-run                   Preview changes without writing files
  --analysis-only             Only analyze, don't make changes
  --resume <runId>            Resume from a previous execution
  --checkpoint-dir <path>     Directory for checkpoint storage (default: ./checkpoints)
  -h, --help                  Show this help

${chalk.bold('Examples:')}
  # Analyze a codebase
  acm-aicoder --goal analyze

  # Fix a bug with AI assistance
  acm-aicoder --goal fixBug --dry-run

  # Implement a new feature (with approval)
  acm-aicoder --goal implementFeature

  # Resume from checkpoint
  acm-aicoder --resume run-1234567890

  # Use custom LLM
  acm-aicoder --provider vllm --model qwen2.5:7b --base-url http://localhost:8000
  `);
}

async function promptForApproval(message: string): Promise<boolean> {
  const response = await enquirer.prompt<{ approve: boolean }>({
    type: 'confirm',
    name: 'approve',
    message: chalk.yellow(message),
    initial: false,
  });
  return response.approve;
}

async function selectPlan(plans: any[]): Promise<any> {
  if (plans.length === 1) {
    return plans[0];
  }

  const choices = plans.map((plan, idx) => ({
    name: `Plan ${String.fromCharCode(65 + idx)} - ${plan.tasks.length} tasks`,
    value: idx,
  }));

  const response = await enquirer.prompt<{ planIndex: number }>({
    type: 'select',
    name: 'planIndex',
    message: 'Select a plan to execute:',
    choices,
  });

  return plans[response.planIndex];
}

async function main() {
  const config = parseArgs();

  // Render header
  const renderer = new CLIRenderer();
  renderer.renderHeader('🚀 ACM AI Coder CLI v0.1');
  
  console.log(`${chalk.bold('Provider:')} ${config.provider}`);
  console.log(`${chalk.bold('Model:')} ${config.model}`);
  console.log(`${chalk.bold('Goal:')} ${config.goal}`);
  console.log(`${chalk.bold('Mode:')} ${config.dryRun ? 'Dry Run' : config.analysisOnly ? 'Analysis Only' : 'Live'}`);
  console.log();

  // Create LLM client
  const llm =
    config.provider === 'ollama'
      ? createOllamaClient(config.model, config.baseUrl)
      : createVLLMClient(config.model, config.baseUrl);

  // Setup registries
  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new CodeReadTool());
  toolRegistry.register(new CodeEditTool());
  toolRegistry.register(new CodeAnalyzeTool());
  toolRegistry.register(new TestRunnerTool());

  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'analyze_codebase', sideEffects: false },
    new AnalyzeCodebaseTask()
  );
  capabilityRegistry.register(
    { name: 'fix_bug', sideEffects: true },
    new FixBugTask()
  );
  capabilityRegistry.register(
    { name: 'implement_feature', sideEffects: true },
    new ImplementFeatureTask()
  );
  capabilityRegistry.register(
    { name: 'run_tests', sideEffects: false },
    new RunTestsTask()
  );

  // Get goal and context
  let goal, context;
  
  if (config.goal === 'custom') {
    // Interactive custom goal
    const response = await enquirer.prompt<{ intent: string }>({
      type: 'input',
      name: 'intent',
      message: 'Describe what you want to accomplish:',
    });
    
    goal = {
      id: 'goal-custom-1',
      intent: response.intent,
      constraints: {},
    };
    
    context = {
      id: 'ctx-custom-1',
      facts: { customGoal: true },
      version: '1.0',
    };
  } else {
    goal = goals[config.goal];
    context = contexts[config.goal];
  }

  if (!goal || !context) {
    renderer.renderError(`Unknown goal: ${config.goal}`);
    process.exit(1);
  }

  // Setup streaming
  const stream = new DefaultStreamSink();

  if (config.stream) {
    stream.attach('planner', chunk => renderer.renderPlannerToken(chunk));
    stream.attach('task', update => renderer.renderTaskUpdate(update));
    stream.attach('checkpoint', update => renderer.renderCheckpoint(update));
  }

  // Create planner
  const planner = new LLMPlanner();
  
  renderer.renderInfo('Planning...');
  console.log();

  try {
    // Generate plans
    const plannerResult = await planner.plan({
      goal,
      context,
      capabilities: capabilityRegistry.list(),
      llm,
      stream: config.stream ? stream : undefined,
    });

    console.log();
    renderer.renderSuccess(`Plans generated: ${plannerResult.plans.length}`);
    
    if (plannerResult.rationale) {
      console.log(chalk.gray(`Rationale: ${plannerResult.rationale}`));
    }

    // Select plan
    const plan = await selectPlan(plannerResult.plans);
    
    console.log();
    renderer.renderInfo(`Selected Plan: ${plan.id}`);
    console.log(`${chalk.bold('Tasks:')} ${plan.tasks.length}`);
    
    // Show task list
    plan.tasks.forEach((task: any) => {
      console.log(`  ${chalk.gray('•')} ${task.id}: ${task.capability}`);
    });

    // Request approval if not auto-approved
    if (!config.autoApprove && !config.dryRun && !config.analysisOnly) {
      console.log();
      const approved = await promptForApproval('Execute this plan?');
      if (!approved) {
        renderer.renderWarning('Execution cancelled by user');
        process.exit(0);
      }
    }

    // Create policy engine
    const policy = new SimplePolicyEngine();
    policy.setAllowedPaths(['*']); // Allow all paths for demo
    
    // Modify context for dry-run or analysis-only modes
    if (config.dryRun || config.analysisOnly) {
      plan.tasks.forEach((task: any) => {
        if (task.input) {
          task.input.dryRun = true;
        }
      });
    }

    // Create ledger
    const ledger = new MemoryLedger();

    // Execute based on mode
    let result;
    const runId = config.resume || `run-${Date.now()}`;
    
    // Setup checkpoint store
    const checkpointDir = config.checkpointDir || './checkpoints';
    const checkpointStore = new FileCheckpointStore(checkpointDir);

    console.log();
    if (config.resume) {
      renderer.renderInfo('Resuming execution from checkpoint...');
    } else {
      renderer.renderInfo('Executing with ACM runtime (with checkpointing)...');
    }
    console.log();

    // Verification function
    const verify = async (taskId: string, output: any, expressions: string[]): Promise<boolean> => {
      for (const expr of expressions) {
        try {
          const func = new Function('output', `return ${expr};`);
          const verifyResult = func(output);
          if (!verifyResult) {
            renderer.renderError(`Verification failed for ${taskId}: ${expr}`);
            return false;
          }
        } catch (err) {
          renderer.renderError(`Verification error for ${taskId}: ${expr}`);
          return false;
        }
      }
      return true;
    };

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

    // Display results
    console.log();
    renderer.renderSummary(result);

    if (config.dryRun) {
      renderer.renderWarning('Dry run mode: No files were modified');
    } else if (config.analysisOnly) {
      renderer.renderInfo('Analysis only mode: No changes were made');
    } else {
      renderer.renderSuccess('Execution completed successfully!');
    }

    // Show checkpoint info
    console.log();
    renderer.renderInfo(`Checkpoints saved to: ${checkpointDir}`);
    renderer.renderInfo(`Run ID: ${runId}`);
    console.log();
    renderer.renderInfo('To resume this run: acm-aicoder --resume ' + runId);
    console.log();

  } catch (error: any) {
    console.log();
    renderer.renderError('Execution failed');
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
