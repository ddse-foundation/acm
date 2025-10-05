// ExecutionTranscript helper observes ledger append events and emits structured narrative updates
import type { LedgerEntry, StreamSink } from '@acm/sdk';
import type { MemoryLedger } from './ledger.js';
import type { TaskNarrative } from './executor.js';

export type ExecutionTranscriptEvent =
  | {
      type: 'nucleus-reasoning';
      taskId?: string;
      planId?: string;
      reasoning: string;
    }
  | {
      type: 'task-completed';
      taskId: string;
      output: any;
      narrative?: TaskNarrative;
    }
  | {
      type: 'goal-summary';
      goalId: string;
      planId: string;
      summary?: string;
    };

type ExecutionTranscriptHandler = (entry: LedgerEntry) => void;

type LedgerWithTranscript = MemoryLedger & {
  __executionTranscriptHandlers?: ExecutionTranscriptHandler[];
};

export class ExecutionTranscript {
  private stream?: StreamSink;
  private onEvent?: (event: ExecutionTranscriptEvent) => void;

  constructor(options: { stream?: StreamSink; onEvent?: (event: ExecutionTranscriptEvent) => void } = {}) {
    this.stream = options.stream;
    this.onEvent = options.onEvent;
  }

  attach(ledger: MemoryLedger): void {
    const target = ledger as LedgerWithTranscript;

    if (!target.__executionTranscriptHandlers) {
      target.__executionTranscriptHandlers = [];
      const originalAppend = ledger.append.bind(ledger);

      ledger.append = (type: any, details: Record<string, any>, computeDigest = true) => {
        const entry = originalAppend(type, details, computeDigest);
        for (const handler of target.__executionTranscriptHandlers!) {
          handler(entry);
        }
        return entry;
      };
    }

    target.__executionTranscriptHandlers.push(entry => this.handleEntry(entry));
  }

  private handleEntry(entry: LedgerEntry): void {
    const event = mapLedgerEntry(entry);
    if (!event) {
      return;
    }

    this.stream?.emit('transcript', event);
    this.onEvent?.(event);
  }
}

function mapLedgerEntry(entry: LedgerEntry): ExecutionTranscriptEvent | undefined {
  switch (entry.type) {
    case 'NUCLEUS_INFERENCE': {
      const reasoning = typeof entry.details?.reasoning === 'string' ? entry.details.reasoning.trim() : '';
      if (!reasoning) {
        return undefined;
      }
      return {
        type: 'nucleus-reasoning',
        taskId: entry.details?.nucleus?.taskId,
        planId: entry.details?.nucleus?.planId,
        reasoning,
      };
    }
    case 'TASK_END': {
      const taskId = entry.details?.taskId;
      if (!taskId) {
        return undefined;
      }
      return {
        type: 'task-completed',
        taskId,
        output: entry.details?.output,
        narrative: entry.details?.narrative,
      };
    }
    case 'GOAL_SUMMARY': {
      return {
        type: 'goal-summary',
        goalId: entry.details?.goalId,
        planId: entry.details?.planId,
        summary: entry.details?.summary,
      };
    }
    default:
      return undefined;
  }
}
