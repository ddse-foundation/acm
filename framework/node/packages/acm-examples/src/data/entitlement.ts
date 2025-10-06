import { loadJson } from './loader.js';

export interface CustomerProfile {
  id: string;
  name: string;
  tier: 'STANDARD' | 'GOLD' | 'PLATINUM';
  accountAgeDays: number;
  complianceFlags: string[];
  benefits: string[];
  supervisor: {
    name: string;
    email: string;
  };
}

export interface EntitlementPolicy {
  id: string;
  benefitCode: string;
  description: string;
  requiredTier: 'STANDARD' | 'GOLD' | 'PLATINUM';
  minAccountAgeDays: number;
  requiresComplianceClearance: boolean;
  slaMinutes: number;
}

interface EntitlementData {
  customers: CustomerProfile[];
  policies: EntitlementPolicy[];
}

let cachedData: EntitlementData | null = null;

async function loadData(): Promise<EntitlementData> {
  if (cachedData) {
    return cachedData;
  }

  const [customers, policies] = await Promise.all([
    loadJson<CustomerProfile[]>('data/entitlement/customers.json'),
    loadJson<EntitlementPolicy[]>('data/entitlement/policies.json'),
  ]);

  cachedData = { customers, policies };
  return cachedData;
}

export async function getCustomerProfile(customerId: string): Promise<CustomerProfile | undefined> {
  const { customers } = await loadData();
  return customers.find(c => c.id === customerId);
}

export async function getPolicy(benefitCode: string): Promise<EntitlementPolicy | undefined> {
  const { policies } = await loadData();
  return policies.find(p => p.benefitCode === benefitCode);
}

export async function listPolicies(): Promise<EntitlementPolicy[]> {
  const { policies } = await loadData();
  return policies;
}
