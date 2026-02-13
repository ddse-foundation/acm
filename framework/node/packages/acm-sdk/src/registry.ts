// ACM ToolRegistry — tool registration, lookup, and spec introspection
import { type Tool, type ToolSpec, type ToolExecuteFn, type ToolResult } from './tool.js';

/**
 * Abstract ToolRegistry — the contract that the executor and planner depend on.
 * Host apps provide a concrete implementation.
 */
export abstract class ToolRegistry {
  abstract get(name: string): Tool<any, any> | undefined;
  abstract list(): string[];
  abstract register(tool: Tool<any, any>): void;
  abstract has(name: string): boolean;
  abstract getSpec(name: string): ToolSpec | undefined;
  abstract listSpecs(): ToolSpec[];
}

/**
 * Default in-memory ToolRegistry implementation.
 * Host apps can use this directly or extend it.
 */
export class DefaultToolRegistry extends ToolRegistry {
  private tools = new Map<string, Tool<any, any>>();

  get(name: string): Tool<any, any> | undefined {
    return this.tools.get(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  register(tool: Tool<any, any>): void {
    this.tools.set(tool.id, tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getSpec(name: string): ToolSpec | undefined {
    return this.tools.get(name)?.spec;
  }

  listSpecs(): ToolSpec[] {
    return Array.from(this.tools.values())
      .map(t => t.spec)
      .filter((s): s is ToolSpec => s != null);
  }

  get size(): number {
    return this.tools.size;
  }
}

/**
 * Convenience: create a Tool from a spec + execute function.
 * No subclassing needed — useful for host apps registering tools imperatively.
 */
export function createTool<I = any, O = any>(
  spec: ToolSpec,
  execute: ToolExecuteFn
): Tool<I, O> {
  return {
    spec,
    get id() { return spec.id; },
    name() { return spec.id; },
    call: execute as any,
  } as Tool<I, O>;
}
