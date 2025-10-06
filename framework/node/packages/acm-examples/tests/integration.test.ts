// Integration test for ACM framework
import {
  ExternalContextProviderAdapter,
  Nucleus,
  type Goal,
  type Context,
  type Plan,
  type NucleusFactory,
  type NucleusConfig,
  type PreflightResult,
  type PostcheckResult,
  type NucleusInvokeResult,
  type InternalContextScope,
  type LedgerEntry,
  type LLMCallFn,
} from '@acm/sdk';
import { MemoryLedger } from '@acm/runtime';
import { ACMFramework } from '@acm/framework';
import { SimpleCapabilityRegistry, SimpleToolRegistry } from '../src/registries.js';
import { registerExampleContextProviders } from '../src/context/index.js';
import { listScenarioKeys, scenarios, type ScenarioDefinition } from '../src/examples/scenarios.js';

type TestResult = {
  scenario: ScenarioDefinition;
  success: boolean;
  error?: unknown;
};

const stubLLMCall: LLMCallFn = async () => ({
  reasoning: '',
  toolCalls: [],
  raw: {},
});

function createVerifyFn() {
  return async (taskId: string, output: any, expressions: string[]): Promise<boolean> => {
    for (const expr of expressions) {
      try {
        const fn = new Function('output', `return ${expr};`);
        const result = fn(output);
        if (!result) {
          console.error(`Verification failed for ${taskId}: ${expr}`);
          return false;
        }
      } catch (error) {
        console.error(`Verification error for ${taskId}: ${expr}`, error);
        return false;
      }
    }
    return true;
  };
}

async function runScenario(definition: ScenarioDefinition): Promise<void> {
  console.log(`\n▶️  Scenario: ${definition.name} (${definition.key})`);

  const toolRegistry = new SimpleToolRegistry();
  const capabilityRegistry = new SimpleCapabilityRegistry();
  definition.registerTools(toolRegistry);
  definition.registerCapabilities(capabilityRegistry);

  const adapter = new ExternalContextProviderAdapter();
  registerExampleContextProviders(adapter);

  const framework = ACMFramework.create({
    capabilityRegistry,
    toolRegistry,
    nucleus: {
      call: stubLLMCall,
      llmConfig: {
        provider: 'test',
        model: 'stub',
        temperature: 0,
        maxTokens: 0,
      },
      hooks: {
        preflight: false,
        postcheck: false,
      },
    },
    verify: createVerifyFn(),
    contextProvider: adapter,
  });

  const reference = await definition.buildReferencePlan();
  const plan = reference.plan;
  const ledger = new MemoryLedger();

  const executeResult = await framework.execute({
    goal: definition.goal,
    context: definition.context,
    ledger,
    existingPlan: {
      plan,
      plannerResult: {
        plans: [plan],
        contextRef: plan.contextRef,
        rationale: `${definition.name} reference plan`,
      },
    },
  });

  definition.assertExecution(executeResult.execution);

  console.log('   ✅ Execution succeeded');

  for (const task of plan.tasks) {
    const record = executeResult.execution.outputsByTask?.[task.id];
    if (!record?.output) {
      throw new Error(`Task ${task.id} did not produce an output`);
    }
  }

  if (executeResult.execution.ledger.length === 0) {
    throw new Error('Ledger is empty after execution');
  }
}

async function runIntegrationSuite(): Promise<boolean> {
  console.log('Running ACM Scenario Integration Suite');
  console.log('='.repeat(50));

  const keys = listScenarioKeys();
  const results: TestResult[] = [];

  for (const key of keys) {
    const scenario = scenarios[key];
    try {
      await runScenario(scenario);
      results.push({ scenario, success: true });
    } catch (error) {
      console.error(`   ❌ Scenario failed: ${scenario.name}`);
      console.error(error);
      results.push({ scenario, success: false, error });
    }
  }

  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  console.log('\n' + '='.repeat(50));
  console.log(`Summary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\nFailed scenarios:');
    for (const result of results.filter(r => !r.success)) {
      console.log(` - ${result.scenario.name} (${result.scenario.key})`);
    }
  }

  return failed === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationSuite()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}
