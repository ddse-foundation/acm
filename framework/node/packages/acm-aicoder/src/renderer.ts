// CLI Renderer for streaming output
import chalk from 'chalk';

export class CLIRenderer {
  private currentTask: string | null = null;

  renderPlannerToken(chunk: any): void {
    if (chunk.done) {
      process.stdout.write('\n');
    } else if (chunk.delta) {
      process.stdout.write(chunk.delta);
    }
  }

  renderTaskUpdate(update: any): void {
    const prefix = chalk.blue('→');
    
    if (update.step === 'start') {
      this.currentTask = update.taskId;
      console.log(`\n${prefix} Starting task: ${chalk.bold(update.taskId)}`);
    } else if (update.step === 'complete') {
      console.log(`${chalk.green('✓')} Task completed: ${chalk.bold(update.taskId)}`);
      this.currentTask = null;
    } else if (update.step === 'error') {
      console.log(`${chalk.red('✗')} Task failed: ${chalk.bold(update.taskId)}`);
      console.log(`  ${chalk.red(update.error)}`);
      this.currentTask = null;
    } else {
      // Custom step update
      const stepName = update.step.replace(/_/g, ' ');
      console.log(`  ${chalk.gray('•')} ${stepName}`);
      
      // Show additional details if available
      if (update.files) {
        console.log(`    ${chalk.gray(`Files: ${update.files}`)}`);
      }
      if (update.issuesFound !== undefined) {
        console.log(`    ${chalk.gray(`Issues found: ${update.issuesFound}`)}`);
      }
      if (update.success !== undefined) {
        const status = update.success ? chalk.green('passed') : chalk.red('failed');
        console.log(`    ${chalk.gray(`Status: ${status}`)}`);
      }
    }
  }

  renderCheckpoint(update: any): void {
    const icon = chalk.yellow('💾');
    console.log(`${icon} Checkpoint: ${update.checkpointId} (${update.tasksCompleted} tasks)`);
  }

  renderHeader(title: string): void {
    console.log();
    console.log(chalk.bold.cyan(title));
    console.log(chalk.gray('='.repeat(60)));
  }

  renderInfo(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  renderSuccess(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  renderWarning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  renderError(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  renderSummary(result: any): void {
    console.log();
    console.log(chalk.bold.green('Summary'));
    console.log(chalk.gray('─'.repeat(60)));
    
    if (result.outputsByTask) {
      const tasks = Object.keys(result.outputsByTask);
      console.log(`${chalk.bold('Tasks executed:')} ${tasks.length}`);
      
      tasks.forEach(taskId => {
        const output = result.outputsByTask[taskId];
        console.log(`  ${chalk.green('✓')} ${taskId}`);
        
        // Show key output details
        if (output.summary) {
          console.log(`    ${chalk.gray(output.summary)}`);
        }
        if (output.files !== undefined) {
          console.log(`    ${chalk.gray(`Files: ${output.files}`)}`);
        }
        if (output.fixed !== undefined) {
          console.log(`    ${chalk.gray(`Fixed: ${output.fixed}`)}`);
        }
      });
    }

    if (result.metrics) {
      console.log();
      console.log(`${chalk.bold('Metrics:')}`);
      console.log(`  Time: ${chalk.cyan(result.metrics.elapsedSec.toFixed(2))}s`);
      if (result.metrics.costUsd) {
        console.log(`  Cost: ${chalk.cyan('$' + result.metrics.costUsd.toFixed(4))}`);
      }
    }

    console.log();
  }
}
