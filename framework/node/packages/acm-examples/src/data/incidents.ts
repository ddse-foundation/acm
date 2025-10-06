import { loadJson } from './loader.js';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IncidentRecord {
  id: string;
  service: string;
  reportedAt: string;
  customerImpact: 'NONE' | 'MINOR' | 'MAJOR';
  category: 'PERFORMANCE' | 'OUTAGE' | 'SECURITY' | 'QUALITY';
  signalScore: number;
  declaredSeverity: IncidentSeverity;
  vipCustomer?: boolean;
}

export interface RoutingRule {
  id: string;
  service: string;
  category: IncidentRecord['category'];
  minSeverity: IncidentSeverity;
  queue: string;
  escalatesTo?: string;
  notes?: string;
}

interface IncidentData {
  incidents: IncidentRecord[];
  routing: RoutingRule[];
}

let cache: IncidentData | null = null;

async function loadData(): Promise<IncidentData> {
  if (cache) {
    return cache;
  }

  const [incidents, routing] = await Promise.all([
    loadJson<IncidentRecord[]>('data/incidents/incidents.json'),
    loadJson<RoutingRule[]>('data/incidents/routing_rules.json'),
  ]);

  cache = { incidents, routing };
  return cache;
}

export async function getIncident(incidentId: string): Promise<IncidentRecord | undefined> {
  const { incidents } = await loadData();
  return incidents.find(item => item.id === incidentId);
}

function severityRank(severity: IncidentSeverity): number {
  switch (severity) {
    case 'LOW': return 1;
    case 'MEDIUM': return 2;
    case 'HIGH': return 3;
    case 'CRITICAL': return 4;
    default: return 0;
  }
}

export async function findRoutingRule(
  incident: IncidentRecord,
  severityOverride?: IncidentSeverity,
): Promise<RoutingRule | undefined> {
  const { routing } = await loadData();
  const effectiveSeverity = severityOverride ?? incident.declaredSeverity;
  const effectiveRank = severityRank(effectiveSeverity);

  const candidates = routing.filter(rule =>
    rule.service === incident.service &&
    rule.category === incident.category &&
    severityRank(rule.minSeverity) <= effectiveRank,
  );

  candidates.sort((a, b) => severityRank(b.minSeverity) - severityRank(a.minSeverity));
  return candidates[0];
}
