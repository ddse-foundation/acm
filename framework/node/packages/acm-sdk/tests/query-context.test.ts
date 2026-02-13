// Tests for Change 3: query_context built-in tool on Nucleus
//
// Covers:
//   - renderContextSnapshot() outputs a catalog, NOT full JSON dumps
//   - query_context tool is auto-injected when context exists
//   - query_context is NOT injected when no context/internalContext
//   - executeQueryContext: list, read_fact, read_augmentation, read_assumptions, read_artifact
//   - executeQueryContext: error paths (missing key, out-of-range index, unknown action)
//   - Tool loop: LLM calls query_context → result appended to prompt → LLM called again
//   - Tool loop: mixed query_context + other tool calls → other calls returned
//   - Tool loop: maxQueryRounds configurable (default 25), then falls back without query_context
//   - sizeBytes tracked on InternalContextScopeImpl.addArtifact

import {
  DeterministicNucleus,
  ContextBuilder,
  InternalContextScopeImpl,
  estimateTokens,
  type NucleusConfig,
  type LLMCallFn,
  type NucleusToolDefinition,
  type StructuredToolCall,
} from '../src/index.js';

// ── Helpers ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}:`, (err as Error).message);
    failed++;
  }
}

function makeConfig(overrides?: Partial<NucleusConfig>): NucleusConfig {
  const builder = new ContextBuilder();
  builder
    .addFact('projectName', 'acme-app')
    .addFact('fileCount', 42)
    .addFact('largeBlob', 'x'.repeat(5000))
    .addAssumption('TypeScript project')
    .addAssumption('Uses pnpm')
    .addAugmentation('code-snippet', '{"file":"index.ts","content":"export const x = 1;"}');

  const context = builder.build();
  const contextRef = ContextBuilder.computeContextRef(context);

  return {
    goalId: 'GOAL-TEST',
    goalIntent: 'Test query_context tool',
    taskId: 'test-task',
    contextRef,
    context,
    llmCall: {
      provider: 'mock',
      model: 'mock-model',
      temperature: 0,
    },
    hooks: {
      preflight: true,
      postcheck: false,
    },
    ...overrides,
  };
}

function noopLedger(entry: any) {}

// ── Tests ────────────────────────────────────────────────────

console.log('Running query_context tests');
console.log('='.repeat(60));

// ── 1. renderContextSnapshot shows catalog, not content ──────

await runTest('renderContextSnapshot shows fact keys with sizes, not full JSON', async () => {
  const prompts: string[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    prompts.push(prompt);
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.preflight();

  const prompt = prompts[0];
  // Should contain key names
  assert(prompt.includes('projectName'), 'prompt should contain fact key "projectName"');
  assert(prompt.includes('fileCount'), 'prompt should contain fact key "fileCount"');
  assert(prompt.includes('largeBlob'), 'prompt should contain fact key "largeBlob"');

  // Should contain sizes and type hints
  assert(prompt.includes('chars)'), 'prompt should show char sizes');
  assert(prompt.includes('[string]'), 'prompt should show type hint for string facts');
  assert(prompt.includes('[number]'), 'prompt should show type hint for number facts');
  assert(prompt.includes('Facts (3 keys)'), 'prompt should show fact count');

  // Should NOT contain the actual large blob value
  assert(!prompt.includes('x'.repeat(100)), 'prompt must NOT contain large blob content');

  // Should NOT contain full JSON.stringify of facts
  assert(!prompt.includes('"projectName": "acme-app"'), 'prompt must NOT contain JSON-formatted fact values');

  // Should mention query_context usage
  assert(prompt.includes('query_context'), 'prompt should mention query_context tool');

  // Should show assumptions count
  assert(prompt.includes('Assumptions: 2 items'), 'prompt should show assumptions count');

  // Should show augmentations summary
  assert(prompt.includes('Augmentations: 1'), 'prompt should summarize augmentations');
});

// ── 2. renderContextSnapshot shows internal artifacts catalog ─

await runTest('renderContextSnapshot includes internal artifact catalog with sizeBytes', async () => {
  const prompts: string[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    prompts.push(prompt);
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);

  const scope = new InternalContextScopeImpl();
  scope.addArtifact('source-file', { path: 'main.ts', content: 'const a = 1;' });
  nucleus.setInternalContext(scope);

  await nucleus.preflight();

  const prompt = prompts[0];
  assert(prompt.includes('Internal Artifacts (1)'), 'prompt should show internal artifact count');
  assert(prompt.includes('[source-file]'), 'prompt should show artifact type');
  assert(prompt.includes('bytes)'), 'prompt should show sizeBytes');
});

// ── 3. query_context tool auto-injected when context exists ──

await runTest('query_context tool auto-injected when context has facts', async () => {
  let receivedTools: NucleusToolDefinition[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    receivedTools = tools;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  const queryTool = receivedTools.find(t => t.name === 'query_context');
  assert(queryTool !== undefined, 'query_context should be injected');
  assert(queryTool!.inputSchema?.properties?.action !== undefined, 'should have action param');
});

// ── 4. query_context NOT injected when no context ────────────

await runTest('query_context NOT injected when context has no facts and no internalContext', async () => {
  let receivedTools: NucleusToolDefinition[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    receivedTools = tools;
    return { toolCalls: [] };
  };

  const config = makeConfig({
    context: { id: 'empty', facts: {} },
  });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  const queryTool = receivedTools.find(t => t.name === 'query_context');
  assert(queryTool === undefined, 'query_context should NOT be injected for empty context');
});

// ── 5. query_context injected when only internalContext exists ─

await runTest('query_context injected when internalContext present even with empty facts', async () => {
  let receivedTools: NucleusToolDefinition[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    receivedTools = tools;
    return { toolCalls: [] };
  };

  const config = makeConfig({ context: { id: 'empty', facts: {} } });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const scope = new InternalContextScopeImpl();
  scope.addArtifact('doc', { text: 'hello' });
  nucleus.setInternalContext(scope);

  await nucleus.invoke({ prompt: 'test', tools: [] });

  const queryTool = receivedTools.find(t => t.name === 'query_context');
  assert(queryTool !== undefined, 'query_context should be injected when internalContext exists');
});

// ── 6. Tool loop: LLM queries context, gets results, called again ─

await runTest('Tool loop: LLM calls query_context, result fed back, LLM called again', async () => {
  let callCount = 0;
  const prompts: string[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    prompts.push(prompt);
    callCount++;

    if (callCount === 1) {
      // First call: LLM decides to query a fact
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_fact', key: 'projectName' },
        }],
      };
    }
    // Second call: LLM has the data, returns final answer
    return {
      reasoning: 'Got the project name',
      toolCalls: [],
    };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  const result = await nucleus.invoke({ prompt: 'What project is this?', tools: [] });

  assert(callCount === 2, `LLM should be called twice, got ${callCount}`);
  assert(prompts[1].includes('acme-app'), 'Second prompt should contain the fact value');
  assert(prompts[1].includes('Context Query Results'), 'Second prompt should include results header');
  assert(result.reasoning === 'Got the project name', 'Final result should be from second call');
});

