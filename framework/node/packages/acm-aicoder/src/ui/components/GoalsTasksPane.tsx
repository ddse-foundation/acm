// Goals and Tasks Pane Component
// Shows current goal, plan, tasks with status, and budget info

import React from 'react';
import { Box, Text } from 'ink';
import type { Goal, Plan } from '@acm/sdk';
import type { TaskState } from '../store.js';
import type { BudgetStatus } from '../../runtime/budget-manager.js';

interface GoalsTasksPaneProps {
  goal?: Goal;
  plan?: Plan;
  tasks: TaskState[];
  budgetStatus?: BudgetStatus;
  height: number;
  scrollOffset: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
  focused: boolean;
}

export const GoalsTasksPane: React.FC<GoalsTasksPaneProps> = ({
  goal,
  plan,
  tasks,
  budgetStatus,
  height,
  scrollOffset,
  canScrollUp,
  canScrollDown,
  focused,
}) => {
  const rows: React.ReactNode[] = [];

  if (goal) {
    rows.push(
      <Box flexDirection="column" marginBottom={1} key="goal">
        <Text bold color="green">Goal:</Text>
        <Text>{goal.intent || goal.id}</Text>
      </Box>
    );
  }

  if (tasks.length > 0) {
    rows.push(
      <Box flexDirection="column" marginBottom={1} key="tasks-header">
        <Text bold color="green">Tasks:</Text>
      </Box>
    );

    tasks.forEach(task => {
      rows.push(<TaskItem key={task.id} task={task} />);
    });
  }

  if (budgetStatus) {
    rows.push(
      <Box flexDirection="column" key="budget">
        <Text bold color="green">Token Budget:</Text>
        <BudgetInfo status={budgetStatus} />
      </Box>
    );
  }

  if (!goal) {
    rows.push(
      <Box key="no-goal">
        <Text color="gray">No active goal. Type a command to start.</Text>
      </Box>
    );
  }

  const capacity = Math.max(1, height - 2);
  const maxOffset = Math.max(0, rows.length - capacity);
  const effectiveOffset = Math.min(Math.max(scrollOffset, 0), maxOffset);
  const start = Math.max(0, rows.length - capacity - effectiveOffset);
  const visibleRows = rows.slice(start, start + capacity);

  return (
    <Box
      flexDirection="column"
      height={height}
      borderStyle="single"
      borderColor={focused ? 'white' : 'green'}
    >
      <Box paddingX={1} borderStyle="single" borderColor={focused ? 'white' : 'green'}>
        <Text bold color={focused ? 'white' : 'green'}>Goal / Tasks / Progress</Text>
        <Box flexGrow={1} />
        <ScrollIndicator
          up={canScrollUp}
          down={canScrollDown}
          color={focused ? 'white' : 'green'}
        />
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleRows}
      </Box>
    </Box>
  );
};

const TaskItem: React.FC<{ task: TaskState }> = ({ task }) => {
  const statusIcons = {
    pending: '○',
    running: '◐',
    succeeded: '●',
    failed: '✗',
    retrying: '⟳',
  };
  
  const statusColors = {
    pending: 'gray',
    running: 'yellow',
    succeeded: 'green',
    failed: 'red',
    retrying: 'yellow',
  };
  
  const icon = statusIcons[task.status] || '○';
  const color = statusColors[task.status] || 'white';
  
  return (
    <Box flexDirection="column">
      <Text color={color}>
        {icon} {task.name}
        {task.attempt && ` (attempt ${task.attempt}/${task.maxAttempts})`}
        {task.progress !== undefined && ` ${Math.round(task.progress)}%`}
        {task.error && ` - ${task.error}`}
      </Text>
      {task.outputSummary && (
        <Text color="gray">  ↳ {task.outputSummary}</Text>
      )}
    </Box>
  );
};

const BudgetInfo: React.FC<{ status: BudgetStatus }> = ({ status }) => {
  return (
    <Box flexDirection="column">
      <Text>
        Tokens used: {status.totalTokens}
        {status.maxTokens !== undefined && ` / ${status.maxTokens}`}
      </Text>
      {status.remainingTokens !== undefined && (
        <Text color={getRemainingColor(status)}>
          Remaining: {status.remainingTokens}
        </Text>
      )}
      <Text color="gray">
        Calls: {status.callCount}
      </Text>
    </Box>
  );
};

const getRemainingColor = (status: BudgetStatus): string => {
  if (status.maxTokens === undefined || status.remainingTokens === undefined) {
    return 'green';
  }

  const fraction = status.remainingTokens / status.maxTokens;
  if (fraction < 0.1) return 'red';
  if (fraction < 0.25) return 'yellow';
  return 'green';
};

const ScrollIndicator: React.FC<{ up: boolean; down: boolean; color: string }> = ({ up, down, color }) => (
  <Text color={color}>{up ? '˄' : ' '} {down ? '˅' : ' '}</Text>
);
