// MCP Tool Registry for ACM
import { ToolRegistry, type Tool, type ToolSpec } from '@ddse/acm-sdk';
import { McpTool, McpClientManager } from './client.js';

/**
 * Tool registry that wraps MCP tools
 */
export class McpToolRegistry extends ToolRegistry {
  private tools: Map<string, McpTool> = new Map();

  constructor(private manager: McpClientManager) {
    super();
    this.syncTools();
  }

  /**
   * Sync tools from the MCP client manager
   */
  private syncTools(): void {
    this.tools.clear();
    for (const tool of this.manager.getAllTools()) {
      this.tools.set(tool.name().replace('mcp:', ''), tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all available tool names
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Refresh tools from MCP server
   */
  async refresh(): Promise<void> {
    this.syncTools();
  }

  register(tool: Tool<any, any>): void {
    // MCP tools are managed by the client manager, not registered directly
    throw new Error('McpToolRegistry does not support direct registration. Tools come from MCP servers.');
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
}

/**
 * Combined tool registry that merges local tools with MCP tools
 */
export class CombinedToolRegistry extends ToolRegistry {
  constructor(
    private localRegistry: ToolRegistry,
    private mcpRegistry?: McpToolRegistry
  ) {
    super();
  }

  get(name: string): any {
    // Try local registry first
    const localTool = this.localRegistry.get(name);
    if (localTool) {
      return localTool;
    }

    // Try MCP registry
    if (this.mcpRegistry) {
      return this.mcpRegistry.get(name);
    }

    return undefined;
  }

  list(): string[] {
    const localTools = this.localRegistry.list();
    const mcpTools = this.mcpRegistry ? this.mcpRegistry.list() : [];
    return [...new Set([...localTools, ...mcpTools])];
  }

  register(tool: Tool<any, any>): void {
    this.localRegistry.register(tool);
  }

  has(name: string): boolean {
    return this.localRegistry.has(name) || (this.mcpRegistry?.has(name) ?? false);
  }

  getSpec(name: string): ToolSpec | undefined {
    return this.localRegistry.getSpec(name) ?? this.mcpRegistry?.getSpec(name);
  }

  listSpecs(): ToolSpec[] {
    const localSpecs = this.localRegistry.listSpecs();
    const mcpSpecs = this.mcpRegistry?.listSpecs() ?? [];
    // Dedupe by id
    const seen = new Set<string>();
    const result: ToolSpec[] = [];
    for (const spec of [...localSpecs, ...mcpSpecs]) {
      if (!seen.has(spec.id)) {
        seen.add(spec.id);
        result.push(spec);
      }
    }
    return result;
  }
}
