// Registries and Policy for AI Coder
import { 
  CapabilityRegistry,
  ToolRegistry,
  PolicyEngine,
  type Capability, 
  type Tool, 
  type Task,
  type PolicyDecision,
} from '@acm/sdk';

/**
 * Simple Capability Registry
 */
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

/**
 * Simple Tool Registry
 */
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

/**
 * Simple Policy Engine with safety rules for code modifications
 */
export class SimplePolicyEngine implements PolicyEngine {
  private allowedPaths: string[] = [];
  private blockedActions: string[] = [];

  setAllowedPaths(paths: string[]): void {
    this.allowedPaths = paths;
  }

  setBlockedActions(actions: string[]): void {
    this.blockedActions = actions;
  }

  async evaluate(
    action: 'plan.admit' | 'task.pre' | 'task.post',
    payload: any
  ): Promise<PolicyDecision> {
    // Check if action is blocked
    if (action === 'task.pre' && this.blockedActions.includes(payload?.action)) {
      return {
        allow: false,
        reason: `Action ${payload?.action} is blocked by policy`,
      };
    }

    // For code editing operations, check path is allowed
    if (action === 'task.pre' && (payload?.action === 'fix_bug' || payload?.action === 'implement_feature')) {
      const targetPath = payload?.path || payload?.targetPath;
      
      if (this.allowedPaths.length > 0 && targetPath && !this.allowedPaths.includes('*')) {
        const isAllowed = this.allowedPaths.some(allowed => 
          targetPath.includes(allowed)
        );
        
        if (!isAllowed) {
          return {
            allow: false,
            reason: `Path ${targetPath} is not in allowed paths`,
          };
        }
      }
    }

    // Default: allow
    return {
      allow: true,
      limits: {
        timeoutMs: 30000,
        retries: 3,
      },
    };
  }
}
