// Application state store for the interactive TUI
// Manages chat messages, tasks, events, and budget state

import { EventEmitter } from 'events';
import type { Plan, Goal, Context } from '@ddse/acm-sdk';
import type { TaskNarrative } from '@ddse/acm-runtime';
import type { BudgetStatus } from '../runtime/budget-manager.js';

export type MessageRole = 'user' | 'planner' | 'nucleus' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  streaming?: boolean;
}

export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'retrying';

export interface TaskState {
  id: string;
  name: string;
  title?: string;
  objective?: string;
  successCriteria?: string[];
  status: TaskStatus;
  progress?: number;
  error?: string;
  attempt?: number;
  maxAttempts?: number;
  outputSummary?: string;
  rawOutput?: unknown;
  narrative?: TaskNarrative;
}

export interface EventEntry {
  id: string;
  type: string;
  timestamp: number;
  data: any;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

export interface AppState {
  // Chat state
  messages: ChatMessage[];
  showReasoning: boolean;
  
  // Goal/Plan state
  currentGoal?: Goal;
  currentContext?: Context;
  currentPlan?: Plan;
  tasks: TaskState[];
  goalSummary?: string;
  
  // Budget state
  budgetStatus?: BudgetStatus;
  
  // Event stream
  events: EventEntry[];
  taskOutputs: Record<string, TaskState['rawOutput']>;
  
  // UI state
  inputText: string;
  isProcessing: boolean;
}

export class AppStore extends EventEmitter {
  private state: AppState = {
    messages: [],
    showReasoning: true,
    tasks: [],
    events: [],
    taskOutputs: {},
    inputText: '',
    isProcessing: false,
    goalSummary: undefined,
  };
  
  getState(): AppState {
    return {
      ...this.state,
      messages: [...this.state.messages],
      showReasoning: this.state.showReasoning,
      tasks: this.state.tasks.map(task => ({ ...task })),
      events: [...this.state.events],
      taskOutputs: { ...this.state.taskOutputs },
    };
  }
  
  // Chat methods
  addMessage(role: MessageRole, content: string, streaming = false): string {
    const id = `msg-${Date.now()}-${Math.random()}`;
    const message: ChatMessage = {
      id,
      role,
      content,
      timestamp: Date.now(),
      streaming,
    };
    
    this.state.messages.push(message);
    this.emit('update', this.state);
    return id;
  }

  isReasoningVisible(): boolean {
    return this.state.showReasoning;
  }

  setReasoningVisible(visible: boolean): void {
    if (this.state.showReasoning !== visible) {
      this.state.showReasoning = visible;
      this.emit('update', this.state);
    }
  }

  toggleReasoningVisible(): boolean {
    this.state.showReasoning = !this.state.showReasoning;
    this.emit('update', this.state);
    return this.state.showReasoning;
  }
  
  updateMessage(id: string, content: string, streaming = false): void {
    const message = this.state.messages.find(m => m.id === id);
    if (message) {
      message.content = content;
      message.streaming = streaming;
      this.emit('update', this.state);
    }
  }
  
  appendToMessage(id: string, delta: string): void {
    const message = this.state.messages.find(m => m.id === id);
    if (message) {
      message.content += delta;
      this.emit('update', this.state);
    }
  }
  
  // Goal/Plan methods
  setGoal(goal: Goal, context: Context, plan: Plan): void {
    this.state.currentGoal = goal;
    this.state.currentContext = context;
    this.state.currentPlan = plan;
    
    // Initialize tasks from plan
    this.state.tasks = plan.tasks.map((task, idx) => {
      const taskId = (task as any).id || task.capability || task.capabilityRef || `task-${idx}`;
      const displayName =
        (task as any).name || task.capability || task.capabilityRef || `Task ${idx + 1}`;

      return {
        id: String(taskId),
        name: String(displayName),
        title: (task as any).title ?? displayName,
        objective: (task as any).objective,
        successCriteria: Array.isArray((task as any).successCriteria)
          ? (task as any).successCriteria
          : undefined,
        status: 'pending' as TaskStatus,
      };
    });

    this.state.taskOutputs = {};
    this.state.goalSummary = undefined;
    
    this.emit('update', this.state);
  }
  
  updateTaskStatus(taskId: string, status: TaskStatus, progress?: number, error?: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (progress !== undefined) task.progress = progress;
      if (error) task.error = error;
      this.emit('update', this.state);
    }
  }
  
