// LLM types and interfaces

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LLMResponse = {
  text: string;
  tokens?: number;
  raw?: any;
};

export type LLMStreamChunk = {
  delta: string;
  done: boolean;
};

// Tool call support for structured outputs
export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, any>;
};

export type LLMToolResponse = {
  text?: string;
  toolCalls?: ToolCall[];
  tokens?: number;
  raw?: any;
};

export interface LLM {
  name(): string;
  generate(
    messages: ChatMessage[],
    opts?: {
      temperature?: number;
      seed?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse>;
  
  generateStream?(
    messages: ChatMessage[],
    opts?: {
      temperature?: number;
      seed?: number;
      maxTokens?: number;
    }
  ): AsyncIterableIterator<LLMStreamChunk>;

  // Tool-call generation mode
  generateWithTools?(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    opts?: {
      temperature?: number;
      seed?: number;
      maxTokens?: number;
    }
  ): Promise<LLMToolResponse>;
}
