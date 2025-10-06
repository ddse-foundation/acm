import { loadJson } from './loader.js';

export interface CoachingTranscript {
  id: string;
  agentId: string;
  customerSentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  complianceFlags: string[];
  transcript: string[];
  callDurationSeconds: number;
  followUpRequired: boolean;
}

export interface AgentProfile {
  id: string;
  name: string;
  region: string;
  tenureMonths: number;
  managerEmail: string;
}

interface CoachingData {
  transcripts: CoachingTranscript[];
  agents: AgentProfile[];
}

let cache: CoachingData | null = null;

async function loadData(): Promise<CoachingData> {
  if (cache) {
    return cache;
  }

  const [transcripts, agents] = await Promise.all([
    loadJson<CoachingTranscript[]>('data/coaching/transcripts.json'),
    loadJson<AgentProfile[]>('data/coaching/agents.json'),
  ]);

  cache = { transcripts, agents };
  return cache;
}

export async function getTranscript(id: string): Promise<CoachingTranscript | undefined> {
  const { transcripts } = await loadData();
  return transcripts.find(item => item.id === id);
}

export async function getAgent(agentId: string): Promise<AgentProfile | undefined> {
  const { agents } = await loadData();
  return agents.find(agent => agent.id === agentId);
}