  setTaskRetry(taskId: string, attempt: number, maxAttempts: number): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.attempt = attempt;
      task.maxAttempts = maxAttempts;
      task.status = 'retrying';
      this.emit('update', this.state);
    }
  }
  
  // Budget methods
  updateBudgetStatus(status: BudgetStatus): void {
    this.state.budgetStatus = status;
    this.emit('update', this.state);
  }
  
  // Event methods
  addEvent(type: string, data: any, color?: EventEntry['color']): void {
    const event: EventEntry = {
      id: `event-${Date.now()}-${Math.random()}`,
      type,
      timestamp: Date.now(),
      data,
      color,
    };
    
    this.state.events.push(event);
    
    // Keep only last 100 events to prevent memory bloat
    if (this.state.events.length > 100) {
      this.state.events = this.state.events.slice(-100);
    }
    
    this.emit('update', this.state);
  }
  
  // UI methods
  setInputText(text: string): void {
    this.state.inputText = text;
    this.emit('update', this.state);
  }
  
  setProcessing(isProcessing: boolean): void {
    this.state.isProcessing = isProcessing;
    this.emit('update', this.state);
  }
  
  // Lifecycle methods
  clearGoal(): void {
    this.state.currentGoal = undefined;
    this.state.currentContext = undefined;
    this.state.currentPlan = undefined;
    this.state.tasks = [];
    this.state.taskOutputs = {};
    this.state.goalSummary = undefined;
    this.emit('update', this.state);
  }
  
  reset(): void {
    this.state = {
      messages: [
        {
          id: 'welcome',
          role: 'system',
          content: 'Session reset. Ready for new goal.',
          timestamp: Date.now(),
        }
      ],
      showReasoning: true,
      tasks: [],
      events: [],
      taskOutputs: {},
      inputText: '',
      isProcessing: false,
      goalSummary: undefined,
    };
    this.emit('update', this.state);
  }

  recordTaskOutput(taskId: string, output: unknown, narrative?: TaskNarrative): void {
    this.state.taskOutputs[taskId] = output;

    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.rawOutput = output;
      task.outputSummary = this.formatOutputSummary(output);
      task.narrative = narrative;
    }

    this.emit('update', this.state);

    const label = task?.name || taskId;
    const summary = task?.outputSummary ?? this.formatOutputSummary(output);
    const reasoning = narrative?.reasoning?.length ? narrative.reasoning.join(' ') : undefined;

    if (summary || reasoning) {
      const lines: string[] = [];
      if (summary) {
        lines.push(summary);
      }
      if (reasoning) {
        lines.push(`Narrative: ${reasoning}`);
      }
      if (narrative?.postcheck && narrative.postcheck.status !== 'COMPLETE') {
        lines.push(`Postcheck: ${narrative.postcheck.status}${narrative.postcheck.reason ? ` (${narrative.postcheck.reason})` : ''}`);
      }
      this.addMessage('system', `Task "${label}" output:\n${lines.join('\n')}`);
    }
  }

  setGoalSummary(summary?: string): void {
    this.state.goalSummary = summary;
    this.emit('update', this.state);
    if (summary) {
      this.addMessage('system', `Goal summary:\n${summary}`);
    }
  }

  private formatOutputSummary(output: unknown): string {
    if (output === undefined || output === null) {
      return 'No output produced.';
    }

    if (typeof output === 'string') {
      const trimmed = output.trim();
      return trimmed.length > 0 ? this.truncate(trimmed) : 'Output was an empty string.';
    }

    if (typeof output === 'number' || typeof output === 'boolean') {
      return String(output);
    }

    if (Array.isArray(output)) {
      if (output.length === 0) {
        return 'Output array was empty.';
      }

      const preview = output
        .slice(0, 3)
        .map(item => this.previewValue(item))
        .join('\n');

      const suffix = output.length > 3 ? `\n… ${output.length - 3} more item(s)` : '';
      return this.truncate(preview + suffix);
    }

    if (typeof output === 'object') {
      return this.truncate(this.previewValue(output));
    }

    return this.truncate(String(output));
  }

  private previewValue(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'string') return value.trim() || '""';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      const items = value.slice(0, 3).map(v => this.previewValue(v)).join(', ');
      return `[${items}${value.length > 3 ? ', …' : ''}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      const preview = entries
        .slice(0, 4)
        .map(([key, val]) => `${key}: ${this.previewValue(val)}`)
        .join(', ');
      const suffix = entries.length > 4 ? ', …' : '';
      return `{ ${preview}${suffix} }`;
    }

    return String(value);
  }

  private truncate(value: string, max = 400): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1)}…`;
  }
}