// ── 7. Tool loop: list action returns full catalog ────────────

await runTest('Tool loop: list action returns catalog of facts, augmentations, assumptions', async () => {
  let callCount = 0;
  let listResult: string | undefined;

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'list' },
        }],
      };
    }
    // Capture the fed-back prompt to verify list content
    listResult = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  const scope = new InternalContextScopeImpl();
  const artId = scope.addArtifact('test-doc', { text: 'sample' });
  nucleus.setInternalContext(scope);

  await nucleus.invoke({ prompt: 'List context', tools: [] });

  assert(listResult!.includes('projectName'), 'list should include fact keys');
  assert(listResult!.includes('fileCount'), 'list should include fact keys');
  assert(listResult!.includes('sizeChars'), 'list should include sizes');
  assert(listResult!.includes('"type"'), 'list should include type field');
  assert(listResult!.includes('assumptions'), 'list should include assumptions count');
  assert(listResult!.includes('code-snippet'), 'list should include augmentation types');
  assert(listResult!.includes(artId), 'list should include internal artifact IDs');
});

// ── 8. Tool loop: read_fact returns correct value ─────────────

await runTest('Tool loop: read_fact returns the actual fact value', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_fact', key: 'fileCount' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'How many files?', tools: [] });

  assert(fedBackPrompt.includes('42'), 'Should contain the fact value 42');
});

// ── 9. Tool loop: read_fact with missing key returns error ────

await runTest('Tool loop: read_fact with missing key returns error', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_fact', key: 'nonexistent' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('not found'), 'Should contain error message for missing key');
});

// ── 10. Tool loop: read_augmentation returns correct item ─────

await runTest('Tool loop: read_augmentation returns augmentation by index', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_augmentation', index: 0 },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'get augmentation', tools: [] });

  assert(fedBackPrompt.includes('code-snippet'), 'Should contain augmentation type');
  assert(fedBackPrompt.includes('index.ts'), 'Should contain augmentation artifact content');
});

// ── 11. Tool loop: read_augmentation out of range ─────────────

await runTest('Tool loop: read_augmentation with out-of-range index returns error', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_augmentation', index: 99 },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('out of range'), 'Should contain out of range error');
});

// ── 12. Tool loop: read_assumptions returns array ─────────────

await runTest('Tool loop: read_assumptions returns all assumptions', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_assumptions' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('TypeScript project'), 'Should contain first assumption');
  assert(fedBackPrompt.includes('Uses pnpm'), 'Should contain second assumption');
});

// ── 13. Tool loop: read_artifact from internalContext ──────────

await runTest('Tool loop: read_artifact returns content from internalContext', async () => {
  let callCount = 0;
  let fedBackPrompt = '';
  let artifactId = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_artifact', artifactId },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  const scope = new InternalContextScopeImpl();
  artifactId = scope.addArtifact('analysis-report', { summary: 'All good', score: 95 });
  nucleus.setInternalContext(scope);

  await nucleus.invoke({ prompt: 'read artifact', tools: [] });

  assert(fedBackPrompt.includes('All good'), 'Should contain artifact content');
  assert(fedBackPrompt.includes('95'), 'Should contain artifact score');
});

// ── 14. Tool loop: read_artifact with missing ID returns error ─

await runTest('Tool loop: read_artifact with missing ID returns error', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_artifact', artifactId: 'bogus-id' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  const scope = new InternalContextScopeImpl();
  nucleus.setInternalContext(scope);

  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('not found'), 'Should contain artifact not found error');
});

// ── 15. Tool loop: unknown action returns error ───────────────

await runTest('Tool loop: unknown action returns descriptive error', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'delete_everything' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('Unknown action'), 'Should contain unknown action error');
});

// ── 16. Tool loop: mixed query_context + other calls ──────────

await runTest('Tool loop: mixed query_context + other tool calls returns other calls', async () => {
  let callCount = 0;

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    return {
      reasoning: 'Need fact and also emit plan',
      toolCalls: [
        { name: 'query_context', input: { action: 'read_fact', key: 'projectName' } },
        { name: 'emit_plan', input: { planId: 'plan-a', tasks: [], edges: [] } },
      ],
    };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  const result = await nucleus.invoke({
    prompt: 'plan something',
    tools: [{ name: 'emit_plan', description: 'Emit plan', inputSchema: { type: 'object', properties: {}, required: [] } }],
  });

  // Should return emit_plan, NOT query_context
  assert(result.toolCalls.length === 1, `Should have 1 tool call, got ${result.toolCalls.length}`);
  assert(result.toolCalls[0].name === 'emit_plan', 'Returned call should be emit_plan');
  assert(callCount === 1, 'Should only call LLM once (no loop needed)');
});

// ── 17. Tool loop: maxQueryRounds is configurable, default 25 ─

