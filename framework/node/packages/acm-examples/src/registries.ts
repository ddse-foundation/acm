// Concrete registry implementations
import { CapabilityRegistry, ToolRegistry, type Capability, type Task, type Tool } from '@acm/sdk';

export class SimpleCapabilityRegistry extends CapabilityRegistry {
  private tasks = new Map<string, Task>();
  private capabilities = new Map<string, Capability>();

  register(capability: Capability, task: Task): void {
    this.capabilities.set(capability.name, capability);
    this.tasks.set(capability.name, task);
  }

  list(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  resolve(name: string): Task | undefined {
    return this.tasks.get(name);
  }

  inputSchema(name: string): unknown | undefined {
    return this.capabilities.get(name)?.inputSchema;
  }

  outputSchema(name: string): unknown | undefined {
    return this.capabilities.get(name)?.outputSchema;
  }
}

export class SimpleToolRegistry extends ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name(), tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}
