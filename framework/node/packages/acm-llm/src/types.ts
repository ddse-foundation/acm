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
}
