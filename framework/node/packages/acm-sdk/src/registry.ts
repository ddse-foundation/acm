// Abstract ToolRegistry class
import type { Tool } from './tool.js';

export abstract class ToolRegistry {
  abstract get(name: string): Tool<any, any> | undefined;
  abstract list(): string[];
}
