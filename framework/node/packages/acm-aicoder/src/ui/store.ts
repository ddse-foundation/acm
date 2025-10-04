// Application state store for the interactive TUI
// Manages chat messages, tasks, events, and budget state

import { EventEmitter } from 'events';
import type { Plan, Goal, Context, LedgerEntry } from '@acm/sdk';
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
  status: TaskStatus;
  progress?: number;
  error?: string;
  attempt?: number;
  maxAttempts?: number;
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
  
  // Goal/Plan state
  currentGoal?: Goal;
  currentContext?: Context;
  currentPlan?: Plan;
  tasks: TaskState[];
  
  // Budget state
  budgetStatus?: BudgetStatus;
  
  // Event stream
  events: EventEntry[];
  
  // UI state
  inputText: string;
  isProcessing: boolean;
}

export class AppStore extends EventEmitter {
  private state: AppState = {
    messages: [],
    tasks: [],
    events: [],
    inputText: '',
    isProcessing: false,
  };
  
  getState(): AppState {
    return { ...this.state };
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
    this.state.tasks = plan.tasks.map((task, idx) => ({
      id: `task-${idx}`,
      name: task.capability || task.capabilityRef || 'Unknown',
      status: 'pending' as TaskStatus,
    }));
    
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
      tasks: [],
      events: [],
      inputText: '',
      isProcessing: false,
    };
    this.emit('update', this.state);
  }
}