await runTest('Tool loop: exhausts maxQueryRounds then does final call without query_context', async () => {
  const MAX = 5; // use a small value to keep the test fast
  let callCount = 0;
  const toolSets: NucleusToolDefinition[][] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    toolSets.push([...tools]);
    // Always return query_context — simulates an LLM that keeps querying
    return {
      toolCalls: [{
        name: 'query_context',
        input: { action: 'list' },
      }],
    };
  };

  const nucleus = new DeterministicNucleus(
    makeConfig({ maxQueryRounds: MAX }),
    llm,
    noopLedger
  );
  const result = await nucleus.invoke({ prompt: 'test', tools: [] });

  // Rounds 0..(MAX-2) use built-in tools (MAX-1 rounds), round MAX-1 is last round with no built-ins
  // Last round catches built-in calls via guard → no separate fallback needed = MAX total calls
  assert(callCount === MAX, `Should call LLM ${MAX} times (last round serves as final), got ${callCount}`);

  // Last round (MAX-th call, 0-indexed=MAX-1) should NOT include query_context
  const lastRoundTools = toolSets[MAX - 1];
  const hasQueryInLastRound = lastRoundTools.some(t => t.name === 'query_context');
  assert(!hasQueryInLastRound, 'Last round should NOT include query_context tool');
});

// ── 17b. Default maxQueryRounds is 3 ─────────────────────────

await runTest('Default maxQueryRounds is 3', async () => {
  let callCount = 0;

  const llm: LLMCallFn = async () => {
    callCount++;
    // Keep querying every round — LLM never stops on its own
    return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
  };

  const config = makeConfig();
  // Verify the default is 3 (v0.5.2 cap)
  assert(config.maxQueryRounds === undefined, 'Default config should not set maxQueryRounds');

  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  // 3 rounds total: rounds 0-1 have builtins, round 2 (last) strips builtins
  // and treats the response as final — no extra call after the loop
  assert(callCount === 3, `Expected 3 calls (maxQueryRounds=3), got ${callCount}`);
});

// ── 18. Multiple query_context calls in single round ──────────

await runTest('Tool loop: multiple query_context calls in single round all resolved', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [
          { name: 'query_context', input: { action: 'read_fact', key: 'projectName' } },
          { name: 'query_context', input: { action: 'read_fact', key: 'fileCount' } },
        ],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('acme-app'), 'Should contain projectName value');
  assert(fedBackPrompt.includes('42'), 'Should contain fileCount value');
  assert(callCount === 2, 'Should call LLM twice');
});

// ── 19. Ledger entries recorded for query rounds ──────────────

await runTest('Ledger entries recorded for intermediate query_context rounds', async () => {
  let callCount = 0;
  const ledgerEntries: any[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_fact', key: 'projectName' },
        }],
      };
    }
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, (e) => ledgerEntries.push(e));
  await nucleus.invoke({ prompt: 'test', tools: [] });

  // Should have ledger entries for both rounds
  const inferenceEntries = ledgerEntries.filter(e => e.type === 'NUCLEUS_INFERENCE');
  assert(inferenceEntries.length === 2, `Should have 2 inference entries, got ${inferenceEntries.length}`);
});

// ── 20. InternalContextScopeImpl tracks sizeBytes ─────────────

await runTest('InternalContextScopeImpl.addArtifact tracks sizeBytes', async () => {
  const scope = new InternalContextScopeImpl();

  // String content
  const id1 = scope.addArtifact('text', 'hello world');
  const art1 = scope.artifacts.find(a => a.id === id1)!;
  assert(art1.sizeBytes !== undefined, 'sizeBytes should be set');
  assert(art1.sizeBytes! === Buffer.byteLength('hello world', 'utf8'), 'sizeBytes should match string byte length');

  // Object content
  const obj = { key: 'value', nested: { a: 1 } };
  const id2 = scope.addArtifact('json', obj);
  const art2 = scope.artifacts.find(a => a.id === id2)!;
  assert(art2.sizeBytes !== undefined, 'sizeBytes should be set for objects');
  assert(art2.sizeBytes! === Buffer.byteLength(JSON.stringify(obj), 'utf8'), 'sizeBytes should match JSON byte length');
});

// ── 21. Read artifact when no internalContext set ─────────────

await runTest('Tool loop: read_artifact with no internalContext returns error', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_artifact', artifactId: 'some-id' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  // Deliberately NOT setting internalContext
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('No internal context'), 'Should return no internal context error');
});

// ── 22. read_assumptions with no assumptions ──────────────────

await runTest('Tool loop: read_assumptions with no assumptions returns empty array', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const builder = new ContextBuilder();
  builder.addFact('key', 'val');
  const ctx = builder.build();

  const llm: LLMCallFn = async (prompt, tools, config) => {
    callCount++;
    if (callCount === 1) {
      return {
        toolCalls: [{
          name: 'query_context',
          input: { action: 'read_assumptions' },
        }],
      };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const config = makeConfig({ context: ctx });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('[]'), 'Should return empty array');
});

// ── 23. Existing user tools preserved alongside query_context ─

await runTest('User-provided tools preserved when query_context is injected', async () => {
  let receivedTools: NucleusToolDefinition[] = [];

  const llm: LLMCallFn = async (prompt, tools, config) => {
    receivedTools = tools;
    return { toolCalls: [] };
  };

  const userTool: NucleusToolDefinition = {
    name: 'my_tool',
    description: 'A custom tool',
    inputSchema: { type: 'object', properties: {}, required: [] },
  };

  const nucleus = new DeterministicNucleus(makeConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [userTool] });

  const myTool = receivedTools.find(t => t.name === 'my_tool');
  const queryTool = receivedTools.find(t => t.name === 'query_context');
  const retrievalTool = receivedTools.find(t => t.name === 'request_context_retrieval');
  assert(myTool !== undefined, 'User tool should still be present');
  assert(queryTool !== undefined, 'query_context should also be present');
  assert(retrievalTool !== undefined, 'request_context_retrieval should also be present');
  assert(receivedTools.length === 3, `Should have exactly 3 tools (user + query_context + request_context_retrieval), got ${receivedTools.length}`);
});

// ══════════════════════════════════════════════════════════════
// Realistic data tests — modeled on actual aiagent production data
// ══════════════════════════════════════════════════════════════

/**
 * Build a context that mirrors what the real aiagent creates:
 * facts.message = string
 * facts.previousConversations = Array of { timestamp, message } (huge markdown)
 * facts.selectedFiles = Array of ID strings
 * facts.selectedMetanodes = Array of { id, type, name }
 * facts.selectedSymbols = empty array
 * facts.attachments = empty array
 * augmentations = [] (empty — common in real data)
 * assumptions = undefined (never set from UI)
 */
