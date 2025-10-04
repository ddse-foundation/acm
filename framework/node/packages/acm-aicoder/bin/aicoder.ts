#!/usr/bin/env node

// ACM AI Coder CLI - Production-ready developer workflow automation
import { DefaultStreamSink } from '@acm/sdk';
import { MemoryLedger, executeResumablePlan, FileCheckpointStore } from '@acm/runtime';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
import { LLMPlanner } from '@acm/planner';
import enquirer from 'enquirer';
import chalk from 'chalk';
import {
  // V2 Tools
  FileStatTool,
  FileReadToolV2,
  FileReadLinesTool,
  DiffTool,
  GrepTool,
  CodeSearchTool,
  CodeEditToolV2,
  RunTestsToolV2,
  BuildTool,
  // V2 Tasks
  AnalyzeWorkspaceTask,
  CollectContextPackTask,
  SearchCodeTask,
  FindSymbolDefinitionTask,
  ImplementFunctionTask,
  RefactorRenameSymbolTask,
  FixTypeErrorTask,
  GenerateUnitTestsTask,
  ReadFileLinesTask,
  DiffFilesTask,
  GrepSearchTask,
  // Registries/Renderer
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
  SimplePolicyEngine,
  CLIRenderer,
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
  workspace?: string;
  plans?: 1 | 2;
} {
  const args = process.argv.slice(2);
  const parsed: any = {
    provider: 'ollama',
    model: 'llama3.1',
  goal: 'custom',
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
    } else if (arg === '--workspace' && next) {
      parsed.workspace = next;
      i++;
    } else if (arg === '--resume' && next) {
      parsed.resume = next;
      i++;
    } else if (arg === '--checkpoint-dir' && next) {
      parsed.checkpointDir = next;
      i++;
    } else if (arg === '--plans' && next) {
      const n = Number(next);
      if (n === 1 || n === 2) {
        parsed.plans = n;
      }
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
  --goal <goal>               Goal to execute (default: custom for chat-first)
                              - custom: Interactive freeform goal (recommended)
                              - analyze: Analyze codebase (uses coder capabilities)
                              - fixBug | implementFeature | runTests: Legacy demos
  --no-stream                 Disable streaming output
  --auto-approve              Auto-approve all operations (use with caution!)
  --dry-run                   Preview changes without writing files
  --analysis-only             Only analyze, don't make changes
  --workspace <path>          Workspace root to analyze/use
  --plans <1|2>               Number of alternative plans to generate (default: 1)
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

async function selectPlan(plans: any[]): Promise<{ plan: any; index: number }> {
  if (!Array.isArray(plans) || plans.length === 0) {
    throw new Error('No plans available to select');
  }
  if (plans.length === 1) {
    return { plan: plans[0], index: 0 };
  }

  const labels = plans.map((p: any, idx: number) => `Plan ${String.fromCharCode(65 + idx)} - ${p.tasks?.length ?? 0} tasks`);
  const choices = labels.map((label, idx) => ({ name: label, value: idx }));

  const response: any = await enquirer.prompt({
    type: 'select',
    name: 'planIndex',
    message: 'Select a plan to execute:',
    choices,
  });

  // Enquirer may return either an object keyed by prompt name, or the raw value directly.
  let planIndex: number | undefined;
  if (typeof response === 'number') {
    planIndex = response;
  } else if (typeof response === 'string') {
    // If a label was returned, map it back to index
    const idx = labels.indexOf(response);
    planIndex = idx >= 0 ? idx : undefined;
  } else if (response && typeof response === 'object' && 'planIndex' in response) {
    planIndex = (response as { planIndex: number }).planIndex;
  }

  if (planIndex === undefined || isNaN(Number(planIndex))) {
    // Fallback to first plan to ensure progress
    planIndex = 0;
  }

  return { plan: plans[planIndex], index: planIndex };
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
  // Determine root for tools
  const toolRoot = config.workspace || process.cwd();
  toolRegistry.register(new FileStatTool());
  toolRegistry.register(new FileReadToolV2());
  toolRegistry.register(new FileReadLinesTool());
  toolRegistry.register(new DiffTool());
  toolRegistry.register(new GrepTool(toolRoot));
  toolRegistry.register(new CodeSearchTool(toolRoot));
  toolRegistry.register(new CodeEditToolV2());
  toolRegistry.register(new RunTestsToolV2());
  toolRegistry.register(new BuildTool());

  const capabilityRegistry = new SimpleCapabilityRegistry();
  // Core analysis/context capabilities
  capabilityRegistry.register({ name: 'analyze_workspace', sideEffects: false }, new AnalyzeWorkspaceTask());
  capabilityRegistry.register({ name: 'collect_context_pack', sideEffects: false }, new CollectContextPackTask());
  capabilityRegistry.register({ name: 'search_code', sideEffects: false }, new SearchCodeTask());
  // Reading/searching/diffing
  capabilityRegistry.register({ name: 'read_file_lines', sideEffects: false }, new ReadFileLinesTask());
  capabilityRegistry.register({ name: 'grep_search', sideEffects: false }, new GrepSearchTask());
  capabilityRegistry.register({ name: 'diff_files', sideEffects: false }, new DiffFilesTask());
  capabilityRegistry.register({ name: 'find_symbol_definition', sideEffects: false }, new FindSymbolDefinitionTask());
  // Dev/editing capabilities
  capabilityRegistry.register({ name: 'implement_function', sideEffects: true }, new ImplementFunctionTask());
  capabilityRegistry.register({ name: 'refactor_rename_symbol', sideEffects: true }, new RefactorRenameSymbolTask());
  capabilityRegistry.register({ name: 'fix_type_error', sideEffects: true }, new FixTypeErrorTask());
  capabilityRegistry.register({ name: 'generate_unit_tests', sideEffects: true }, new GenerateUnitTestsTask());

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
  } else if (config.goal === 'analyze') {
    goal = { id: 'goal-analyze-1', intent: 'Analyze the workspace and surface issues' } as any;
    context = { id: 'ctx-analyze-1', facts: { path: config.workspace || process.cwd() }, version: '1.0' } as any;
  } else {
    // Legacy demos: map to simple intents
    goal = { id: 'goal-legacy-1', intent: `Legacy ${config.goal}` } as any;
    context = { id: 'ctx-legacy-1', facts: {}, version: '1.0' } as any;
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
    // If a workspace path was provided, override context facts for analyze/runTests goals
    if (config.workspace) {
      context = { ...context, facts: { ...context.facts, path: config.workspace, cwd: config.workspace } };
    }

    const plannerOptions: any = {
      goal,
      context,
      capabilities: capabilityRegistry.list(),
      llm,
      stream: config.stream ? stream : undefined,
    };
    if (config.plans) {
      plannerOptions.planCount = config.plans; // optional override
    }

  const plannerResult = await planner.plan(plannerOptions);

    console.log();
    renderer.renderSuccess(`Plans generated: ${plannerResult.plans.length}`);
    
    if (plannerResult.rationale) {
      console.log(chalk.gray(`Rationale: ${plannerResult.rationale}`));
    }

    // Select plan
  const selection = await selectPlan(plannerResult.plans);
  let plan = selection.plan;
  const planLabel = `Plan ${String.fromCharCode(65 + selection.index)}`;
  // Ensure plan has an id for logging and downstream usage
  if (!plan.id) plan.id = planLabel.toLowerCase().replace(/\s+/g, '-');

  // Sanitize plan tasks (LLM output may include leading spaces in keys like " capability")
  const sanitizePlan = (p: any) => {
    if (!p || !Array.isArray(p.tasks)) return p;
    p.tasks = p.tasks.map((t: any) => {
      if (!t || typeof t !== 'object') return t;
      // Fix keys with accidental leading/trailing spaces
      for (const key of Object.keys(t)) {
        const trimmed = key.trim();
        if (trimmed !== key && !(trimmed in t)) {
          (t as any)[trimmed] = (t as any)[key];
          delete (t as any)[key];
        }
      }
      // Normalize capability
      if (typeof t.capability === 'string') {
        t.capability = t.capability.trim();
      }
      // Normalize common input aliases
      if (t.input && typeof t.input === 'object') {
        const inp: any = t.input;
        // Fix keys with spaces
        for (const k of Object.keys(inp)) {
          const trimmed = k.trim();
          if (trimmed !== k && !(trimmed in inp)) {
            inp[trimmed] = inp[k];
            delete inp[k];
          }
        }
        // Map filepath/filePath -> path (tools also accept aliases, but normalize here too)
        if (!inp.path && (inp.filepath || inp.filePath)) {
          inp.path = inp.filepath || inp.filePath;
        }
      }
      return t;
    });
    return p;
  };
  plan = sanitizePlan(plan);
    
    console.log();
  renderer.renderInfo(`Selected Plan: ${plan.id || planLabel}`);
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

    // If workspace provided, ensure tasks that consume paths use it
    if (config.workspace) {
      plan.tasks.forEach((task: any) => {
        if (task.input && typeof task.input === 'object') {
          if ('path' in task.input) task.input.path = task.input.path || config.workspace;
          if ('cwd' in task.input) task.input.cwd = task.input.cwd || config.workspace;
        }
        // For analysis specifically, ensure path
        if (task.capability === 'analyze_workspace') {
          task.input = { ...(task.input || {}), path: config.workspace };
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
