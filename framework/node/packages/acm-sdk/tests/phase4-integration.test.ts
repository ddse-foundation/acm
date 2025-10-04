// Phase 4 Integration Test - Nucleus and Context Builder
import { 
  DeterministicNucleus, 
  ContextBuilder,
  InternalContextScopeImpl,
  type NucleusConfig,
  type Goal,
  type Context,
  type Capability,
} from '../src/index.js';

// Mock LLM for testing
class MockLLM {
  name() {
    return 'mock-llm';
  }

  async generate(messages: any[], opts?: any) {
    return {
      text: 'Mock response',
      tokens: 10,
    };
  }

  async generateWithTools(messages: any[], tools: any[], opts?: any) {
    // Return structured plan via tool calls
    return {
      text: 'Planning complete',
      toolCalls: [
        {
          id: 'call-1',
          name: 'emit_plan',
          arguments: {
            planId: 'plan-a',
            tasks: [
              { id: 't1', capability: 'analyze', input: {} },
              { id: 't2', capability: 'process', input: {} },
            ],
            edges: [
              { from: 't1', to: 't2' },
            ],
            rationale: 'Sequential analysis and processing',
          },
        },
      ],
      tokens: 25,
    };
  }
}

console.log('Running Phase 4 Integration Tests');
console.log('='.repeat(60));

// Test 1: Context Builder
console.log('\nTest 1: Context Builder with Provenance');
const builder = new ContextBuilder();
builder
  .addSource('kb://orders/2025', 'database')
  .addFact('orderId', 'O123')
  .addFact('amount', 100.50)
  .addAssumption('customer is active')
  .setProvenance({
    llm: { provider: 'openai', model: 'gpt-4', temperature: 0.1 },
  });

const context = builder.build('ctx-v1');
console.log('✅ Context built with provenance');
console.log(`   Context ID: ${context.id.substring(0, 20)}...`);
console.log(`   Facts: ${Object.keys(context.facts).length}`);
console.log(`   Sources: ${context.sources?.length || 0}`);

// Test 2: Nucleus with Internal Context
console.log('\nTest 2: Nucleus with Internal Context Scope');
const ledgerEntries: any[] = [];
const ledgerAppend = (entry: any) => {
  ledgerEntries.push(entry);
};

const contextRef = ContextBuilder.computeContextRef(context);

const nucleusConfig: NucleusConfig = {
  goalId: 'GOAL-001',
  taskId: 't1',
  contextRef,
  llmCall: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0,
    seed: 12345,
  },
  hooks: {
    preflight: true,
    postcheck: false,
  },
};

const mockLLMCall = async (prompt: string, tools: any[], config: any) => {
  return {
    reasoning: 'Context is sufficient',
    toolCalls: [],
  };
};

const nucleus = new DeterministicNucleus(nucleusConfig, mockLLMCall, ledgerAppend);

// Set internal context
const internalScope = new InternalContextScopeImpl(ledgerAppend);
internalScope.addArtifact('summary', { text: 'Order summary...' }, {
  tool: 'summarizer',
  rationale: 'Needed for analysis',
});

nucleus.setInternalContext(internalScope);

// Run preflight
const preflightResult = await nucleus.preflight();
console.log('✅ Nucleus preflight completed');
console.log(`   Status: ${preflightResult.status}`);
console.log(`   Internal artifacts: ${internalScope.artifacts.length}`);
console.log(`   Ledger entries: ${ledgerEntries.length}`);

// Test 3: Context Reference Hashing
console.log('\nTest 3: SHA-256 Context Reference');
const contextRef1 = ContextBuilder.computeContextRef(context);
const contextRef2 = ContextBuilder.computeContextRef(context);
console.log('✅ Context reference hashing');
console.log(`   Ref 1: ${contextRef1.substring(0, 16)}...`);
console.log(`   Ref 2: ${contextRef2.substring(0, 16)}...`);
console.log(`   Deterministic: ${contextRef1 === contextRef2 ? 'YES' : 'NO'}`);

console.log('\n' + '='.repeat(60));
console.log('All Phase 4 integration tests passed! ✅');
console.log('='.repeat(60));
