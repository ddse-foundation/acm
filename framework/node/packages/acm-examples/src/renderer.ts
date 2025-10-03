// CLI renderer for streaming output
export class CLIRenderer {
  private taskStatus = new Map<string, string>();

  renderPlannerToken(chunk: any): void {
    if (chunk.delta) {
      process.stdout.write(chunk.delta);
    }
    if (chunk.done) {
      process.stdout.write('\n\n');
    }
  }

  renderTaskUpdate(update: any): void {
    const { taskId, status, step, output, error } = update;

    if (status) {
      this.taskStatus.set(taskId, status);
    }

    if (status === 'running') {
      console.log(`\n[${taskId}] Task started`);
    } else if (status === 'completed') {
      console.log(`[${taskId}] ✓ Task completed`);
      if (output) {
        console.log(`  Output: ${JSON.stringify(output, null, 2)}`);
      }
    } else if (status === 'failed') {
      console.error(`[${taskId}] ✗ Task failed: ${error}`);
    } else if (step) {
      console.log(`[${taskId}]   → ${step}`);
    }
  }

  renderLedgerEntry(entry: any): void {
    const icon = this.getIconForType(entry.type);
    console.log(`${icon} [${entry.type}] ${JSON.stringify(entry.details)}`);
  }

  renderSummary(result: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tasks: ${Object.keys(result.outputsByTask).length}`);
    console.log(`Ledger entries: ${result.ledger.length}`);
    console.log('\nOutputs:');
    for (const [taskId, output] of Object.entries(result.outputsByTask)) {
      console.log(`  ${taskId}:`, JSON.stringify(output, null, 2));
    }
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'PLAN_SELECTED': return '📋';
      case 'GUARD_EVAL': return '🚦';
      case 'TASK_START': return '▶️ ';
      case 'TASK_END': return '✅';
      case 'POLICY_PRE': return '🔒';
      case 'POLICY_POST': return '🔓';
      case 'VERIFICATION': return '✔️ ';
      case 'ERROR': return '❌';
      default: return '•';
    }
  }
}
