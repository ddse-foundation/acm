// Goals and Tasks Pane Component
// Shows current goal, plan, tasks with status, and budget info

import React from 'react';
import { Box, Text } from 'ink';
import type { Goal, Plan, Context } from '@ddse/acm-sdk';
import type { TaskState } from '../store.js';

interface GoalsTasksPaneProps {
  goal?: Goal;
  plan?: Plan;
  context?: Context;
  tasks: TaskState[];
  goalSummary?: string;
  height: number;
  scrollOffset: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
  focused: boolean;
}

export const GoalsTasksPane: React.FC<GoalsTasksPaneProps> = ({
  goal,
  plan,
  context,
  tasks,
  goalSummary,
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
        {goalSummary && (
          <Box marginTop={1} flexDirection="column">
            <Text bold color="cyan">Summary</Text>
            <Text color="cyan">{goalSummary}</Text>
          </Box>
        )}
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

  if (context) {
    const factsCount = Object.keys(context.facts ?? {}).length;
    const augmentationCount = context.augmentations?.length ?? 0;
    const augmentationLabel = augmentationCount === 1 ? 'time' : 'times';

    rows.push(
      <Box flexDirection="column" marginBottom={1} key="context-info">
        <Text bold color="green">Context Information:</Text>
        <Text color="gray">  - current size: {factsCount}</Text>
        <Text color="gray">  - augmented {augmentationCount} {augmentationLabel}</Text>
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
  
  const label = (task.objective && task.objective.trim().length > 0)
    ? task.objective.trim()
    : (task.title ?? task.name);

  return (
    <Box>
      <Text color={color}>
        {icon} {label}
      </Text>
    </Box>
  );
};

const ScrollIndicator: React.FC<{ up: boolean; down: boolean; color: string }> = ({ up, down, color }) => (
  <Text color={color}>{up ? '˄' : ' '} {down ? '˅' : ' '}</Text>
);