function makeRealisticConfig(overrides?: Partial<NucleusConfig>): NucleusConfig {
  const context = {
    id: 'ctx-real-goal-abc',
    facts: {
      message: 'plan all the stories in details',
      previousConversations: [
        {
          timestamp: '2026-02-13T07:43:13.601Z',
          message: `[Discussion Context]\n**Technical Decision Record: Document Upload & RAG Feature Integration**\n\n---\n\n### **Decision Summary**\nThe feature to allow users to upload a folder of documents, split into chunks, and enable RAG-based chat is feasible but requires **new component development**.\n\n${'Evidence and analysis '.repeat(100)}`,
        },
        {
          timestamp: '2026-02-13T08:10:00.000Z',
          message: `[Context Retrieval]\nRelevant code:\n\`\`\`typescript\nclass ChatComponent {\n  sendMessage() { /* ... */ }\n}\n\`\`\`\n${'More code context '.repeat(50)}`,
        },
      ],
      selectedFiles: [
        'e5bb6b6:file:main.ts',
        'd5ad30ab:file:chat.service.ts',
        '58e356b8:file:chat.component.ts',
      ],
      selectedMetanodes: [
        { id: 'project-root', type: 'Package', name: 'Project Root' },
        { id: 'cd49968:file:chat.component.html', type: 'File', name: 'chat.component.html' },
        { id: '58e356b8:file:chat.component.ts', type: 'File', name: 'chat.component.ts' },
        { id: 'a0ef158:file:chat.component.css', type: 'File', name: 'chat.component.css' },
        { id: 'e70ab4ad:file:index.html', type: 'File', name: 'index.html' },
        { id: '58e356b8:file:chat.component.ts:method:ChatComponent.sendMessage', type: 'Method', name: 'chat.component.ts' },
        { id: 'd5ad30ab:file:chat.service.ts:method:ChatService.sendMessage', type: 'Method', name: 'chat.service.ts' },
        { id: 'cb90137c:file:app.module.ts', type: 'File', name: 'app.module.ts' },
        { id: 'bc366f2b:file:app.component.ts', type: 'File', name: 'app.component.ts' },
        { id: '4111adf:file:app-routing.module.ts', type: 'File', name: 'app-routing.module.ts' },
      ],
      selectedSymbols: [],
      attachments: [],
    },
    augmentations: [],
  };

  return {
    goalId: 'f4c4baea-aad3-46b3-b993-6e5326441a25',
    goalIntent: 'plan all the stories in details',
    taskId: 'theme-1',
    contextRef: 'real-ref',
    context,
    llmCall: { provider: 'mock', model: 'mock-model', temperature: 0 },
    hooks: { preflight: true, postcheck: false },
    ...overrides,
  };
}

// ── 24. Realistic: snapshot shows type hints for arrays/objects ─

await runTest('Realistic: snapshot shows Array(N) and object(K keys) type hints', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  await nucleus.preflight();
  const prompt = prompts[0];

  // previousConversations is Array(2)
  assert(prompt.includes('[Array(2)]'), 'should show Array(2) for previousConversations');
  // selectedMetanodes is Array(10)
  assert(prompt.includes('[Array(10)]'), 'should show Array(10) for selectedMetanodes');
  // selectedFiles is Array(3)
  assert(prompt.includes('[Array(3)]'), 'should show Array(3) for selectedFiles');
  // message is string
  assert(prompt.includes('[string]'), 'should show string type for message');
  // selectedSymbols is Array(0)
  assert(prompt.includes('[Array(0)]'), 'should show Array(0) for empty arrays');
});

// ── 25. Realistic: snapshot does NOT dump huge conversation text ─

await runTest('Realistic: snapshot does NOT dump previousConversations content', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  await nucleus.preflight();
  const prompt = prompts[0];

  // Should NOT contain the actual conversation content
  assert(!prompt.includes('Technical Decision Record'), 'must NOT contain conversation markdown');
  assert(!prompt.includes('Evidence and analysis'), 'must NOT contain repeated text');
  assert(!prompt.includes('ChatComponent'), 'must NOT contain code from conversations');
});

// ── 26. Realistic: empty augmentations + no assumptions ──────

await runTest('Realistic: empty augmentations array, no assumptions — clean snapshot', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  await nucleus.preflight();
  const prompt = prompts[0];

  // Should NOT mention augmentations (empty array)
  assert(!prompt.includes('Augmentations:'), 'should NOT show Augmentations section for empty array');
  // Should NOT mention assumptions (field absent)
  assert(!prompt.includes('Assumptions:'), 'should NOT show Assumptions section when missing');
});

// ── 27. Realistic: list catalog includes type field for rich facts ─

await runTest('Realistic: list catalog returns type field for complex fact values', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt) => {
    callCount++;
    if (callCount === 1) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  // list result should include type info
  assert(fedBackPrompt.includes('"type"'), 'should include type field in catalog');
  assert(fedBackPrompt.includes('Array(2)'), 'should show Array(2) for previousConversations');
  assert(fedBackPrompt.includes('Array(10)'), 'should show Array(10) for selectedMetanodes');
  assert(fedBackPrompt.includes('"string"'), 'should show string type for message');
});

// ── 28. Realistic: read_fact returns full array content ───────

await runTest('Realistic: read_fact returns full array content for selectedMetanodes', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt) => {
    callCount++;
    if (callCount === 1) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'read_fact', key: 'selectedMetanodes' } }] };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  // Should contain the actual metanode objects
  assert(fedBackPrompt.includes('project-root'), 'should contain first metanode id');
  assert(fedBackPrompt.includes('ChatComponent.sendMessage'), 'should contain method metanode');
  assert(fedBackPrompt.includes('Package'), 'should contain metanode type');
});

// ── 29. Realistic: read_fact on previousConversations returns large content ─

await runTest('Realistic: read_fact on previousConversations returns full conversation array', async () => {
  let callCount = 0;
  let fedBackPrompt = '';

  const llm: LLMCallFn = async (prompt) => {
    callCount++;
    if (callCount === 1) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'read_fact', key: 'previousConversations' } }] };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  await nucleus.invoke({ prompt: 'test', tools: [] });

  assert(fedBackPrompt.includes('Technical Decision Record'), 'should contain conversation content');
  assert(fedBackPrompt.includes('2026-02-13'), 'should contain timestamps');
});

