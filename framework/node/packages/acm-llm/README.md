# @ddse/acm-llm

OpenAI-compatible LLM client with streaming support for Ollama and vLLM.

## Overview

The LLM package provides a unified client interface for local LLM providers using the OpenAI-compatible API format. It supports both standard request/response and streaming modes.

## Installation

```bash
pnpm add @ddse/acm-llm @ddse/acm-sdk
```

## Features

- ✅ OpenAI-compatible API interface
- ✅ Streaming support
- ✅ Works with Ollama and vLLM out of the box
- ✅ Configurable base URLs
- ✅ Optional API key support
- ✅ Zero external dependencies

## Usage

### Basic Usage with Ollama

```typescript
import { createOllamaClient } from '@ddse/acm-llm';

const client = createOllamaClient('llama3.1');

const response = await client.generate([
  { role: 'user', content: 'What is 2+2?' }
], {
  temperature: 0.7,
  maxTokens: 100,
});

console.log(response.text);
```

### Streaming

```typescript
import { createOllamaClient } from '@ddse/acm-llm';

const client = createOllamaClient('llama3.1');

for await (const chunk of client.generateStream([
  { role: 'user', content: 'Count to 10' }
])) {
  if (!chunk.done) {
    process.stdout.write(chunk.delta);
  }
}
```

### Using vLLM

```typescript
import { createVLLMClient } from '@ddse/acm-llm';

const client = createVLLMClient('qwen2.5:7b');

const response = await client.generate([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
]);
```

### Custom Configuration

```typescript
import { OpenAICompatClient } from '@ddse/acm-llm';

const client = new OpenAICompatClient({
  baseUrl: 'http://localhost:8000/v1',
  apiKey: 'optional-key',
  model: 'my-model',
  name: 'my-provider',
});
```

### With ACM Planner

```typescript
import { createOllamaClient } from '@ddse/acm-llm';
import { StructuredLLMPlanner } from '@ddse/acm-planner';

const llm = createOllamaClient('llama3.1');
const planner = new StructuredLLMPlanner();

const { plans } = await planner.plan({
  goal: { id: 'g1', intent: 'Process order' },
  context: { id: 'ctx1', facts: { orderId: 'O123' } },
  capabilities: [{ name: 'search' }, { name: 'process' }],
  llm,
});
```

## API Reference

### OpenAICompatClient

**Constructor:**
```typescript
new OpenAICompatClient({
  baseUrl: string;
  apiKey?: string;
  model: string;
  name: string;
})
```

**Methods:**

#### name(): string
Returns the provider name.

#### generate(messages, opts?): Promise<LLMResponse>
Generate a completion.

**Parameters:**
- `messages: ChatMessage[]` - Array of chat messages
- `opts?: { temperature?, seed?, maxTokens? }` - Optional generation options

**Returns:** `Promise<LLMResponse>`
```typescript
{
  text: string;
  tokens?: number;
  raw?: any;
}
```

#### generateStream(messages, opts?): AsyncIterableIterator<LLMStreamChunk>
Generate a streaming completion.

**Parameters:**
- Same as `generate()`

**Yields:** `LLMStreamChunk`
```typescript
{
  delta: string;
  done: boolean;
}
```

### Helper Functions

#### createOllamaClient(model, baseUrl?)
Create a client for Ollama.

**Defaults:**
- baseUrl: `http://localhost:11434/v1`

#### createVLLMClient(model, baseUrl?)
Create a client for vLLM.

**Defaults:**
- baseUrl: `http://localhost:8000/v1`

## Types

### ChatMessage
```typescript
type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};
```

### LLMResponse
```typescript
type LLMResponse = {
  text: string;
  tokens?: number;
  raw?: any;
};
```

### LLMStreamChunk
```typescript
type LLMStreamChunk = {
  delta: string;
  done: boolean;
};
```

## Provider Setup

### Ollama

1. Install Ollama from https://ollama.ai
2. Pull a model: `ollama pull llama3.1`
3. Start server: `ollama serve`
4. Default endpoint: http://localhost:11434/v1

### vLLM

1. Install vLLM: `pip install vllm`
2. Start server: `vllm serve <model-name> --port 8000`
3. Default endpoint: http://localhost:8000/v1

## Error Handling

The client throws errors for:
- Network failures
- Invalid responses
- Non-2xx status codes

```typescript
try {
  const response = await client.generate([...]);
} catch (error) {
  console.error('LLM error:', error.message);
}
```

## Performance Tips

- Use streaming for long responses to improve UX
- Set appropriate `maxTokens` limits
- Use `temperature: 0` for deterministic outputs
- Set `seed` for reproducible generation

## License

Apache-2.0
