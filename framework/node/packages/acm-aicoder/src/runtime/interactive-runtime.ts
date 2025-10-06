// Interactive Runtime Orchestrator
// Connects ACM framework components with the TUI

import type { LLM } from '@ddse/acm-llm';
import {
  type Goal,
  type Context,
  type Plan,
  type StreamSink,
  type NucleusConfig,
  type LLMCallFn,
  type CapabilityRegistry,
  ExternalContextProviderAdapter,
} from '@ddse/acm-sdk';
import { type PlannerResult } from '@ddse/acm-planner';
import { ExecutionTranscript, MemoryLedger, type ExecutionTranscriptEvent } from '@ddse/acm-runtime';
import { ACMFramework } from '@ddse/acm-framework';
import type { SessionConfig } from '../config/session.js';
import { BudgetManager } from './budget-manager.js';
import { AppStore } from '../ui/store.js';

export interface InteractiveRuntimeOptions {
  config: SessionConfig;
  llm: LLM;
  capabilityRegistry: CapabilityRegistry;
  toolRegistry: any;
  policyEngine: any;
  store: AppStore;
  contextProvider?: ExternalContextProviderAdapter;
}

export class InteractiveRuntime {
  private config: SessionConfig;
  private llm: LLM;
  private capabilityRegistry: CapabilityRegistry;
  private toolRegistry: any;
  private policyEngine: any;
  private store: AppStore;
  private budgetManager: BudgetManager;
  private ledger: MemoryLedger;
  private nucleusConfig: {
    llmCall: NucleusConfig['llmCall'];
    hooks?: NucleusConfig['hooks'];
  };
  private nucleusLLMCall: LLMCallFn;
  private transcript: ExecutionTranscript;
  private contextProvider?: ExternalContextProviderAdapter;
  private framework: ACMFramework;
  
  constructor(options: InteractiveRuntimeOptions) {
    this.config = options.config;
    this.llm = options.llm;
  this.capabilityRegistry = options.capabilityRegistry;
    this.toolRegistry = options.toolRegistry;
    this.policyEngine = options.policyEngine;
    this.store = options.store;
    this.contextProvider = options.contextProvider;
    
    this.budgetManager = new BudgetManager(options.config.model);
    
    this.ledger = new MemoryLedger();
    
    if (!this.llm.generateWithTools) {
      throw new Error('Configured LLM must support structured tool calls to drive Nucleus.');
    }

    this.nucleusLLMCall = async (prompt, tools, callConfig) => {
      const toolDefs = tools.map(tool => ({
        name: tool.name,
        description: tool.description ?? 'Interactive runtime tool',
        inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      }));

      const response = await this.llm.generateWithTools!(
        [
          {
            role: 'system',
            content: prompt,
          },
        ],
        toolDefs,
        {
          temperature: callConfig.temperature,
          seed: callConfig.seed,
          maxTokens: callConfig.maxTokens,
        }
      );

      return {
        reasoning: response.text,
        toolCalls: (response.toolCalls ?? []).map(tc => ({
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        })),
        raw: response.raw,
      };
    };

    this.nucleusConfig = {
      llmCall: {
        provider: this.llm.name(),
        model: this.config.model,
        temperature: this.config.temperature ?? 0.1,
        maxTokens: 512,
      },
      hooks: {
        preflight: true,
        postcheck: true,
      },
    };

    this.framework = ACMFramework.create({
      capabilityRegistry: this.capabilityRegistry,
      toolRegistry: this.toolRegistry,
      policyEngine: this.policyEngine,
      contextProvider: this.contextProvider,
      verify: async () => true,
      nucleus: {
        call: this.nucleusLLMCall,
        llmConfig: this.nucleusConfig.llmCall,
        hooks: this.nucleusConfig.hooks,
      },
    });

    // Subscribe to ledger events
    this.setupLedgerSubscription();

    this.transcript = new ExecutionTranscript({
      onEvent: event => this.handleTranscriptEvent(event),
    });
    this.transcript.attach(this.ledger);
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
      
      if (entry.type === 'NUCLEUS_INFERENCE') {
        const reasoning = (entry.details && (entry.details.reasoning ?? entry.details.nucleus?.reasoning)) as
          | string
          | undefined;

        if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
          this.store.addMessage('nucleus', reasoning.trim());
        }
      }

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

