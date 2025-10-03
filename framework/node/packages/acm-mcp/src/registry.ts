// MCP Tool Registry for ACM
import { ToolRegistry } from '@acm/sdk';
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
}
