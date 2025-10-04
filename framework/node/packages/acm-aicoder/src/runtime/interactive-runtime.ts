// Interactive Runtime Orchestrator
// Connects ACM framework components with the TUI

import type { LLM } from '@acm/llm';
import type { Goal, Context, Plan, Capability, StreamSink } from '@acm/sdk';
import { LLMPlanner } from '@acm/planner';
import { MemoryLedger, executeResumablePlan } from '@acm/runtime';
import type { SessionConfig } from '../config/session.js';
import { BudgetManager } from './budget-manager.js';
import { AppStore } from '../ui/store.js';
import * as crypto from 'crypto';

export interface InteractiveRuntimeOptions {
  config: SessionConfig;
  llm: LLM;
  capabilities: Capability[];
  toolRegistry: any;
  policyEngine: any;
  store: AppStore;
}

export class InteractiveRuntime {
  private config: SessionConfig;
  private llm: LLM;
  private capabilities: Capability[];
  private toolRegistry: any;
  private policyEngine: any;
  private store: AppStore;
  private budgetManager: BudgetManager;
  private ledger: MemoryLedger;
  
  constructor(options: InteractiveRuntimeOptions) {
    this.config = options.config;
    this.llm = options.llm;
    this.capabilities = options.capabilities;
    this.toolRegistry = options.toolRegistry;
    this.policyEngine = options.policyEngine;
    this.store = options.store;
    
    this.budgetManager = new BudgetManager(
      options.config.llmModel,
      options.config.budgetUsd
    );
    
    this.ledger = new MemoryLedger();
    
    // Subscribe to ledger events
    this.setupLedgerSubscription();
  }
  
  private setupLedgerSubscription(): void {
    // Monitor ledger entries and emit to event stream
    const originalAppend = this.ledger.append.bind(this.ledger);
    this.ledger.append = (type: any, details: Record<string, any>, computeDigest = true) => {
      const entry = originalAppend(type, details, computeDigest);
      
      // Map ledger entry to event
      const eventColors: Record<string, any> = {
        PLAN_SELECTED: 'green',
        TASK_START: 'blue',
        TASK_END: 'green',
        ERROR: 'red',
        POLICY_DECISION: 'yellow',
        VERIFICATION: 'blue',
      };
      
      this.store.addEvent(
        entry.type,
        entry.details,
        eventColors[entry.type] || 'gray'
      );
      
      // Update task status based on ledger entry
      if (entry.type === 'TASK_START' && entry.details.taskId) {
        this.store.updateTaskStatus(entry.details.taskId, 'running');
      } else if (entry.type === 'TASK_END' && entry.details.taskId) {
        this.store.updateTaskStatus(entry.details.taskId, 'succeeded');
      } else if (entry.type === 'ERROR' && entry.details.taskId) {
        this.store.updateTaskStatus(
          entry.details.taskId,
          'failed',
          undefined,
          entry.details.message || entry.details.error || 'Unknown error'
        );
      }
      
      return entry;
    };
  }
  
