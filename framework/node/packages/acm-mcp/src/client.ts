// MCP Tool Bridge for ACM
import { Tool } from '@ddse/acm-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Tool that wraps an MCP server tool
 */
export class McpTool extends Tool<any, any> {
  constructor(
    private client: Client,
    private toolName: string,
    private toolSchema?: any
  ) {
    super();
  }

  name(): string {
    return `mcp:${this.toolName}`;
  }

  async call(input: any, idemKey?: string): Promise<any> {
    try {
      const result = await this.client.callTool({
        name: this.toolName,
        arguments: input,
      });

      if (result.isError) {
        throw new Error(`MCP tool error: ${JSON.stringify(result.content)}`);
      }

      // Extract text content from MCP response
      const content = result.content as any[];
      const textContent = content.find((c: any) => c.type === 'text');
      if (textContent) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return { result: textContent.text };
        }
      }

      return result.content;
    } catch (error) {
      throw new Error(`Failed to call MCP tool ${this.toolName}: ${error}`);
    }
  }

  schema(): any {
    return this.toolSchema;
  }
}

/**
 * Configuration for connecting to an MCP server
 */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * MCP Client Manager for ACM
 * Handles connection to MCP servers and tool discovery
 */
export class McpClientManager {
  private client: Client | null = null;
  private tools: Map<string, McpTool> = new Map();
  private connected: boolean = false;

  /**
   * Connect to an MCP server
   */
  async connect(config: McpServerConfig): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected to an MCP server');
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env,
    });

    this.client = new Client(
      {
        name: 'acm-mcp-client',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await this.client.connect(transport);
    this.connected = true;

    // Discover available tools
    await this.discoverTools();
  }

  /**
   * Discover tools available on the connected MCP server
   */
  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to an MCP server');
    }

    const { tools } = await this.client.listTools();

    for (const tool of tools) {
      const mcpTool = new McpTool(this.client, tool.name, tool.inputSchema);
      this.tools.set(tool.name, mcpTool);
    }
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all available tools
   */
  getAllTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List all tool names
   */
  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Close connection to MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connected = false;
      this.tools.clear();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
