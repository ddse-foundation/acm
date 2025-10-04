// Session configuration for AI Coder Phase 2
// Manages CLI arguments and session metadata

export type LLMEngine = 'langgraph' | 'msaf' | 'runtime';

export interface SessionConfig {
  // Required parameters
  llmModel: string;
  llmBaseUrl: string;
  llmEngine: LLMEngine;
  workspace: string;
  
  // Optional parameters
  budgetUsd?: number;
  temperature?: number;
  seed?: number;
  planCount?: 1 | 2;
  
  // Session metadata
  sessionId: string;
  timestamp: number;
}

export interface CLIArgs {
  'llm-model'?: string;
  'llm-base-url'?: string;
  'llm-engine'?: string;
  workspace?: string;
  'budget-usd'?: string;
  temperature?: string;
  seed?: string;
  plans?: string;
  [key: string]: string | undefined;
}

export function parseCliArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {};
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i++;
      }
    }
  }
  
  return args;
}

export function validateAndNormalizeConfig(args: CLIArgs): SessionConfig {
  // Validate required parameters
  const missing: string[] = [];
  
  if (!args['llm-model']) missing.push('--llm-model');
  if (!args['llm-base-url']) missing.push('--llm-base-url');
  if (!args['llm-engine']) missing.push('--llm-engine');
  if (!args.workspace) missing.push('--workspace');
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required parameters: ${missing.join(', ')}\n\n` +
      `ACM AI Coder requires these parameters to start:\n` +
      `  --llm-model <model>       LLM model name (e.g., gpt-4o, claude-3-opus)\n` +
      `  --llm-base-url <url>      LLM API endpoint\n` +
      `  --llm-engine <engine>     ACM runtime engine (langgraph, msaf, runtime)\n` +
      `  --workspace <path>        Project workspace root path\n\n` +
      `Optional parameters:\n` +
      `  --budget-usd <amount>     Budget limit in USD (default: unlimited)\n` +
      `  --temperature <0-2>       LLM temperature (default: 0.7)\n` +
      `  --seed <number>           Random seed for reproducibility\n` +
      `  --plans <1|2>             Number of alternative plans (default: 1)\n\n` +
      `Example:\n` +
      `  acm-aicoder --llm-model gpt-4o --llm-base-url https://api.openai.com \\\n` +
      `              --llm-engine langgraph --workspace /path/to/project --budget-usd 10`
    );
  }
  
  // Validate engine
  const engine = args['llm-engine'] as LLMEngine;
  if (!['langgraph', 'msaf', 'runtime'].includes(engine)) {
    throw new Error(
      `Invalid --llm-engine: ${engine}\n` +
      `Must be one of: langgraph, msaf, runtime`
    );
  }
  
  // Parse optional numeric parameters
  const budgetUsd = args['budget-usd'] ? parseFloat(args['budget-usd']) : undefined;
  const temperature = args.temperature ? parseFloat(args.temperature) : 0.7;
  const seed = args.seed ? parseInt(args.seed, 10) : undefined;
  const planCount = args.plans === '2' ? 2 : 1;
  
  if (budgetUsd !== undefined && (isNaN(budgetUsd) || budgetUsd < 0)) {
    throw new Error(`Invalid --budget-usd: must be a positive number`);
  }
  
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    throw new Error(`Invalid --temperature: must be between 0 and 2`);
  }
  
  return {
    llmModel: args['llm-model']!,
    llmBaseUrl: args['llm-base-url']!,
    llmEngine: engine,
    workspace: args.workspace!,
    budgetUsd,
    temperature,
    seed,
    planCount,
    sessionId: `session-${Date.now()}`,
    timestamp: Date.now(),
  };
}
