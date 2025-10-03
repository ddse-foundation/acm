// Abstract CapabilityRegistry class
import type { Capability } from './types.js';
import type { Task } from './task.js';

export abstract class CapabilityRegistry {
  abstract list(): Capability[];
  abstract has(name: string): boolean;
  abstract resolve(name: string): Task<any, any> | undefined;
  abstract inputSchema(name: string): unknown | undefined;
  abstract outputSchema(name: string): unknown | undefined;
}
