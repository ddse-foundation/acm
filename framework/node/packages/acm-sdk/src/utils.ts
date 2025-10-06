import type { Plan } from './types.js';
import type { CapabilityRegistry } from './capability.js';

export type PlannerResultLike = {
  plans?: Plan[];
  contextRef?: string;
  rationale?: string;
};

export type NormalizedPlannerResult = {
  plans: Plan[];
  contextRef: string;
  rationale?: string;
};

export type NormalizePlanOptions = {
  capabilityRegistry?: CapabilityRegistry;
  defaultContextRef?: string;
  planIdPrefix?: string;
};

function canonicalizeCapabilitySlug(value: string): string {
  let normalized = value
    .replace(/[:/\\]+/g, '.')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');

  normalized = normalized.replace(/([a-z0-9])([A-Z])/g, '$1_$2');

  normalized = normalized
    .replace(/[^a-zA-Z0-9._@]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '');

  return normalized.toLowerCase();
}

export function resolveCapabilityName(
  value: unknown,
  registry?: CapabilityRegistry
): string {
  if (value === undefined || value === null) {
    return '';
  }

  const raw = (typeof value === 'string' ? value : String(value)).trim();
  if (!raw) {
    return '';
  }

  const candidates = new Set<string>();
  const lowered = raw.toLowerCase();

  candidates.add(raw);
  candidates.add(lowered);
  candidates.add(raw.replace(/\s+/g, '_'));
  candidates.add(lowered.replace(/\s+/g, '_'));
  candidates.add(raw.replace(/\s+/g, '.'));
  candidates.add(lowered.replace(/\s+/g, '.'));
  candidates.add(raw.replace(/[-\s]+/g, '_'));
  candidates.add(lowered.replace(/[-\s]+/g, '_'));
  candidates.add(raw.replace(/[-\s]+/g, '.'));
  candidates.add(lowered.replace(/[-\s]+/g, '.'));

  const slug = canonicalizeCapabilitySlug(raw);
  candidates.add(slug);
  candidates.add(slug.replace(/\./g, '_'));
  candidates.add(slug.replace(/_/g, '.'));

  if (registry) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (registry.has(candidate)) {
        return candidate;
      }
    }
  }

  return slug;
}

function shouldUppercaseValue(key: string): boolean {
  const normalizedKey = key
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();

  return (
    normalizedKey.endsWith('id') ||
    normalizedKey.endsWith('code') ||
    normalizedKey.endsWith('sku') ||
    normalizedKey.endsWith('ref')
  );
}

export function normalizeTaskInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeTaskInput(item));
  }

  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
      const trimmedKey = rawKey.trim();
      let normalizedValue = normalizeTaskInput(rawVal);
      if (typeof normalizedValue === 'string') {
        const trimmedValue = normalizedValue.trim();
        normalizedValue = shouldUppercaseValue(trimmedKey)
          ? trimmedValue.toUpperCase()
          : trimmedValue;
      }
      normalized[trimmedKey] = normalizedValue;
    }

    for (const [key, val] of Object.entries(normalized)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.endsWith('ids')) {
        const singularKey = key.slice(0, -1);
        if (!(singularKey in normalized)) {
          if (Array.isArray(val)) {
            if (val.length > 0) {
              normalized[singularKey] = val[0];
            }
          } else if (val !== undefined && val !== null) {
            normalized[singularKey] = val;
          }
        }
      }

      if (key.includes('_') || key.includes('-')) {
        const camelKey = key
          .replace(/[-_]+(.)?/g, (_, chr?: string) => (chr ? chr.toUpperCase() : ''))
          .replace(/^[A-Z]/, match => match.toLowerCase());

        if (camelKey && !(camelKey in normalized)) {
          normalized[camelKey] = val;
        }
      }
    }
    return normalized;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

