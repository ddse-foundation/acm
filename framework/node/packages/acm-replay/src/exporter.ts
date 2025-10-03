// Replay Bundle Exporter for ACM
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Goal, Context, Plan, LedgerEntry } from '@acm/sdk';

/**
 * Replay bundle metadata
 */
export interface ReplayBundleMetadata {
  version: string;
  createdAt: string;
  runId: string;
  goalId: string;
  contextRef: string;
  planId: string;
}

/**
 * Policy request/response for replay
 */
export interface PolicyRecord {
  id: string;
  ts: string;
  action: string;
  input: any;
  decision: boolean;
}

/**
 * Verification result for replay
 */
export interface VerificationResult {
  taskId: string;
  ts: string;
  expressions: string[];
  results: boolean[];
  passed: boolean;
}

/**
 * Task I/O record
 */
export interface TaskIORecord {
  taskId: string;
  capability: string;
  input: any;
  output: any;
  ts: string;
}

/**
 * Engine trace record
 */
export interface EngineTrace {
  runId: string;
  engine: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'failed' | 'partial';
  tasks: Array<{
    taskId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    error?: string;
  }>;
}

/**
 * Options for replay bundle export
 */
export interface ReplayBundleExportOptions {
  outputDir: string;
  goal: Goal;
  context: Context;
  plans: Plan[];
  selectedPlanId: string;
  ledger: LedgerEntry[];
  taskIO: TaskIORecord[];
  policyRecords?: PolicyRecord[];
  verificationResults?: VerificationResult[];
  engineTrace?: EngineTrace;
  plannerPrompts?: Array<{ role: string; content: string }>;
}

/**
 * Replay Bundle Exporter
 * 
 * Exports complete ACM execution artifacts to a structured directory
 * for audit, compliance, and replay purposes.
 */
