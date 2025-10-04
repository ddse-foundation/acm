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
}

export const GoalsTasksPane: React.FC<GoalsTasksPaneProps> = ({
  goal,
  plan,
  tasks,
  budgetStatus,
  height,
}) => {
  return (
    <Box flexDirection="column" height={height} borderStyle="single" borderColor="green">
      <Box paddingX={1} borderStyle="single" borderColor="green">
        <Text bold color="green">Goal / Tasks / Progress</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {/* Goal section */}
        {goal && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color="green">Goal:</Text>
            <Text>{goal.intent || goal.id}</Text>
          </Box>
        )}
        
        {/* Tasks section */}
        {tasks.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color="green">Tasks:</Text>
            {tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </Box>
        )}
        
        {/* Budget section */}
        {budgetStatus && (
          <Box flexDirection="column">
            <Text bold color="green">Budget:</Text>
            <BudgetInfo status={budgetStatus} />
          </Box>
        )}
        
        {!goal && (
          <Box>
            <Text color="gray">No active goal. Type a command to start.</Text>
          </Box>
        )}
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
    <Box>
      <Text color={color}>
        {icon} {task.name}
        {task.attempt && ` (attempt ${task.attempt}/${task.maxAttempts})`}
        {task.progress !== undefined && ` ${Math.round(task.progress)}%`}
        {task.error && ` - ${task.error}`}
      </Text>
    </Box>
  );
};

const BudgetInfo: React.FC<{ status: BudgetStatus }> = ({ status }) => {
  const formatUsd = (amount: number) => `$${amount.toFixed(4)}`;
  
  const percentColor = 
    !status.percentUsed ? 'green' :
    status.percentUsed < 50 ? 'green' :
    status.percentUsed < 80 ? 'yellow' :
    'red';
  
  return (
    <Box flexDirection="column">
      <Text>
        Spent: {formatUsd(status.totalSpentUsd)}
        {status.limitUsd && ` / ${formatUsd(status.limitUsd)}`}
      </Text>
      {status.percentUsed !== undefined && (
        <Text color={percentColor}>
          Used: {status.percentUsed.toFixed(1)}%
          {status.remainingUsd !== undefined && ` (${formatUsd(status.remainingUsd)} remaining)`}
        </Text>
      )}
      <Text color="gray">
        Calls: {status.callCount}
      </Text>
    </Box>
  );
};