// ── 30. Realistic: addArtifact with provenance metadata (sourceId, path) ─

await runTest('Realistic: addArtifact stores extra provenance fields (sourceId, path)', async () => {
  const scope = new InternalContextScopeImpl();

  const id = scope.addArtifact(
    'retrieved_document',
    { nodeId: 'abc123', content: 'class ChatService { ... }', score: 0.92 },
    { tool: 'planning_retrieval', rationale: 'retrieved with score 0.92', sourceId: 'abc123', path: 'src/chat.service.ts' }
  );

  const artifact = scope.artifacts.find(a => a.id === id)!;
  assert(artifact.provenance !== undefined, 'provenance should be set');
  assert(artifact.provenance!.tool === 'planning_retrieval', 'tool should be stored');
  assert(artifact.provenance!.rationale === 'retrieved with score 0.92', 'rationale should be stored');
  assert((artifact.provenance! as any).sourceId === 'abc123', 'sourceId should be stored');
  assert((artifact.provenance! as any).path === 'src/chat.service.ts', 'path should be stored');
  assert(artifact.sizeBytes! > 0, 'sizeBytes should be > 0');
});

// ── 31. Realistic: multiple artifact types in internalContext ─

await runTest('Realistic: multiple artifact types (retrieved_document, parent_task_output)', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  const scope = new InternalContextScopeImpl();

  // Simulate seedInternalScope from real AcmTaskAdapter
  scope.addArtifact('retrieved_document', {
    nodeId: 'abc',
    content: 'Angular component code',
    score: 0.85,
  }, { tool: 'planning_retrieval', rationale: 'retrieved with score 0.85' });

  scope.addArtifact('retrieved_document', {
    nodeId: 'def',
    content: 'Service implementation',
    score: 0.78,
  }, { tool: 'planning_retrieval', rationale: 'retrieved with score 0.78' });

  scope.addArtifact('parent_task_output', {
    artifactId: 'theme-001',
    content: '# Document Upload & RAG Integration\n\nTheme description...',
  }, { tool: 'task_dependency', rationale: 'Output from parent task theme-001' });

  nucleus.setInternalContext(scope);
  await nucleus.preflight();

  const prompt = prompts[0];
  assert(prompt.includes('Internal Artifacts (3)'), 'should show 3 artifacts');
  assert(prompt.includes('[retrieved_document]'), 'should show retrieved_document type');
  assert(prompt.includes('[parent_task_output]'), 'should show parent_task_output type');
});

// ── 32. Realistic: read_artifact returns original object ─────

await runTest('Realistic: read_artifact returns original object, not serialized string', async () => {
  let callCount = 0;
  let fedBackPrompt = '';
  let artifactId = '';

  const llm: LLMCallFn = async (prompt) => {
    callCount++;
    if (callCount === 1) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'read_artifact', artifactId } }] };
    }
    fedBackPrompt = prompt;
    return { toolCalls: [] };
  };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  const scope = new InternalContextScopeImpl();
  artifactId = scope.addArtifact('parent_task_output', {
    title: 'Document Upload Theme',
    description: 'Enable document upload and RAG-based chat',
    stories: ['upload-service', 'chunker-service', 'vector-store'],
  }, { tool: 'task_dependency' });
  nucleus.setInternalContext(scope);

  await nucleus.invoke({ prompt: 'read artifact', tools: [] });

  assert(fedBackPrompt.includes('Document Upload Theme'), 'should contain title');
  assert(fedBackPrompt.includes('chunker-service'), 'should contain story reference');
  assert(fedBackPrompt.includes('stories'), 'should contain stories field');
});

// ── 33. Realistic: fact value is a deeply nested object (plannerHints) ─

await runTest('Realistic: fact with deeply nested structures shows object(N keys) type', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const config = makeRealisticConfig();
  (config.context as any).facts.plannerHints = {
    taskDecomposition: [
      'Each task MUST produce exactly ONE artifact',
      'Available artifact types for Manager: THEME, EPIC, FEATURE, STORY, UX',
    ],
    minimumTaskCount: 5,
    ddseRole: 'manager',
  };

  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();
  const prompt = prompts[0];

  assert(prompt.includes('plannerHints'), 'should show plannerHints key');
  assert(prompt.includes('[object('), 'should show object type for plannerHints');
});

// ── 34. Realistic: query_context round-trip with real artifact types ─

await runTest('Realistic: LLM queries list then reads specific retrieved_document', async () => {
  let callCount = 0;
  let lastPrompt = '';
  let targetArtifactId = '';

  const llm: LLMCallFn = async (prompt) => {
    callCount++;
    lastPrompt = prompt;
    if (callCount === 1) {
      // First: list to see what's available
      return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
    }
    if (callCount === 2) {
      // Second: read a specific artifact by ID found in list
      return { toolCalls: [{ name: 'query_context', input: { action: 'read_artifact', artifactId: targetArtifactId } }] };
    }
    // Third: has the content, emits a tool call
    return {
      reasoning: 'Read the document, now proceeding',
      toolCalls: [{ name: 'emit_plan', input: { planId: 'plan-a', tasks: [] } }],
    };
  };

  const nucleus = new DeterministicNucleus(makeRealisticConfig(), llm, noopLedger);
  const scope = new InternalContextScopeImpl();
  targetArtifactId = scope.addArtifact('retrieved_document', {
    nodeId: 'chat-service-node',
    content: 'export class ChatService { constructor(private http: HttpClient) {} sendMessage(msg: string) { return this.http.post("/api/chat", { message: msg }); } }',
    path: 'src/app/chat.service.ts',
  }, { tool: 'planning_retrieval' });
  nucleus.setInternalContext(scope);

  const result = await nucleus.invoke({
    prompt: 'Plan the implementation',
    tools: [{ name: 'emit_plan', description: 'Emit plan', inputSchema: { type: 'object', properties: {}, required: [] } }],
  });

  assert(callCount === 3, `Should call LLM 3 times (list → read → act), got ${callCount}`);
  assert(result.toolCalls.length === 1, 'Should return emit_plan');
  assert(result.toolCalls[0].name === 'emit_plan', 'Should be emit_plan');
  assert(lastPrompt.includes('ChatService'), 'Last prompt should contain read artifact content');
});

