import { createHash } from 'crypto';
import type { Tool, ToolCallEnvelope, ToolRegistry } from '@acm/sdk';
import type { MemoryLedger } from './ledger.js';

type ToolGetterOptions = {
  taskId: string;
  capability: string;
  toolRegistry: ToolRegistry;
  ledger?: MemoryLedger;
};

type InstrumentedTool = Tool<any, any> & {
  call(input: any, idemKey?: string): Promise<any>;
};

function computeDigest(payload: unknown): string {
  const normalized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  const hash = createHash('sha256');
  hash.update(normalized);
  return hash.digest('hex').substring(0, 32);
}

function cloneWithInstrumentedCall(
  toolName: string,
  tool: Tool<any, any>,
  options: ToolGetterOptions
): InstrumentedTool {
  const instrumented = Object.create(tool) as InstrumentedTool;

  instrumented.call = async (input: any, idemKey?: string) => {
    const start = Date.now();
    const envelopeBase: ToolCallEnvelope = {
      id: idemKey ?? `${options.taskId}-${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name: toolName,
      input: input ?? {},
      metadata: {
        timestamp: start,
        digest: computeDigest(input ?? {}),
      },
    };

    options.ledger?.append('TOOL_CALL', {
      stage: 'start',
      taskId: options.taskId,
      capability: options.capability,
      tool: toolName,
      envelope: envelopeBase,
    });

    try {
      const result = await tool.call.call(tool, input, idemKey);
      const completed: ToolCallEnvelope = {
        ...envelopeBase,
        output: result,
        metadata: {
          ...envelopeBase.metadata,
          duration_ms: Date.now() - start,
        },
      };

      options.ledger?.append('TOOL_CALL', {
        stage: 'complete',
        taskId: options.taskId,
        capability: options.capability,
        tool: toolName,
        envelope: completed,
      });

      return result;
    } catch (error: any) {
      const errEnvelope: ToolCallEnvelope = {
        ...envelopeBase,
        error: {
          code: 'ERROR',
          message: error?.message ?? String(error),
        },
        metadata: {
          ...envelopeBase.metadata,
          duration_ms: Date.now() - start,
        },
      };

      options.ledger?.append('TOOL_CALL', {
        stage: 'error',
        taskId: options.taskId,
        capability: options.capability,
        tool: toolName,
        envelope: errEnvelope,
      });

      throw error;
    }
  };

  return instrumented;
}

export function createInstrumentedToolGetter(options: ToolGetterOptions) {
  const cache = new Map<Tool<any, any>, InstrumentedTool>();

  return (toolName: string) => {
    const tool = options.toolRegistry.get(toolName);
    if (!tool) {
      return undefined;
    }

    if (!cache.has(tool)) {
      cache.set(tool, cloneWithInstrumentedCall(toolName, tool, options));
    }

    return cache.get(tool);
  };
}
