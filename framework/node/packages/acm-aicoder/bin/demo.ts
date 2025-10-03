#!/usr/bin/env node

// Demo script showing AI Coder capabilities without requiring LLM
import {
  CodeReadTool,
  CodeEditTool,
  CodeAnalyzeTool,
  TestRunnerTool,
  AnalyzeCodebaseTask,
  FixBugTask,
  SimpleCapabilityRegistry,
  SimpleToolRegistry,
  SimplePolicyEngine,
  CLIRenderer,
} from '../src/index.js';
import { MemoryLedger, executePlan } from '@acm/runtime';
import type { Goal, Context, Plan } from '@acm/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

const renderer = new CLIRenderer();

async function setupDemo() {
  // Create demo project
  const demoDir = '/tmp/acm-demo-project';
  await fs.mkdir(demoDir + '/src', { recursive: true });
  
  // Create a sample file with issues
  const sampleCode = `// Simple calculator module
export class Calculator {
  add(a: number, b: number): number {
    console.log("DEBUG: adding numbers");
    return a + b;
  }

  subtract(a: number, b: number): number {
    console.log("DEBUG: subtracting numbers");
    return a - b;
  }

  // TODO: implement multiply
  multiply(a: number, b: number): number {
    return 0;
  }

  // FIXME: handle division by zero
  divide(a: number, b: number): number {
    return a / b;
  }
}`;
  
  await fs.writeFile(demoDir + '/src/calculator.ts', sampleCode);
  await fs.writeFile(demoDir + '/src/utils.ts', '// TODO: Add utility functions\nconsole.log("debug");');
  
  return demoDir;
}

async function demoAnalyze(demoDir: string) {
  renderer.renderHeader('Demo 1: Analyze Codebase');
  
  const goal: Goal = {
    id: 'demo-analyze',
    intent: 'Analyze the demo codebase and detect issues',
  };
  
  const context: Context = {
    id: 'demo-ctx',
    facts: { path: demoDir + '/src' },
    version: '1.0',
  };
  
  const plan: Plan = {
    id: 'plan-analyze',
    contextRef: 'demo-ref',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'analyze_codebase',
        input: { path: demoDir + '/src' },
      },
    ],
    edges: [],
  };
  
  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new CodeReadTool());
  toolRegistry.register(new CodeAnalyzeTool());
  
  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'analyze_codebase', sideEffects: false },
    new AnalyzeCodebaseTask()
  );
  
  const ledger = new MemoryLedger();
  
  renderer.renderInfo('Analyzing codebase...');
  
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
  });
  
  renderer.renderSuccess('Analysis complete!');
  console.log();
  
  const output = result.outputsByTask.t1;
  console.log(`📊 Summary: ${output.summary}`);
  console.log(`📁 Files analyzed: ${output.files}`);
  console.log(`⚠️  Issues found: ${output.issues.length}`);
  console.log();
  
  if (output.issues.length > 0) {
    console.log('Issues:');
    output.issues.forEach((issue: any, idx: number) => {
      console.log(`  ${idx + 1}. [${issue.severity}] ${issue.file}:${issue.line} - ${issue.message}`);
    });
  }
  
  console.log();
}