// ── 35. Realistic: fact is number — type shows "number" ──────

await runTest('Realistic: number fact shows [number] type in snapshot and catalog', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const builder = new ContextBuilder();
  builder.addFact('taskCount', 42);
  builder.addFact('costEstimate', 3.14);
  builder.addFact('isReady', true);
  const ctx = builder.build();

  const config = makeConfig({ context: ctx });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();
  const prompt = prompts[0];

  assert(prompt.includes('[number]'), 'should show number type');
  assert(prompt.includes('[boolean]'), 'should show boolean type');
});

// ── 36. Realistic: null/undefined fact handled gracefully ────

await runTest('Realistic: null fact value shows [null] type', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const builder = new ContextBuilder();
  builder.addFact('pendingReview', null);
  builder.addFact('name', 'test');
  const ctx = builder.build();

  const config = makeConfig({ context: ctx });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();
  const prompt = prompts[0];

  assert(prompt.includes('[null]'), 'should show null type');
  assert(prompt.includes('pendingReview'), 'should show key name');
});

// ═══════════════════════════════════════════════════════════════
// Anti-Hallucination Grounding Tests (37-42)
// ═══════════════════════════════════════════════════════════════

// ── 37. Preflight prompt contains hallucination warning ──────

await runTest('Preflight prompt warns against hallucination', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const config = makeConfig();
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();

  const prompt = prompts[0];
  assert(prompt.includes('hallucinating information violates the core ACM contract'),
    'Preflight should warn that hallucination violates the ACM contract');
  assert(prompt.includes('request_context_retrieval'),
    'Preflight should mention request_context_retrieval as remedy');
  assert(prompt.includes('WITHOUT fabricating data'),
    'Preflight should explicitly mention fabricating data');
});

// ── 38. Invoke prompt contains GROUNDING RULES ───────────────

await runTest('Invoke prompt contains GROUNDING RULES section', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const config = makeConfig();
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight(); // first call
  // Use input (not prompt) so buildInvokePrompt is triggered
  await nucleus.invoke({ input: { task: 'do something' }, tools: [] });

  const invokePrompt = prompts[1]; // second call is invoke
  assert(invokePrompt.includes('## GROUNDING RULES'),
    'Invoke prompt should have GROUNDING RULES section');
  assert(invokePrompt.includes('Do NOT fabricate information'),
    'Invoke prompt should forbid fabrication');
  assert(invokePrompt.includes('cite which fact key'),
    'Invoke prompt should require citation');
  assert(invokePrompt.includes('request_context_retrieval'),
    'Invoke prompt should mention retrieval fallback');
});

// ── 39. Postcheck prompt contains VALIDATION RULES ──────────

await runTest('Postcheck prompt contains VALIDATION RULES section', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  // Enable postcheck hook so the LLM is actually called
  const config = makeConfig({ hooks: { preflight: true, postcheck: true } });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();
  await nucleus.invoke({ input: { task: 'do something' }, tools: [] });
  await nucleus.postcheck({ answer: 'hello' });

  const postcheckPrompt = prompts[2]; // third call is postcheck
  assert(postcheckPrompt.includes('## VALIDATION RULES'),
    'Postcheck prompt should have VALIDATION RULES section');
  assert(postcheckPrompt.includes('grounded in the provided context'),
    'Postcheck should verify grounding');
  assert(postcheckPrompt.includes('fabricated information'),
    'Postcheck should flag fabrication');
  assert(postcheckPrompt.includes('request_compensation'),
    'Postcheck should mention compensation for ungrounded output');
});

// ── 40. Context snapshot contains GROUNDING CONSTRAINT ───────

await runTest('Context snapshot footer has GROUNDING CONSTRAINT warning', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const config = makeConfig();
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();

  const prompt = prompts[0];
  assert(prompt.includes('⚠️ GROUNDING CONSTRAINT'),
    'Snapshot should have ⚠️ GROUNDING CONSTRAINT label');
  assert(prompt.includes('You MUST use the query_context tool'),
    'Snapshot should mandate query_context usage');
  assert(prompt.includes('Do NOT invent or assume data'),
    'Snapshot should forbid inventing data');
  assert(prompt.includes('Cite which keys/IDs'),
    'Snapshot should require citation of keys/IDs');
});

// ── 41. All three prompts ground against context snapshot ────

await runTest('All three prompt stages include context grounding', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  // Enable both preflight and postcheck hooks
  const config = makeConfig({ hooks: { preflight: true, postcheck: true } });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();
  // Use input (not prompt) so buildInvokePrompt is triggered
  await nucleus.invoke({ input: { task: 'do something' }, tools: [] });
  await nucleus.postcheck({ result: 'ok' });

  // Preflight (prompts[0]) — includes context snapshot with grounding constraint
  assert(prompts[0].includes('⚠️ GROUNDING CONSTRAINT'), 'Preflight should include grounding constraint');
  assert(prompts[0].includes('hallucinating'), 'Preflight should mention hallucinating');

  // Invoke (prompts[1]) — includes context snapshot AND grounding rules
  assert(prompts[1].includes('⚠️ GROUNDING CONSTRAINT'), 'Invoke should include grounding constraint');
  assert(prompts[1].includes('GROUNDING RULES'), 'Invoke should include grounding rules');

  // Postcheck (prompts[2]) — includes validation rules
  assert(prompts[2].includes('VALIDATION RULES'), 'Postcheck should include validation rules');
});

// ── 42. No-context nucleus still warns about missing context ─

await runTest('No-context nucleus warns about missing context in snapshot', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  // No context at all — enable preflight so the LLM is called
  const config: NucleusConfig = {
    goalId: 'GOAL-EMPTY',
    goalIntent: 'Test empty context',
    taskId: 'empty-task',
    contextRef: 'ref-empty',
    llmCall: { provider: 'mock', model: 'mock-model' },
    hooks: { preflight: true },
  };
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();

  const prompt = prompts[0];
  assert(prompt.includes('No context payload provided'),
    'Should warn about missing context');
  assert(prompt.includes('consider supplying context.facts'),
    'Should suggest supplying context');
});