export class ReplayBundleExporter {
  /**
   * Export a replay bundle
   */
  static async export(options: ReplayBundleExportOptions): Promise<string> {
    const {
      outputDir,
      goal,
      context,
      plans,
      selectedPlanId,
      ledger,
      taskIO,
      policyRecords = [],
      verificationResults = [],
      engineTrace,
      plannerPrompts,
    } = options;

    // Create bundle directory structure
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'goal'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'context'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'plans'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'task-specs'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'policy'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'verification'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'memory-ledger'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'engine-trace'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'task-io'), { recursive: true });
    if (plannerPrompts) {
      await fs.mkdir(path.join(outputDir, 'planner-prompts'), { recursive: true });
    }

    // Export metadata
    const metadata: ReplayBundleMetadata = {
      version: '0.5',
      createdAt: new Date().toISOString(),
      runId: engineTrace?.runId || `run-${Date.now()}`,
      goalId: goal.id,
      contextRef: context.id,
      planId: selectedPlanId,
    };

    await fs.writeFile(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Export goal
    await fs.writeFile(
      path.join(outputDir, 'goal', 'goal.json'),
      JSON.stringify(goal, null, 2)
    );

    // Export context
    await fs.writeFile(
      path.join(outputDir, 'context', 'context.json'),
      JSON.stringify(context, null, 2)
    );

    // Export plans
    for (let i = 0; i < plans.length; i++) {
      const planFile = i === 0 ? 'planA.json' : `plan${String.fromCharCode(65 + i)}.json`;
      await fs.writeFile(
        path.join(outputDir, 'plans', planFile),
        JSON.stringify(plans[i], null, 2)
      );
    }

    // Export task specs
    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    if (selectedPlan) {
      for (const taskSpec of selectedPlan.tasks) {
        await fs.writeFile(
          path.join(outputDir, 'task-specs', `${taskSpec.id}.json`),
          JSON.stringify(taskSpec, null, 2)
        );
      }
    }

    // Export policy records (JSONL)
    if (policyRecords.length > 0) {
      const policyLines = policyRecords.map((r) => JSON.stringify(r)).join('\n');
      await fs.writeFile(
        path.join(outputDir, 'policy', 'requests.jsonl'),
        policyLines
      );
    }

    // Export verification results
    if (verificationResults.length > 0) {
      await fs.writeFile(
        path.join(outputDir, 'verification', 'results.json'),
        JSON.stringify(verificationResults, null, 2)
      );
    }

    // Export memory ledger (JSONL)
    if (ledger.length > 0) {
      const ledgerLines = ledger.map((entry) => JSON.stringify(entry)).join('\n');
      await fs.writeFile(
        path.join(outputDir, 'memory-ledger', 'ledger.jsonl'),
        ledgerLines
      );
    }

    // Export engine trace
    if (engineTrace) {
      await fs.writeFile(
        path.join(outputDir, 'engine-trace', 'run.json'),
        JSON.stringify(engineTrace, null, 2)
      );
    }

    // Export task I/O
    for (const record of taskIO) {
      await fs.writeFile(
        path.join(outputDir, 'task-io', `${record.taskId}.input.json`),
        JSON.stringify(record.input, null, 2)
      );
      await fs.writeFile(
        path.join(outputDir, 'task-io', `${record.taskId}.output.json`),
        JSON.stringify(record.output, null, 2)
      );
    }

    // Export planner prompts
    if (plannerPrompts) {
      await fs.writeFile(
        path.join(outputDir, 'planner-prompts', 'messages.json'),
        JSON.stringify(plannerPrompts, null, 2)
      );
    }

    return outputDir;
  }

  /**
   * Load a replay bundle
   */
  static async load(bundleDir: string): Promise<{
    metadata: ReplayBundleMetadata;
    goal: Goal;
    context: Context;
    plans: Plan[];
    ledger: LedgerEntry[];
    taskIO: TaskIORecord[];
    policyRecords: PolicyRecord[];
    verificationResults: VerificationResult[];
    engineTrace?: EngineTrace;
  }> {
    // Load metadata
    const metadataPath = path.join(bundleDir, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    // Load goal
    const goalPath = path.join(bundleDir, 'goal', 'goal.json');
    const goal = JSON.parse(await fs.readFile(goalPath, 'utf-8'));

    // Load context
    const contextPath = path.join(bundleDir, 'context', 'context.json');
    const context = JSON.parse(await fs.readFile(contextPath, 'utf-8'));

    // Load plans
    const plansDir = path.join(bundleDir, 'plans');
    const planFiles = await fs.readdir(plansDir);
    const plans = await Promise.all(
      planFiles
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => JSON.parse(await fs.readFile(path.join(plansDir, f), 'utf-8')))
    );

    // Load ledger
    const ledgerPath = path.join(bundleDir, 'memory-ledger', 'ledger.jsonl');
    let ledger: LedgerEntry[] = [];
    try {
      const ledgerContent = await fs.readFile(ledgerPath, 'utf-8');
      ledger = ledgerContent
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch {
      // Ledger might not exist
    }

    // Load task I/O
    const taskIODir = path.join(bundleDir, 'task-io');
    let taskIO: TaskIORecord[] = [];
    try {
      const taskIOFiles = await fs.readdir(taskIODir);
      const inputFiles = taskIOFiles.filter((f) => f.endsWith('.input.json'));
      
      taskIO = await Promise.all(
        inputFiles.map(async (f) => {
          const taskId = f.replace('.input.json', '');
          const input = JSON.parse(
            await fs.readFile(path.join(taskIODir, f), 'utf-8')
          );
          const output = JSON.parse(
            await fs.readFile(path.join(taskIODir, `${taskId}.output.json`), 'utf-8')
          );
          return { taskId, capability: '', input, output, ts: '' };
        })
      );
    } catch {
      // Task I/O might not exist
    }

    // Load policy records
    const policyPath = path.join(bundleDir, 'policy', 'requests.jsonl');
    let policyRecords: PolicyRecord[] = [];
    try {
      const policyContent = await fs.readFile(policyPath, 'utf-8');
      policyRecords = policyContent
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    } catch {
      // Policy records might not exist
    }

    // Load verification results
    const verificationPath = path.join(bundleDir, 'verification', 'results.json');
    let verificationResults: VerificationResult[] = [];
    try {
      verificationResults = JSON.parse(await fs.readFile(verificationPath, 'utf-8'));
    } catch {
      // Verification results might not exist
    }

    // Load engine trace
    const engineTracePath = path.join(bundleDir, 'engine-trace', 'run.json');
    let engineTrace: EngineTrace | undefined;
    try {
      engineTrace = JSON.parse(await fs.readFile(engineTracePath, 'utf-8'));
    } catch {
      // Engine trace might not exist
    }

    return {
      metadata,
      goal,
      context,
      plans,
      ledger,
      taskIO,
      policyRecords,
      verificationResults,
      engineTrace,
    };
  }

  /**
   * Validate a replay bundle structure
   */
  static async validate(bundleDir: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check required files
    const requiredFiles = [
      'metadata.json',
      'goal/goal.json',
      'context/context.json',
    ];

    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(bundleDir, file));
      } catch {
        errors.push(`Missing required file: ${file}`);
      }
    }

    // Check plans directory
    try {
      const plansDir = path.join(bundleDir, 'plans');
      const planFiles = await fs.readdir(plansDir);
      if (planFiles.filter((f) => f.endsWith('.json')).length === 0) {
        errors.push('No plan files found in plans directory');
      }
    } catch {
      errors.push('Plans directory not found or inaccessible');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
