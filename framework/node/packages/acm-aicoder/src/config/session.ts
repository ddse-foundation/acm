// Session configuration for AI Coder Phase 2
// Manages CLI arguments and session metadata using provider/model semantics

import { existsSync, statSync } from 'fs';
import path from 'path';
import os from 'os';

export type Provider = 'ollama' | 'vllm';

export interface SessionConfig {
  provider: Provider;
  model: string;
  baseUrl?: string;
  workspace: string;
  temperature: number;
  seed?: number;
  planCount: 1 | 2;
  sessionId: string;
  timestamp: number;
}

export interface CLIArgs {
  provider?: string;
  model?: string;
  'base-url'?: string;
  workspace?: string;
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
      // Support --key=value form
      if (arg.includes('=')) {
        const pair = arg.slice(2);
        const eqIndex = pair.indexOf('=');
        const key = pair.slice(0, eqIndex);
        const value = pair.slice(eqIndex + 1);
        if (key.length > 0) {
          args[key] = value;
        }
        continue;
      }

      // Support space-separated --key value form
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
  const provider = (args.provider as Provider) || 'ollama';
  if (!['ollama', 'vllm'].includes(provider)) {
    throw new Error(`Invalid --provider: ${args.provider}. Must be "ollama" or "vllm".`);
  }

  const model = args.model || (provider === 'ollama' ? 'llama3.1' : undefined);
  const missing: string[] = [];

  if (!model) missing.push('--model');
  if (!args.workspace || args.workspace.trim().length === 0) missing.push('--workspace');

  if (missing.length > 0) {
    throw new Error(
      `Missing required parameters: ${missing.join(', ')}\n\n` +
      `ACM AI Coder requires these parameters to start:\n` +
      `  --provider <ollama|vllm>  LLM provider (default: ollama)\n` +
      `  --model <name>            Model identifier (e.g., llama3.1, gpt-4o)\n` +
      `  --workspace <path>        REQUIRED: absolute or relative path to project root\n\n` +
      `Optional parameters:\n` +
      `  --base-url <url>          Override provider base URL\n` +
      `  --temperature <0-2>       LLM temperature (default: 0.7)\n` +
      `  --seed <number>           Random seed for reproducibility\n` +
      `  --plans <1|2>             Number of alternative plans (default: 1)\n\n` +
      `Examples:\n` +
      `  acm-aicoder --provider vllm --model gpt-4o --workspace /abs/path\n` +
      `  acm-aicoder --provider ollama --model llama3.1 --workspace=~/myproject`
    );
  }

  const temperature = args.temperature ? parseFloat(args.temperature) : 0.7;
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    throw new Error(`Invalid --temperature: must be between 0 and 2`);
  }

  const seed = args.seed ? parseInt(args.seed, 10) : undefined;
  if (seed !== undefined && Number.isNaN(seed)) {
    throw new Error(`Invalid --seed: must be a number`);
  }

  const planCount = args.plans === '2' ? 2 : 1;

  // Enforce explicit workspace and normalize
  const baseCwd = process.env.INIT_CWD || process.env.PWD || process.cwd();
  let workspaceInput = args.workspace!;

  // Expand ~ to user home
  if (workspaceInput.startsWith('~/')) {
    workspaceInput = path.join(os.homedir(), workspaceInput.slice(2));
  }

  const resolvedWorkspace = path.isAbsolute(workspaceInput)
    ? workspaceInput
    : path.resolve(baseCwd, workspaceInput);

  if (!existsSync(resolvedWorkspace)) {
    throw new Error(
      `Workspace path "${resolvedWorkspace}" does not exist. Please provide a valid --workspace.`
    );
  }

  const stats = statSync(resolvedWorkspace);
  if (!stats.isDirectory()) {
    throw new Error(
      `Workspace path "${resolvedWorkspace}" is not a directory. Please provide a valid --workspace.`
    );
  }

  return {
    provider,
    model: model!,
    baseUrl: args['base-url'],
    workspace: resolvedWorkspace,
    temperature,
    seed,
    planCount,
    sessionId: `session-${Date.now()}`,
    timestamp: Date.now(),
  };
}