  async processGoal(goalText: string): Promise<void> {
    try {
      this.store.setProcessing(true);
      this.store.addMessage('user', goalText);
      
      // Create goal and context
      const goal: Goal = {
        id: `goal-${Date.now()}`,
        intent: goalText,
      };
      
      const context: Context = {
        id: `ctx-${Date.now()}`,
        facts: {
          workspace: this.config.workspace,
          timestamp: new Date().toISOString(),
        },
      };
      
      this.store.addEvent('GOAL_CREATED', { goalId: goal.id, intent: goalText }, 'green');
      
      // Create streaming sink for planner
      const streamSink: StreamSink = {
        attach: (source: string, callback: (chunk: any) => void) => {
          // Not used in this implementation
        },
        emit: (channel, event) => {
          if (channel === 'planner') {
            if ('delta' in event && event.delta) {
              // Stream planner reasoning
              const msgId = this.store.getState().messages.find(m => m.role === 'planner' && m.streaming)?.id;
              if (msgId) {
                this.store.appendToMessage(msgId, event.delta);
              } else {
                this.store.addMessage('planner', event.delta, true);
              }
            }
            if ('done' in event && event.done) {
              // Mark streaming complete
              const msgs = this.store.getState().messages;
              const lastPlanner = msgs.filter(m => m.role === 'planner').pop();
              if (lastPlanner) {
                this.store.updateMessage(lastPlanner.id, lastPlanner.content, false);
              }
            }
          }
        },
        close: (source: string) => {
          // Not used in this implementation
        },
      };
      
      // Budget check for planning
      try {
        const promptText = `Goal: ${goalText}\nContext: ${JSON.stringify(context.facts)}`;
        const estimate = this.budgetManager.checkBudget(promptText, 2000);
        this.store.addEvent('BUDGET_CHECK', {
          estimated: `$${estimate.estimatedCostUsd.toFixed(4)}`,
          tokens: estimate.inputTokens + estimate.outputTokens,
        }, 'blue');
      } catch (err: any) {
        this.store.addMessage('system', `Budget exceeded: ${err.message}`);
        this.store.setProcessing(false);
        return;
      }
      
      // Plan with LLM
      this.store.addMessage('planner', '', true);
      const planner = new LLMPlanner();
      const plannerResult = await planner.plan({
        goal,
        context,
        capabilities: this.capabilities,
        llm: this.llm,
        stream: streamSink,
        planCount: this.config.planCount || 1,
      });
      
      // Record spend
      this.budgetManager.recordSpend(1000, 2000); // Approximate
      this.store.updateBudgetStatus(this.budgetManager.getStatus());
      
      if (plannerResult.plans.length === 0) {
        this.store.addMessage('system', 'No plans generated. Try rephrasing your goal.');
        this.store.setProcessing(false);
        return;
      }
      
      const selectedPlan = plannerResult.plans[0];
      this.store.setGoal(goal, context, selectedPlan);
      this.store.addEvent('PLAN_SELECTED', {
        planId: selectedPlan.id,
        tasks: selectedPlan.tasks.length,
      }, 'green');
      
      // Execute plan
      await this.executePlan(goal, context, selectedPlan);
      
    } catch (error: any) {
      this.store.addMessage('system', `Error: ${error.message}`);
      this.store.addEvent('ERROR', { message: error.message }, 'red');
    } finally {
      this.store.setProcessing(false);
    }
  }
  
  private async executePlan(goal: Goal, context: Context, plan: Plan): Promise<void> {
    try {
      // Execute plan with resumable runtime
      const result = await executeResumablePlan({
        goal,
        context,
        plan,
        capabilityRegistry: {
          list: () => this.capabilities,
          has: (name: string) => this.capabilities.some(c => c.name === name),
          resolve: (name: string) => {
            const cap = this.capabilities.find(c => c.name === name);
            return cap ? { execute: async () => ({}) } as any : undefined;
          },
          inputSchema: () => undefined,
          outputSchema: () => undefined,
        },
        toolRegistry: this.toolRegistry,
        policy: this.policyEngine,
        verify: async () => true,
        runId: `run-${Date.now()}`,
        ledger: this.ledger,
      });
      
      this.store.addMessage('system', 'Goal completed successfully!');
      this.store.addEvent('GOAL_COMPLETED', { goalId: goal.id }, 'green');
      
      // Cleanup after goal
      await this.cleanupGoal();
      
    } catch (error: any) {
      this.store.addMessage('system', `Execution error: ${error.message}`);
      this.store.addEvent('EXECUTION_ERROR', { message: error.message }, 'red');
    }
  }
  
  private async cleanupGoal(): Promise<void> {
    // Persist replay bundle
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const replayDir = path.join(this.config.workspace, '.aicoder', 'replays');
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const bundleDir = path.join(replayDir, timestamp);
      
      // Create directory
      await fs.mkdir(bundleDir, { recursive: true });
      
      // Save session config
      await fs.writeFile(
        path.join(bundleDir, 'session.json'),
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      
      // Save ledger entries
      const ledgerEntries = this.ledger.getEntries();
      await fs.writeFile(
        path.join(bundleDir, 'ledger.jsonl'),
        ledgerEntries.map(e => JSON.stringify(e)).join('\n'),
        'utf-8'
      );
      
      // Save budget summary
      const budgetStatus = this.budgetManager.getStatus();
      await fs.writeFile(
        path.join(bundleDir, 'budget.json'),
        JSON.stringify(budgetStatus, null, 2),
        'utf-8'
      );
      
      this.store.addEvent('REPLAY_SAVED', { path: bundleDir }, 'blue');
      this.store.addMessage('system', `Replay bundle saved to: ${bundleDir}`);
    } catch (err: any) {
      // Non-fatal
      this.store.addEvent('REPLAY_SAVE_ERROR', { error: err.message }, 'red');
    }
    
    // Reset budget for next goal
    this.budgetManager.reset();
    this.store.updateBudgetStatus(this.budgetManager.getStatus());
  }
  
  getBudgetManager(): BudgetManager {
    return this.budgetManager;
  }
  
  getLedger(): MemoryLedger {
    return this.ledger;
  }
}
