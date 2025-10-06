import { Task, type RunContext } from '@ddse/acm-sdk';
import {
  type AnalyzeTranscriptInput,
  type AnalyzeTranscriptOutput,
  type GenerateFeedbackInput,
  type GenerateFeedbackOutput,
  type LogCoachingNoteInput,
  type LogCoachingNoteOutput,
} from '../tools/coaching/index.js';

export class AnalyzeTranscriptTask extends Task<
  AnalyzeTranscriptInput,
  AnalyzeTranscriptOutput
> {
  constructor() {
    super('task-coaching-analyze-transcript', 'coaching.analyze_transcript');
  }

  idemKey(_ctx: RunContext, input: AnalyzeTranscriptInput): string | undefined {
    return input?.transcriptId ? `coaching:transcript:${input.transcriptId}` : undefined;
  }

  policyInput(_ctx: RunContext, input: AnalyzeTranscriptInput): Record<string, unknown> {
    return {
      action: 'analyze_transcript',
      transcriptId: input.transcriptId,
    };
  }

  verification(): string[] {
    return ['typeof output.sentimentScore === "number"', 'Array.isArray(output.highlights)'];
  }

  async execute(
    ctx: RunContext,
    input: AnalyzeTranscriptInput
  ): Promise<AnalyzeTranscriptOutput> {
    const tool = ctx.getTool('analyze_transcript');
    if (!tool) {
      throw new Error('analyze_transcript tool is not registered');
    }

    const result = (await tool.call(input)) as AnalyzeTranscriptOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'coaching_transcript_analyzed',
      transcriptId: input.transcriptId,
      sentimentScore: result.sentimentScore,
      complianceScore: result.complianceScore,
    });
    return result;
  }
}

export interface GenerateFeedbackTaskInput {
  transcriptId?: string;
  metrics?: GenerateFeedbackInput['metrics'];
}

export class GenerateFeedbackTask extends Task<
  GenerateFeedbackTaskInput,
  GenerateFeedbackOutput
> {
  constructor() {
    super('task-coaching-generate-feedback', 'coaching.generate_feedback');
  }

  policyInput(ctx: RunContext, input: GenerateFeedbackTaskInput): Record<string, unknown> {
    const resolved = this.resolveInput(ctx, input);
    return {
      action: 'generate_feedback',
      transcriptId: resolved.transcriptId,
      metrics: resolved.metrics,
    };
  }

  verification(): string[] {
    return ['typeof output.feedbackSummary === "string"', 'Array.isArray(output.actionItems)'];
  }

  async execute(
    ctx: RunContext,
    input: GenerateFeedbackTaskInput
  ): Promise<GenerateFeedbackOutput> {
    const tool = ctx.getTool('generate_feedback');
    if (!tool) {
      throw new Error('generate_feedback tool is not registered');
    }

    const resolved = this.resolveInput(ctx, input);
    const result = (await tool.call(resolved)) as GenerateFeedbackOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'coaching_feedback_generated',
      transcriptId: resolved.transcriptId,
      escalationRequired: result.escalationRequired,
    });
    return result;
  }

  private resolveInput(
    ctx: RunContext,
    input: GenerateFeedbackTaskInput
  ): GenerateFeedbackInput {
    const analyzeOutput = ctx.outputs?.['task-coaching-analyze-transcript'] as
      | AnalyzeTranscriptOutput
      | undefined;

    const transcriptId =
      input?.transcriptId ?? analyzeOutput?.transcript?.id;
    if (!transcriptId) {
      throw new Error('transcriptId is required for feedback generation');
    }

    const metrics =
      input?.metrics ??
      (analyzeOutput
        ? {
            sentimentScore: analyzeOutput.sentimentScore,
            complianceScore: analyzeOutput.complianceScore,
            complianceBreaches: analyzeOutput.complianceBreaches,
            highlights: analyzeOutput.highlights,
            summary: analyzeOutput.summary,
          }
        : undefined);

    if (!metrics) {
      throw new Error('metrics are required for feedback generation');
    }

    return {
      transcriptId,
      metrics,
    };
  }
}

export interface LogCoachingNoteTaskInput extends Partial<LogCoachingNoteInput> {}

export class LogCoachingNoteTask extends Task<
  LogCoachingNoteTaskInput,
  LogCoachingNoteOutput
> {
  constructor() {
    super('task-coaching-log-note', 'coaching.log_note');
  }

  policyInput(ctx: RunContext, input: LogCoachingNoteTaskInput): Record<string, unknown> {
    const resolved = this.resolveInput(ctx, input);
    return {
      action: 'log_coaching_note',
      agentId: resolved.agentId,
      escalationRequired: resolved.escalationRequired,
    };
  }

  verification(): string[] {
    return ['output.stored === true', 'typeof output.logId === "string"'];
  }

  async execute(
    ctx: RunContext,
    input: LogCoachingNoteTaskInput
  ): Promise<LogCoachingNoteOutput> {
    const tool = ctx.getTool('log_coaching_note');
    if (!tool) {
      throw new Error('log_coaching_note tool is not registered');
    }

    const resolved = this.resolveInput(ctx, input);
    const result = (await tool.call(resolved)) as LogCoachingNoteOutput;
    ctx.stream?.emit('task', {
      taskId: this.id,
      stage: 'coaching_note_logged',
      agentId: resolved.agentId,
      escalationNotified: result.escalationNotified,
    });
    return result;
  }

  private resolveInput(
    ctx: RunContext,
    input: LogCoachingNoteTaskInput
  ): LogCoachingNoteInput {
    const analyzeOutput = ctx.outputs?.['task-coaching-analyze-transcript'] as
      | AnalyzeTranscriptOutput
      | undefined;
    const feedbackOutput = ctx.outputs?.['task-coaching-generate-feedback'] as
      | GenerateFeedbackOutput
      | undefined;

    const agentId = input.agentId ?? analyzeOutput?.transcript?.agentId;
    if (!agentId) {
      throw new Error('agentId is required to log coaching note');
    }

    const feedbackSummary = input.feedbackSummary ?? feedbackOutput?.feedbackSummary;
    if (!feedbackSummary) {
      throw new Error('feedbackSummary is required to log coaching note');
    }

    const actionItems = input.actionItems ?? feedbackOutput?.actionItems;
    if (!actionItems) {
      throw new Error('actionItems are required to log coaching note');
    }

    const escalationRequired =
      input.escalationRequired ?? feedbackOutput?.escalationRequired ?? false;

    return {
      agentId,
      feedbackSummary,
      actionItems,
      escalationRequired,
    };
  }
}
