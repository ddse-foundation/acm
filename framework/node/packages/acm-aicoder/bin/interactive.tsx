#!/usr/bin/env node

// ACM AI Coder - Phase 2 Interactive CLI
// Full-screen TUI with three-column layout
// Requires: --llm-model, --llm-base-url, --llm-engine, --workspace

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
    
    // Create LLM client based on base URL
    const llm = config.llmBaseUrl.includes('api.openai.com') || 
                 config.llmBaseUrl.includes('api.anthropic.com')
      ? createVLLMClient(config.llmModel, config.llmBaseUrl)
      : createOllamaClient(config.llmModel, config.llmBaseUrl);
    
    // Setup registries
    const toolRegistry = new SimpleToolRegistry();
    const capabilityRegistry = new SimpleCapabilityRegistry();
    const policyEngine = new SimplePolicyEngine();
    
    // Register tools
    toolRegistry.register(new FileStatTool());
    toolRegistry.register(new FileReadToolV2());
    toolRegistry.register(new CodeSearchTool());
    toolRegistry.register(new GrepTool());
    toolRegistry.register(new DiffTool());
    toolRegistry.register(new CodeEditToolV2());
    toolRegistry.register(new RunTestsToolV2());
    toolRegistry.register(new BuildTool());
    
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
    policyEngine.setAllowedPaths([`${config.workspace}/**`]);
    
    // Create app store and runtime
    const store = new AppStore();
    const runtime = new InteractiveRuntime({
      config,
      llm,
      capabilities: capabilityRegistry.list(),
      toolRegistry,
      policyEngine,
      store,
    });
    
    // Welcome message
    store.addMessage('system', 
      `Welcome to ACM AI Coder (Phase 2)\n\n` +
      `Configuration:\n` +
      `  Model: ${config.llmModel}\n` +
      `  Engine: ${config.llmEngine}\n` +
      `  Workspace: ${config.workspace}\n` +
      (config.budgetUsd ? `  Budget: $${config.budgetUsd}\n` : '') +
      `\n` +
      `Type your goal to start planning, or /help for commands.`
    );
    
    // Update initial budget status
    store.updateBudgetStatus(runtime.getBudgetManager().getStatus());
    
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