async function demoFixBug(demoDir: string) {
  renderer.renderHeader('Demo 2: Fix Bug (Dry Run)');
  
  const goal: Goal = {
    id: 'demo-fix',
    intent: 'Remove console.log statements',
  };
  
  const context: Context = {
    id: 'demo-ctx',
    facts: { path: demoDir + '/src/calculator.ts' },
    version: '1.0',
  };
  
  const plan: Plan = {
    id: 'plan-fix',
    contextRef: 'demo-ref',
    capabilityMapVersion: '1.0',
    tasks: [
      {
        id: 't1',
        capability: 'fix_bug',
        input: {
          path: demoDir + '/src/calculator.ts',
          bugDescription: 'Remove debug console.log statements',
          dryRun: true,
        },
      },
    ],
    edges: [],
  };
  
  const toolRegistry = new SimpleToolRegistry();
  toolRegistry.register(new CodeReadTool());
  toolRegistry.register(new CodeEditTool());
  
  const capabilityRegistry = new SimpleCapabilityRegistry();
  capabilityRegistry.register(
    { name: 'fix_bug', sideEffects: true },
    new FixBugTask()
  );
  
  const ledger = new MemoryLedger();
  
  renderer.renderInfo('Fixing bug (dry run mode)...');
  
  const result = await executePlan({
    goal,
    context,
    plan,
    capabilityRegistry,
    toolRegistry,
    ledger,
  });
  
  const output = result.outputsByTask.t1;
  
  if (output.fixed) {
    renderer.renderSuccess('Bug fix prepared!');
    console.log();
    console.log('Changes:');
    output.changes.forEach((change: string) => {
      console.log(`  • ${change}`);
    });
    console.log();
    renderer.renderWarning('This was a dry run - no files were modified');
  } else {
    renderer.renderError('Bug fix failed');
  }
  
  console.log();
}

async function demoShowCapabilities() {
  renderer.renderHeader('ACM AI Coder - Available Capabilities');
  
  console.log('🔧 Code Intelligence Tools:');
  console.log('  • CodeReadTool: Read files and directories with size limits');
  console.log('  • CodeEditTool: Edit files with diff tracking');
  console.log('  • CodeAnalyzeTool: Static analysis and issue detection');
  console.log('  • TestRunnerTool: Execute test suites');
  console.log();
  
  console.log('🎯 AI-Powered Tasks:');
  console.log('  • AnalyzeCodebaseTask: Comprehensive codebase analysis');
  console.log('  • FixBugTask: Intelligent bug fixing with verification');
  console.log('  • ImplementFeatureTask: Feature scaffolding');
  console.log('  • RunTestsTask: Test execution with result reporting');
  console.log();
  
  console.log('🛡️  Safety Features:');
  console.log('  • Dry-run mode for previewing changes');
  console.log('  • Approval workflows for file modifications');
  console.log('  • Policy engine for path restrictions');
  console.log('  • Checkpointing for resume support');
  console.log();
  
  console.log('⚡ Key Benefits:');
  console.log('  • Works with any LLM provider (Ollama, vLLM, etc.)');
  console.log('  • Full ACM stack integration (planner, runtime, adapters)');
  console.log('  • Production-ready with comprehensive testing');
  console.log('  • Developer-friendly CLI with beautiful output');
  console.log();
}

async function main() {
  try {
    console.log();
    renderer.renderHeader('🚀 ACM AI Coder Demo');
    console.log();
    console.log('This demo showcases the AI Coder capabilities without requiring');
    console.log('a running LLM server. The full CLI supports interactive planning');
    console.log('with any LLM provider (Ollama, vLLM, etc.)');
    console.log();
    
    // Setup demo project
    const demoDir = await setupDemo();
    renderer.renderSuccess(`Demo project created at ${demoDir}`);
    console.log();
    
    // Show capabilities
    await demoShowCapabilities();
    
    // Demo 1: Analyze
    await demoAnalyze(demoDir);
    
    // Demo 2: Fix bug
    await demoFixBug(demoDir);
    
    // Cleanup
    await fs.rm(demoDir, { recursive: true, force: true });
    
    renderer.renderHeader('✨ Demo Complete');
    console.log();
    console.log('To use the full CLI with LLM integration:');
    console.log();
    console.log('  1. Start an LLM server (e.g., ollama serve)');
    console.log('  2. Run: acm-aicoder --goal analyze');
    console.log('  3. Follow the interactive prompts');
    console.log();
    console.log('For help: acm-aicoder --help');
    console.log();
    
  } catch (error: any) {
    renderer.renderError('Demo failed');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