// ═══════════════════════════════════════════════════════════════
// Mid-Invoke External Retrieval Tests (43-46)
// ═══════════════════════════════════════════════════════════════

// ── 43. request_context_retrieval is always injected as a tool ─

await runTest('request_context_retrieval is always injected as a formal tool', async () => {
  let receivedTools: NucleusToolDefinition[] = [];
  const llm: LLMCallFn = async (prompt, tools) => {
    receivedTools = tools;
    return { toolCalls: [] };
  };

  // Even with NO context at all, retrieval tool should be present
  const config: NucleusConfig = {
    goalId: 'GOAL-N',
    goalIntent: 'Test retrieval tool injection',
    taskId: 't1',
    contextRef: 'ref',
    llmCall: { provider: 'mock', model: 'mock' },
    hooks: { preflight: true },
  };
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();

  const retrievalTool = receivedTools.find(t => t.name === 'request_context_retrieval');
  assert(retrievalTool !== undefined, 'request_context_retrieval should be injected even without context');
  assert(retrievalTool!.inputSchema!.properties.directive,
    'Should have directive property in schema');
});

// ── 44. Mid-invoke retrieval fulfilled when contextProvider set ─

await runTest('Mid-invoke: contextProvider fulfills request_context_retrieval inline', async () => {
  let callCount = 0;
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt, tools) => {
    callCount++;
    prompts.push(prompt);
    if (callCount === 1) {
      // First round: LLM requests external retrieval
      return { toolCalls: [{ name: 'request_context_retrieval', input: { directive: 'retrieve user API docs' } }] };
    }
    // Second round: LLM reads the newly added artifact, then answers
    if (callCount === 2) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
    }
    // Third round: answers
    return { toolCalls: [{ name: 'emit_result', input: { answer: 'done' } }] };
  };

  // Create a mock contextProvider
  const mockProvider = {
    fulfill: async (request: any) => {
      // Simulate adding an artifact to the scope
      request.scope.addArtifact('api_doc', { endpoint: '/api/users', method: 'GET' }, { tool: 'mock_search' });
    },
  } as any; // cast to ExternalContextProviderAdapter

  const config = makeConfig({ contextProvider: mockProvider });
  const scope = new InternalContextScopeImpl(noopLedger);
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  nucleus.setInternalContext(scope);

  const result = await nucleus.invoke({ input: { task: 'generate API client' }, tools: [
    { name: 'emit_result', description: 'Emit result', inputSchema: { type: 'object', properties: {}, required: [] } },
  ] });

  assert(callCount === 3, `Should call LLM 3 times (retrieval → list → answer), got ${callCount}`);
  assert(result.toolCalls[0].name === 'emit_result', 'Final result should be emit_result');
  // Verify the artifact was actually added to scope
  assert(scope.artifacts.length === 1, `Should have 1 artifact, got ${scope.artifacts.length}`);
  assert(scope.artifacts[0].type === 'api_doc', 'Artifact type should be api_doc');
  // Verify prompt mentions external retrieval
  assert(prompts[1].includes('External Context Retrieved'), 'Second prompt should mention retrieval');
});

// ── 45. Mid-invoke retrieval without contextProvider passes through ─

await runTest('Mid-invoke: without contextProvider, retrieval calls pass through as unhandled', async () => {
  const llm: LLMCallFn = async () => {
    return { toolCalls: [{ name: 'request_context_retrieval', input: { directive: 'need more data' } }] };
  };

  // No contextProvider set
  const config = makeConfig();
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);

  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  // Should return the retrieval call as-is (unhandled)
  assert(result.toolCalls.length >= 1, 'Should have tool calls');
  const retrievalCall = result.toolCalls.find(tc => tc.name === 'request_context_retrieval');
  assert(retrievalCall !== undefined, 'retrieval call should pass through when no contextProvider');
  assert(retrievalCall!.input.directive === 'need more data', 'directive should be preserved');
});

// ── 46. Prompts contain CONTEXT TOOLS guidance ──────────────────

await runTest('Prompts explain both query_context and request_context_retrieval', async () => {
  const prompts: string[] = [];
  const llm: LLMCallFn = async (prompt) => { prompts.push(prompt); return { toolCalls: [] }; };

  const config = makeConfig({ hooks: { preflight: true, postcheck: false } });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  await nucleus.preflight();
  await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  // Preflight should explain both tools
  assert(prompts[0].includes('## CONTEXT TOOLS'), 'Preflight should have CONTEXT TOOLS section');
  assert(prompts[0].includes('query_context'), 'Preflight should mention query_context');
  assert(prompts[0].includes('request_context_retrieval'), 'Preflight should mention request_context_retrieval');
  assert(prompts[0].includes('ALREADY in your scope'), 'Preflight should say query_context reads existing data');
  assert(prompts[0].includes('NOT in your scope'), 'Preflight should say retrieval fetches external data');

  // Invoke should also explain both tools
  assert(prompts[1].includes('## CONTEXT TOOLS'), 'Invoke should have CONTEXT TOOLS section');
  assert(prompts[1].includes('query_context'), 'Invoke should mention query_context');
  assert(prompts[1].includes('request_context_retrieval'), 'Invoke should mention request_context_retrieval');
});

// ═══════════════════════════════════════════════════════════════
// TOKEN BUDGET ENFORCEMENT (tests 47-53)
// ═══════════════════════════════════════════════════════════════

// ── 47. estimateTokens utility ──────────────────────────────────

await runTest('estimateTokens: plain text uses ~4 chars/token ratio', async () => {
  const plain = 'Hello world, this is a simple sentence.';
  const tokens = estimateTokens(plain);
  // 38 chars / ~3.1 ratio (symbol-dense due to comma) * 1.05 padding ≈ 13
  assert(tokens > 5 && tokens < 30, `Plain text tokens ${tokens} should be between 5 and 30`);
});

