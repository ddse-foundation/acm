#!/usr/bin/env node

// ACM AI Coder - Phase 2 Interactive CLI
// Full-screen TUI with three-column layout
// Requires: --provider, --model, and --workspace (optional --base-url)

import React from 'react';
import { render } from 'ink';
import { createOllamaClient, createVLLMClient } from '@acm/llm';
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
    
    // Register tools
  toolRegistry.register(new FileStatTool(config.workspace));
  toolRegistry.register(new FileReadToolV2(config.workspace));
  toolRegistry.register(new CodeSearchTool(config.workspace));
  toolRegistry.register(new GrepTool(config.workspace));
  toolRegistry.register(new DiffTool(config.workspace));
  toolRegistry.register(new CodeEditToolV2(config.workspace));
  toolRegistry.register(new RunTestsToolV2(config.workspace));
  toolRegistry.register(new BuildTool(config.workspace));
    
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
