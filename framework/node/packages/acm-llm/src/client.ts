// OpenAI-compatible client for Ollama and vLLM
import type { LLM, ChatMessage, LLMResponse, LLMStreamChunk, ToolDefinition, LLMToolResponse, ToolCall } from './types.js';

export type OpenAICompatConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  name: string;
};

export class OpenAICompatClient implements LLM {
  constructor(private config: OpenAICompatConfig) {}

  name(): string {
    return this.config.name;
  }

  async generate(
    messages: ChatMessage[],
    opts?: {
      temperature?: number;
      seed?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: opts?.temperature ?? 0.7,
        seed: opts?.seed,
        max_tokens: opts?.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    return {
      text: data.choices?.[0]?.message?.content || '',
      tokens: data.usage?.total_tokens,
      raw: data,
    };
  }

  async *generateStream(
    messages: ChatMessage[],
    opts?: {
      temperature?: number;
      seed?: number;
      maxTokens?: number;
    }
  ): AsyncIterableIterator<LLMStreamChunk> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: opts?.temperature ?? 0.7,
        seed: opts?.seed,
        max_tokens: opts?.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.substring(6)) as any;
              const delta = data.choices?.[0]?.delta?.content || '';
              
              if (delta) {
                yield {
                  delta,
                  done: false,
                };
              }
            } catch (err) {
              // Skip malformed JSON
            }
          }
        }
      }

      yield {
        delta: '',
        done: true,
      };
    } finally {
      reader.releaseLock();
    }
  }

  async generateWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    opts?: {
      temperature?: number;
      seed?: number;
      maxTokens?: number;
    }
  ): Promise<LLMToolResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // Convert tools to OpenAI format
    const openaiTools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        tools: openaiTools,
        tool_choice: openaiTools.length > 0 ? 'required' : 'auto',
        temperature: opts?.temperature ?? 0.7,
        seed: opts?.seed,
        max_tokens: opts?.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    
    // Extract tool calls if present
    const toolCalls: ToolCall[] = [];
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function?.name || '',
          arguments: tc.function?.arguments 
            ? (typeof tc.function.arguments === 'string' 
                ? JSON.parse(tc.function.arguments) 
                : tc.function.arguments)
            : {},
        });
      }
    }
    
    return {
      text: choice?.message?.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      tokens: data.usage?.total_tokens,
      raw: data,
    };
  }
}

// Presets for common providers
export function createOllamaClient(model: string, baseUrl?: string): OpenAICompatClient {
  return new OpenAICompatClient({
    baseUrl: baseUrl || 'http://localhost:11434/v1',
    model,
    name: 'ollama',
  });
}

export function createVLLMClient(model: string, baseUrl?: string): OpenAICompatClient {
  return new OpenAICompatClient({
    baseUrl: baseUrl || 'http://localhost:8001/v1',
    model,
    name: 'vllm',
  });
}