await runTest('estimateTokens: code text uses lower ratio (more tokens per char)', async () => {
  const code = 'export function hello() { const x = 42; return x; }';
  const plain = 'The quick brown fox jumps over the lazy dog repeatedly.';
  const codeTokens = estimateTokens(code);
  const plainTokens = estimateTokens(plain);
  // Code should produce more tokens per char than plain text
  const codeRatio = code.length / codeTokens;
  const plainRatio = plain.length / plainTokens;
  assert(codeRatio < plainRatio, `Code ratio ${codeRatio.toFixed(2)} should be less than plain ratio ${plainRatio.toFixed(2)}`);
});

await runTest('estimateTokens: null/undefined/empty returns 0', async () => {
  assert(estimateTokens(null) === 0, 'null should be 0');
  assert(estimateTokens(undefined) === 0, 'undefined should be 0');
  assert(estimateTokens('') === 0, 'empty should be 0');
});

// ── 48. metrics.rounds populated on simple invoke ─────────────

await runTest('metrics: rounds and estimatedPromptTokens populated on single-round invoke', async () => {
  const llm: LLMCallFn = async () => ({ toolCalls: [{ name: 'do_work', input: {} }] });
  const config = makeConfig();
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  assert(result.metrics !== undefined, 'metrics should be present');
  assert(result.metrics!.rounds === 1, `Should be 1 round, got ${result.metrics!.rounds}`);
  assert(result.metrics!.estimatedPromptTokens > 0, 'estimatedPromptTokens should be > 0');
  assert(result.metrics!.budgetExhausted === false, 'budgetExhausted should be false when no maxContextTokens');
});

// ── 49. metrics.rounds correct for multi-round query_context loop ─

await runTest('metrics: rounds increments through query_context loop', async () => {
  let callCount = 0;
  const llm: LLMCallFn = async () => {
    callCount++;
    if (callCount <= 2) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
    }
    return { toolCalls: [{ name: 'finish', input: {} }] };
  };
  const config = makeConfig();
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  assert(result.metrics !== undefined, 'metrics should be present');
  assert(result.metrics!.rounds === 3, `Should be 3 rounds, got ${result.metrics!.rounds}`);
  assert(result.metrics!.estimatedPromptTokens > 0, 'estimatedPromptTokens should be positive');
  assert(result.metrics!.budgetExhausted === false, 'budgetExhausted should be false');
});

// ── 50. Token budget forces early termination ───────────────────

await runTest('budget: maxContextTokens forces final round when 85% threshold exceeded', async () => {
  let callCount = 0;
  const toolsSeen: string[][] = [];
  const llm: LLMCallFn = async (_prompt, tools) => {
    callCount++;
    toolsSeen.push(tools.map(t => t.name));
    // Always try to use query_context (would loop forever without budget limit)
    return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
  };

  // Set a very small token budget so it's exceeded quickly
  const config = makeConfig({ maxContextTokens: 100 });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  assert(result.metrics !== undefined, 'metrics should be present');
  assert(result.metrics!.budgetExhausted === true, 'budgetExhausted should be true');
  // With a 100-token budget, 85% = 85 tokens. The first prompt is already larger,
  // so it should terminate after round 1 (build-up) + 1 final round = 2 rounds total
  assert(result.metrics!.rounds <= 3, `Should terminate early, got ${result.metrics!.rounds} rounds`);
  // The last call should NOT have built-in tools (forced final round)
  const lastToolSet = toolsSeen[toolsSeen.length - 1];
  assert(!lastToolSet.includes('query_context'), 'Last round should NOT include query_context (budget forced final)');
  assert(!lastToolSet.includes('request_context_retrieval'), 'Last round should NOT include request_context_retrieval (budget forced final)');
});

// ── 51. No budget → no early termination ─────────────────────────

await runTest('budget: without maxContextTokens, loop runs up to maxQueryRounds', async () => {
  let callCount = 0;
  const llm: LLMCallFn = async () => {
    callCount++;
    if (callCount <= 4) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
    }
    return { toolCalls: [{ name: 'finish', input: {} }] };
  };

  // No maxContextTokens, maxQueryRounds=10 (plenty)
  const config = makeConfig({ maxQueryRounds: 10 });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  assert(result.metrics !== undefined, 'metrics should be present');
  assert(result.metrics!.rounds === 5, `Should run all 5 rounds, got ${result.metrics!.rounds}`);
  assert(result.metrics!.budgetExhausted === false, 'budgetExhausted should be false without budget');
});

// ── 52. Large budget does not interfere ─────────────────────────

await runTest('budget: large maxContextTokens does not interfere with normal flow', async () => {
  let callCount = 0;
  const llm: LLMCallFn = async () => {
    callCount++;
    if (callCount === 1) {
      return { toolCalls: [{ name: 'query_context', input: { action: 'read_fact', key: 'projectName' } }] };
    }
    return { toolCalls: [{ name: 'emit', input: { result: 'done' } }] };
  };

  // Large budget — should not interfere
  const config = makeConfig({ maxContextTokens: 100000 });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  assert(result.metrics !== undefined, 'metrics should be present');
  assert(result.metrics!.rounds === 2, `Should be 2 rounds, got ${result.metrics!.rounds}`);
  assert(result.metrics!.budgetExhausted === false, 'budgetExhausted should be false with large budget');
  assert(result.toolCalls[0].name === 'emit', 'Should return the final emit tool call');
});

// ── 53. Budget + maxQueryRounds interaction ──────────────────────

await runTest('budget: budget exhaustion triggers before maxQueryRounds', async () => {
  let callCount = 0;
  const llm: LLMCallFn = async () => {
    callCount++;
    return { toolCalls: [{ name: 'query_context', input: { action: 'list' } }] };
  };

  // Small budget but high maxQueryRounds — budget should win
  const config = makeConfig({ maxContextTokens: 50, maxQueryRounds: 100 });
  const nucleus = new DeterministicNucleus(config, llm, noopLedger);
  const result = await nucleus.invoke({ input: { task: 'test' }, tools: [] });

  assert(result.metrics !== undefined, 'metrics should be present');
  assert(result.metrics!.budgetExhausted === true, 'budgetExhausted should be true');
  assert(result.metrics!.rounds < 100, `Budget should terminate WAY before 100 rounds, got ${result.metrics!.rounds}`);
  assert(result.metrics!.rounds <= 3, `With 50-token budget, should terminate in ≤3 rounds, got ${result.metrics!.rounds}`);
});

// ── Summary ──────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
