// Goal/context index derived from scenario catalog
import type { Goal, Context } from '@ddse/acm-sdk';
import { scenarios, type ScenarioKey } from '../examples/scenarios.js';

type GoalMap = Record<ScenarioKey, Goal> & Record<string, Goal>;
type ContextMap = Record<ScenarioKey, Context> & Record<string, Context>;

export const goals = Object.keys(scenarios).reduce((acc, key) => {
  const scenario = scenarios[key as ScenarioKey];
  acc[key] = scenario.goal;
  return acc;
}, {} as GoalMap);

export const contexts = Object.keys(scenarios).reduce((acc, key) => {
  const scenario = scenarios[key as ScenarioKey];
  acc[key] = scenario.context;
  return acc;
}, {} as ContextMap);