  private handleTranscriptEvent(event: ExecutionTranscriptEvent): void {
    if (event.type === 'task-completed') {
      this.store.recordTaskOutput(event.taskId, event.output, event.narrative);
    } else if (event.type === 'goal-summary') {
      this.store.setGoalSummary(event.summary);
    }
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
            const msgs = this.store.getState().messages;
            const lastPlanner = msgs.filter(m => m.role === 'planner').pop();

            if ('delta' in event && event.delta) {
              // Stream planner reasoning
              if (lastPlanner && lastPlanner.streaming) {
                this.store.appendToMessage(lastPlanner.id, event.delta);
              } else {
                this.store.addMessage('planner', event.delta, true);
              }
            }

            const summaryParts: string[] = [];
            if (typeof event.plans === 'number') {
              const planLabel = event.plans === 1 ? 'plan' : 'plans';
              summaryParts.push(`Generated ${event.plans} ${planLabel}.`);
            }
            if (event.rationale) {
              summaryParts.push(event.rationale);
            }

            if (summaryParts.length > 0 && lastPlanner) {
              const summary = summaryParts.join('\n\n');
              this.store.updateMessage(lastPlanner.id, summary, false);
            } else if ('done' in event && event.done && lastPlanner) {
              // Mark streaming complete with default message if no summary
              const content = lastPlanner.content?.trim().length
                ? lastPlanner.content
                : 'Planner finished.';
              this.store.updateMessage(lastPlanner.id, content, false);
            }
          }

          if (channel === 'summary') {
            this.store.setGoalSummary((event as any)?.summary);
          }
        },
        close: (source: string) => {
          // Not used in this implementation
        },
      };
      
      // Token allowance check for planning
      let planningEstimate;
      try {
        const promptText = `Goal: ${goalText}\nContext: ${JSON.stringify(context.facts)}`;
        planningEstimate = this.budgetManager.checkBudget(promptText, 2000);
        this.store.addEvent('TOKEN_BUDGET_CHECK', {
          estimatedTokens: planningEstimate.totalTokens,
          inputTokens: planningEstimate.inputTokens,
          outputTokens: planningEstimate.outputTokens,
        }, 'blue');
      } catch (err: any) {
        this.store.addMessage('system', `Token allowance exceeded: ${err.message}`);
        this.store.setProcessing(false);
        return;
      }
      
      // Plan with ACM framework wrapper
      this.store.addMessage('planner', 'Planner is generating plan(s)...', true);
      const planResponse = await this.framework.plan({
        goal,
        context,
        planCount: this.config.planCount || 1,
        stream: streamSink,
        ledger: this.ledger,
      });
      const plannerResult = planResponse.result;
      
    // Record estimated token usage for planning stage
      if (planningEstimate) {
        this.budgetManager.recordUsage(planningEstimate.inputTokens, planningEstimate.outputTokens);
      }
      this.store.updateBudgetStatus(this.budgetManager.getStatus());
      
      if (plannerResult.plans.length === 0) {
        this.store.addMessage('system', 'No plans generated. Try rephrasing your goal.');
        this.store.setProcessing(false);
        return;
      }
      
      const selectedPlan = planResponse.selectedPlan;
      this.store.setGoal(goal, context, selectedPlan);
      this.store.addEvent('PLAN_SELECTED', {
        planId: selectedPlan.id,
        tasks: selectedPlan.tasks.length,
      }, 'green');
      
      // Execute plan
      await this.executePlan(goal, context, selectedPlan, plannerResult, streamSink);
      
    } catch (error: any) {
      this.store.addMessage('system', `Error: ${error.message}`);
      this.store.addEvent('ERROR', { message: error.message }, 'red');
    } finally {
      this.store.setProcessing(false);
    }
  }
  
  private async executePlan(
    goal: Goal,
    context: Context,
    plan: Plan,
    plannerResult: PlannerResult,
    stream: StreamSink,
  ): Promise<void> {
    try {
      const result = await this.framework.execute({
        goal,
        context,
        stream,
        ledger: this.ledger,
        runId: `run-${Date.now()}`,
        existingPlan: {
          plan,
          plannerResult,
        },
      });
      const execution = result.execution;
      
      this.store.addMessage('system', 'Goal completed successfully!');
      this.store.addEvent('GOAL_COMPLETED', { goalId: goal.id }, 'green');

      if (execution.goalSummary) {
        this.store.setGoalSummary(execution.goalSummary);
      }

      const completedTasks = this.store
        .getState()
        .tasks.filter(task => task.outputSummary && task.status === 'succeeded');

      if (completedTasks.length > 0) {
        const summaryLines = completedTasks.map(task => `• ${task.name}: ${task.outputSummary}`);
        this.store.addMessage('system', `Summary of task outputs:\n${summaryLines.join('\n')}`);
      } else if (Object.keys(execution.outputsByTask || {}).length === 0) {
        this.store.addMessage('system', 'Execution completed, but no tasks produced structured outputs.');
      }
      
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
