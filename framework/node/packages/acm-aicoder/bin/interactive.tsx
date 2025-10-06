#!/usr/bin/env node

// ACM AI Coder - Phase 2 Interactive CLI
// Full-screen TUI with three-column layout
// Requires: --provider, --model, and --workspace (optional --base-url)

import React from 'react';
import { render } from 'ink';
import { ExternalContextProviderAdapter } from '@ddse/acm-sdk';
import { createOllamaClient, createVLLMClient } from '@ddse/acm-llm';
import { App } from '../src/ui/App.js';
import { AppStore } from '../src/ui/store.js';
import { InteractiveRuntime } from '../src/runtime/interactive-runtime.js';
import { parseCliArgs, validateAndNormalizeConfig } from '../src/config/session.js';
import {
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
  SimplePolicyEngine,
  // V2 Tools
  FileStatTool,
  FileReadToolV2,
  CodeSearchTool,
  GrepTool,
  DiffTool,
  CodeEditToolV2,
  RunTestsToolV2,
  WorkspaceContextRetrievalTool,
  type WorkspaceContextOperation,
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
} from '../src/index.js';

function buildWorkspaceContextInput(
  directive: string,
  goalIntent?: string
): {
  directive: string;
  goal?: string;
  operations: WorkspaceContextOperation[];
} {
  const separatorIndex = directive.indexOf(':');
  const payload = separatorIndex >= 0 ? directive.slice(separatorIndex + 1).trim() : '';
  const operations: WorkspaceContextOperation[] = [];

  if (payload.length > 0) {
    if (payload.startsWith('{')) {
      try {
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed.operations)) {
          return {
            directive,
            goal: goalIntent,
            operations: parsed.operations as WorkspaceContextOperation[],
          };
        }
        if (typeof parsed.query === 'string' && parsed.query.length > 0) {
          operations.push({ type: 'search', query: parsed.query, includeContext: true });
        }
        if (typeof parsed.pattern === 'string' && parsed.pattern.length > 0) {
          operations.push({ type: 'grep', pattern: parsed.pattern, maxResults: 20 });
        }
      } catch {
        // Fall through to textual parsing
      }
    }

    if (operations.length === 0) {
      operations.push({ type: 'search', query: payload, includeContext: true });
      operations.push({ type: 'grep', pattern: payload, maxResults: 20 });
    }
  }

  return {
    directive,
    goal: goalIntent,
    operations,
  };
}

async function main() {
  try {
    // Parse and validate CLI arguments
    const args = parseCliArgs(process.argv.slice(2));
  const config = validateAndNormalizeConfig(args);

  // Ensure the process operates within the validated workspace
  process.chdir(config.workspace);

    // Create LLM client based on provider selection
    const llm = config.provider === 'vllm'
      ? createVLLMClient(config.model, config.baseUrl)
      : createOllamaClient(config.model, config.baseUrl);
    
    // Setup registries
    const toolRegistry = new SimpleToolRegistry();
    const capabilityRegistry = new SimpleCapabilityRegistry();
    const policyEngine = new SimplePolicyEngine();
    const contextProvider = new ExternalContextProviderAdapter();

    // Register tools
    const fileStatTool = new FileStatTool(config.workspace);
    const fileReadTool = new FileReadToolV2(config.workspace);
    const codeSearchTool = new CodeSearchTool(config.workspace);
    const grepTool = new GrepTool(config.workspace);
    const diffTool = new DiffTool(config.workspace);
    const codeEditTool = new CodeEditToolV2(config.workspace);
    const runTestsTool = new RunTestsToolV2(config.workspace);
    const buildTool = new BuildTool(config.workspace);
    const workspaceContextTool = new WorkspaceContextRetrievalTool(config.workspace);

    toolRegistry.register(fileStatTool);
    toolRegistry.register(fileReadTool);
    toolRegistry.register(codeSearchTool);
    toolRegistry.register(grepTool);
    toolRegistry.register(diffTool);
    toolRegistry.register(codeEditTool);
    toolRegistry.register(runTestsTool);
    toolRegistry.register(buildTool);
    toolRegistry.register(workspaceContextTool);

    contextProvider.register(workspaceContextTool, {
      match: directive =>
        directive.startsWith('workspace.context') || directive.startsWith('workspace_context'),
      buildInput: (directive, ctx) =>
        buildWorkspaceContextInput(directive, ctx.runContext?.goal.intent),
      describe:
        'Retrieve relevant workspace snippets, grep matches, and metadata to satisfy context requests.',
      autoPromote: true,
      maxArtifacts: 32,
    });
    
    // Register capabilities (tasks)
    capabilityRegistry.register(
      { name: 'analyze_workspace', sideEffects: false },
      new AnalyzeWorkspaceTask()
    );
    capabilityRegistry.register(
      { name: 'collect_context_pack', sideEffects: false },
      new CollectContextPackTask()
    );
    capabilityRegistry.register(
      { name: 'search_code', sideEffects: false },
      new SearchCodeTask()
    );
    capabilityRegistry.register(
      { name: 'find_symbol_definition', sideEffects: false },
      new FindSymbolDefinitionTask()
    );
    capabilityRegistry.register(
      { name: 'implement_function', sideEffects: true },
      new ImplementFunctionTask()
    );
    capabilityRegistry.register(
      { name: 'refactor_rename_symbol', sideEffects: true },
      new RefactorRenameSymbolTask()
    );
    capabilityRegistry.register(
      { name: 'fix_type_error', sideEffects: true },
      new FixTypeErrorTask()
    );
    capabilityRegistry.register(
      { name: 'generate_unit_tests', sideEffects: true },
      new GenerateUnitTestsTask()
    );
    
    // Allow workspace operations
  policyEngine.setAllowedPaths([config.workspace]);
    
    // Create app store and runtime
    const store = new AppStore();
    const runtime = new InteractiveRuntime({
      config,
      llm,
      capabilityRegistry,
      toolRegistry,
      policyEngine,
      store,
      contextProvider,
    });

    const initialBudget = runtime.getBudgetManager().getStatus();
    
    // Welcome message
    store.addMessage('system', 
      `Welcome to ACM AI Coder (Phase 2)\n\n` +
  `Configuration:\n` +
  `  Provider: ${config.provider}\n` +
      `  Model: ${config.model}\n` +
      (config.baseUrl ? `  Base URL: ${config.baseUrl}\n` : '') +
  `  Workspace: ${config.workspace}\n` +
      (initialBudget.maxTokens !== undefined ? `  Token allowance: ${initialBudget.maxTokens}\n` : '') +
      `\n` +
      `Type your goal to start planning, or /help for commands.`
    );
    
    // Update initial budget status
    store.updateBudgetStatus(initialBudget);
    
    // Handle commands from UI
    const handleCommand = async (command: string) => {
      if (command.startsWith('/')) {
        // Already handled by UI component
        return;
      }
      
      // Process as goal
      await runtime.processGoal(command);
    };
    
    // Render TUI
    render(<App store={store} onCommand={handleCommand} />);
    
  } catch (error: any) {
    console.error('Error starting ACM AI Coder:');
    console.error(error.message);
    console.error('\nFor help, run: acm-aicoder --help');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
