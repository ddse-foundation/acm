import { Tool } from '@acm/sdk';
import {
  getTranscript,
  getAgent,
  type CoachingTranscript,
  type AgentProfile,
} from '../../data/coaching.js';

export type AnalyzeTranscriptInput = {
  transcriptId: string;
};

export type AnalyzeTranscriptOutput = {
  transcript: CoachingTranscript;
  sentimentScore: number;
  complianceScore: number;
  complianceBreaches: string[];
  highlights: string[];
  summary: string;
};

function computeSentimentScore(transcript: CoachingTranscript): number {
  switch (transcript.customerSentiment) {
    case 'POSITIVE':
      return 0.85;
    case 'NEUTRAL':
      return 0.55;
    case 'NEGATIVE':
      return 0.25;
    default:
      return 0.5;
  }
}

function computeComplianceScore(flags: string[]): number {
  if (flags.length === 0) {
    return 0.95;
  }
  return Math.max(0.2, 0.95 - flags.length * 0.15);
}

function buildHighlights(transcript: CoachingTranscript): string[] {
  const highlights: string[] = [];
  if (transcript.followUpRequired) {
    highlights.push('Customer requested follow-up action');
  }
  if (transcript.transcript.some(line => /apolog/i.test(line))) {
    highlights.push('Agent provided customer apology');
  }
  const empathyLine = transcript.transcript.find(line => /understand|appreciate|thanks/i.test(line));
  if (empathyLine) {
    highlights.push(`Empathy signal captured: "${empathyLine.trim().slice(0, 120)}"`);
  }
  return highlights.slice(0, 3);
}

export class AnalyzeTranscriptTool extends Tool<
  AnalyzeTranscriptInput,
  AnalyzeTranscriptOutput
> {
  name(): string {
    return 'analyze_transcript';
  }

  async call(input: AnalyzeTranscriptInput): Promise<AnalyzeTranscriptOutput> {
    if (!input?.transcriptId) {
      throw new Error('transcriptId is required');
    }

    const transcript = await getTranscript(input.transcriptId);
    if (!transcript) {
      throw new Error(`Transcript ${input.transcriptId} not found`);
    }

    const sentimentScore = computeSentimentScore(transcript);
    const complianceScore = computeComplianceScore(transcript.complianceFlags);
    const summary = transcript.transcript.slice(0, 6).join(' ');

    return {
      transcript,
      sentimentScore,
      complianceScore,
      complianceBreaches: transcript.complianceFlags,
      highlights: buildHighlights(transcript),
      summary,
    };
  }
}

export type GenerateFeedbackInput = {
  transcriptId: string;
  metrics: Pick<
    AnalyzeTranscriptOutput,
    'sentimentScore' | 'complianceScore' | 'complianceBreaches' | 'highlights' | 'summary'
  >;
};

export type GenerateFeedbackOutput = {
  transcriptId: string;
  feedbackSummary: string;
  actionItems: string[];
  escalationRequired: boolean;
};

function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export class GenerateFeedbackTool extends Tool<
  GenerateFeedbackInput,
  GenerateFeedbackOutput
> {
  name(): string {
    return 'generate_feedback';
  }

  async call(input: GenerateFeedbackInput): Promise<GenerateFeedbackOutput> {
    if (!input?.transcriptId || !input?.metrics) {
      throw new Error('transcriptId and metrics are required');
    }

    const transcript = await getTranscript(input.transcriptId);
    if (!transcript) {
      throw new Error(`Transcript ${input.transcriptId} not found`);
    }

    const escalationRequired = input.metrics.complianceBreaches.length > 0;
    const sentimentStr = formatPercent(input.metrics.sentimentScore);
    const complianceStr = formatPercent(input.metrics.complianceScore);

    const feedbackSummary = [
      `Overall sentiment scored at ${sentimentStr}.`,
      `Compliance adherence at ${complianceStr}.`,
    ].join(' ');

    const actionItems: string[] = [];
    if (input.metrics.complianceBreaches.length > 0) {
      actionItems.push(
        `Address compliance items: ${input.metrics.complianceBreaches.join(', ')}`,
      );
    }
    if (input.metrics.sentimentScore < 0.5) {
      actionItems.push('Practice empathy statements to de-escalate frustrated customers');
    }
    actionItems.push('Acknowledge customer feelings before delivering resolution details');

    return {
      transcriptId: input.transcriptId,
      feedbackSummary,
      actionItems,
      escalationRequired,
    };
  }
}

export type LogCoachingNoteInput = {
  agentId: string;
  feedbackSummary: string;
  actionItems: string[];
  escalationRequired: boolean;
};

export type LogCoachingNoteOutput = {
  logId: string;
  agent: AgentProfile;
  stored: boolean;
  escalationNotified: boolean;
  timestamp: string;
};

export class LogCoachingNoteTool extends Tool<
  LogCoachingNoteInput,
  LogCoachingNoteOutput
> {
  name(): string {
    return 'log_coaching_note';
  }

  async call(input: LogCoachingNoteInput): Promise<LogCoachingNoteOutput> {
    if (!input?.agentId || !input?.feedbackSummary) {
      throw new Error('agentId and feedbackSummary are required');
    }

    const agent = await getAgent(input.agentId);
    if (!agent) {
      throw new Error(`Agent ${input.agentId} not found`);
    }

    return {
      logId: `coach-${Date.now()}`,
      agent,
      stored: true,
      escalationNotified: input.escalationRequired,
      timestamp: new Date().toISOString(),
    };
  }
}