export function normalizePlan(
  plan: Plan,
  options: NormalizePlanOptions = {}
): Plan {
  const { capabilityRegistry, defaultContextRef, planIdPrefix } = options;
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];

  const normalizedTasks = tasks.map((task, index) => {
    const trimmedId = typeof task.id === 'string' ? task.id.trim() : task.id;
    const canonicalCapability = resolveCapabilityName(
      task.capability ?? task.capabilityRef ?? '',
      capabilityRegistry
    );
    const resolvedTask = canonicalCapability
      ? capabilityRegistry?.resolve(canonicalCapability)
      : undefined;

    const fallbackId =
      (typeof resolvedTask?.id === 'string' && resolvedTask.id) ||
      trimmedId ||
      (canonicalCapability ? `${canonicalCapability.replace(/\./g, '-')}-${index + 1}` : `task-${index + 1}`);

    const verification =
      task.verification ??
      (typeof resolvedTask?.verification === 'function'
        ? resolvedTask.verification()
        : task.verification);

    return {
      ...task,
      id: fallbackId,
      capability:
        canonicalCapability ||
        (typeof task.capability === 'string' ? task.capability.trim() : task.capability),
      capabilityRef:
        canonicalCapability ||
        (typeof task.capabilityRef === 'string' ? task.capabilityRef.trim() : task.capabilityRef),
      input: normalizeTaskInput(task.input),
      verification,
    };
  });

  const validTaskIds = new Set(
    normalizedTasks
      .map(task => (typeof task.id === 'string' ? task.id : ''))
      .filter(Boolean)
  );

  const normalizedEdges = (Array.isArray(plan.edges) ? plan.edges : [])
    .map(edge => ({
      ...edge,
      from: typeof edge.from === 'string' ? edge.from.trim() : edge.from,
      to: typeof edge.to === 'string' ? edge.to.trim() : edge.to,
    }))
    .filter(edge => typeof edge.from === 'string' && typeof edge.to === 'string')
    .filter(edge => validTaskIds.has(edge.from) && validTaskIds.has(edge.to));

  if (normalizedEdges.length === 0 && normalizedTasks.length > 1) {
    for (let i = 0; i < normalizedTasks.length - 1; i += 1) {
      const current = normalizedTasks[i];
      const next = normalizedTasks[i + 1];
      if (typeof current.id === 'string' && typeof next.id === 'string') {
        normalizedEdges.push({ from: current.id, to: next.id });
      }
    }
  }

  const trimmedPlanId = typeof plan.id === 'string' ? plan.id.trim() : plan.id;
  const finalPlanId =
    (trimmedPlanId && String(trimmedPlanId)) ??
    `${planIdPrefix ?? 'plan'}-${Date.now()}`;

  const trimmedContextRef =
    typeof plan.contextRef === 'string' && plan.contextRef.trim()
      ? plan.contextRef.trim()
      : undefined;

  return {
    ...plan,
    id: finalPlanId,
    contextRef: trimmedContextRef ?? defaultContextRef ?? 'context-unknown',
    tasks: normalizedTasks,
    edges: normalizedEdges,
  };
}

export function normalizePlannerResult(
  result: PlannerResultLike | undefined,
  normalizedPlan: Plan,
  options: NormalizePlanOptions = {}
): NormalizedPlannerResult {
  const { capabilityRegistry, defaultContextRef, planIdPrefix } = options;

  const plans = Array.isArray(result?.plans) ? result!.plans : [];
  const normalizedPlans = plans.map(plan => {
    const trimmedId = typeof plan.id === 'string' ? plan.id.trim() : plan.id;
    if (trimmedId === normalizedPlan.id) {
      return normalizedPlan;
    }
    return normalizePlan(plan, {
      capabilityRegistry,
      defaultContextRef: defaultContextRef ?? normalizedPlan.contextRef,
      planIdPrefix,
    });
  });

  if (!normalizedPlans.some(plan => plan.id === normalizedPlan.id)) {
    normalizedPlans.push(normalizedPlan);
  }

  const contextRef =
    result?.contextRef?.trim() ??
    normalizedPlan.contextRef ??
    defaultContextRef ??
    'context-unknown';

  return {
    plans: normalizedPlans,
    contextRef,
    rationale: result?.rationale,
  };
}
