// Checkpoint and resume support for ACM runtime
import type {
  Goal,
  Context,
  Plan,
  LedgerEntry,
} from '@acm/sdk';

/**
 * Schema version for checkpoint compatibility
 */
export const CHECKPOINT_VERSION = '1.0.0';

/**
 * Checkpoint represents a snapshot of execution state
 */
export interface Checkpoint {
  id: string;
  runId: string;
  ts: number;
  version: string;
  state: CheckpointState;
}

/**
 * Execution state captured in a checkpoint
 */
export interface CheckpointState {
  goal: Goal;
  context: Context;
  plan: Plan;
  outputs: Record<string, any>;
  executed: string[];  // Task IDs that have completed
  ledger: LedgerEntry[];
  metrics: {
    costUsd: number;
    elapsedSec: number;
  };
}

/**
 * Metadata for a checkpoint (lightweight listing)
 */
export interface CheckpointMetadata {
  id: string;
  runId: string;
  ts: number;
  version: string;
  tasksCompleted: number;
}

/**
 * Storage interface for checkpoints
 */
export interface CheckpointStore {
  /**
   * Store a checkpoint
   */
  put(runId: string, checkpoint: Checkpoint): Promise<void>;

  /**
   * Retrieve a checkpoint by ID (or latest if no ID provided)
   */
  get(runId: string, checkpointId?: string): Promise<Checkpoint | null>;

  /**
   * List all checkpoints for a run
   */
  list(runId: string): Promise<CheckpointMetadata[]>;

  /**
   * Prune old checkpoints, keeping only the last N
   */
  prune(runId: string, keepLast: number): Promise<void>;
}

/**
 * Create a checkpoint from current execution state
 */
export function createCheckpoint(
  runId: string,
  state: CheckpointState
): Checkpoint {
  const id = `checkpoint-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  return {
    id,
    runId,
    ts: Date.now(),
    version: CHECKPOINT_VERSION,
    state: {
      ...state,
      // Ensure executed is a plain array (not Set)
      executed: Array.isArray(state.executed) ? state.executed : Array.from(state.executed),
      // Deep clone to prevent mutation
      outputs: JSON.parse(JSON.stringify(state.outputs)),
      ledger: JSON.parse(JSON.stringify(state.ledger)),
    },
  };
}

/**
 * Validate checkpoint compatibility
 */
export function validateCheckpoint(checkpoint: Checkpoint): boolean {
  if (!checkpoint.version) {
    console.warn('Checkpoint missing version field');
    return false;
  }

  const [major] = checkpoint.version.split('.');
  const [currentMajor] = CHECKPOINT_VERSION.split('.');

  if (major !== currentMajor) {
    console.error(
      `Checkpoint version ${checkpoint.version} incompatible with current version ${CHECKPOINT_VERSION}`
    );
    return false;
  }

  // Validate required fields
  if (!checkpoint.id || !checkpoint.runId || !checkpoint.state) {
    console.error('Checkpoint missing required fields');
    return false;
  }

  const { state } = checkpoint;
  if (!state.goal || !state.context || !state.plan || !state.ledger) {
    console.error('Checkpoint state missing required fields');
    return false;
  }

  return true;
}

/**
 * In-memory checkpoint store (for testing and simple use cases)
 */
export class MemoryCheckpointStore implements CheckpointStore {
  private checkpoints: Map<string, Checkpoint[]> = new Map();

  async put(runId: string, checkpoint: Checkpoint): Promise<void> {
    if (!this.checkpoints.has(runId)) {
      this.checkpoints.set(runId, []);
    }
    this.checkpoints.get(runId)!.push(checkpoint);
  }

  async get(runId: string, checkpointId?: string): Promise<Checkpoint | null> {
    const checkpoints = this.checkpoints.get(runId);
    if (!checkpoints || checkpoints.length === 0) {
      return null;
    }

    if (checkpointId) {
      return checkpoints.find(c => c.id === checkpointId) || null;
    }

    // Return latest checkpoint
    return checkpoints[checkpoints.length - 1];
  }

  async list(runId: string): Promise<CheckpointMetadata[]> {
    const checkpoints = this.checkpoints.get(runId) || [];
    return checkpoints.map(c => ({
      id: c.id,
      runId: c.runId,
      ts: c.ts,
      version: c.version,
      tasksCompleted: c.state.executed.length,
    }));
  }

  async prune(runId: string, keepLast: number): Promise<void> {
    const checkpoints = this.checkpoints.get(runId);
    if (!checkpoints || checkpoints.length <= keepLast) {
      return;
    }

    // Sort by timestamp and keep only the last N
    checkpoints.sort((a, b) => a.ts - b.ts);
    this.checkpoints.set(runId, checkpoints.slice(-keepLast));
  }

  /**
   * Clear all checkpoints (for testing)
   */
  clear(): void {
    this.checkpoints.clear();
  }
}

/**
 * File-based checkpoint store
 */
export class FileCheckpointStore implements CheckpointStore {
  constructor(private basePath: string) {}

  async put(runId: string, checkpoint: Checkpoint): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const dirPath = path.join(this.basePath, runId);
    await fs.mkdir(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, `${checkpoint.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  async get(runId: string, checkpointId?: string): Promise<Checkpoint | null> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const dirPath = path.join(this.basePath, runId);
    
    try {
      if (checkpointId) {
        const filePath = path.join(dirPath, `${checkpointId}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      }

      // Get latest checkpoint
      const files = await fs.readdir(dirPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        return null;
      }

      // Sort by timestamp in filename
      jsonFiles.sort();
      const latestFile = jsonFiles[jsonFiles.length - 1];
      const filePath = path.join(dirPath, latestFile);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async list(runId: string): Promise<CheckpointMetadata[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const dirPath = path.join(this.basePath, runId);
    
    try {
      const files = await fs.readdir(dirPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const metadata: CheckpointMetadata[] = [];
      
      for (const file of jsonFiles) {
        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const checkpoint: Checkpoint = JSON.parse(content);
        
        metadata.push({
          id: checkpoint.id,
          runId: checkpoint.runId,
          ts: checkpoint.ts,
          version: checkpoint.version,
          tasksCompleted: checkpoint.state.executed.length,
        });
      }
      
      return metadata.sort((a, b) => a.ts - b.ts);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async prune(runId: string, keepLast: number): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const dirPath = path.join(this.basePath, runId);
    
    try {
      const metadata = await this.list(runId);
      
      if (metadata.length <= keepLast) {
        return;
      }

      // Delete oldest checkpoints
      const toDelete = metadata.slice(0, metadata.length - keepLast);
      
      for (const meta of toDelete) {
        const filePath = path.join(dirPath, `${meta.id}.json`);
        await fs.unlink(filePath);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
