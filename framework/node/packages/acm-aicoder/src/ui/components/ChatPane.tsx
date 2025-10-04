// Chat Pane Component
// Displays user messages, planner reasoning, and nucleus thoughts

import React from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../store.js';

interface ChatPaneProps {
  messages: ChatMessage[];
  height: number;
}

export const ChatPane: React.FC<ChatPaneProps> = ({ messages, height }) => {
  // Show last N messages that fit in the height
  const visibleMessages = messages.slice(-Math.max(1, height - 2));
  
  return (
    <Box flexDirection="column" height={height} borderStyle="single" borderColor="cyan">
      <Box paddingX={1} borderStyle="single" borderColor="cyan">
        <Text bold color="cyan">Chat</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {visibleMessages.map(msg => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
      </Box>
    </Box>
  );
};

const ChatMessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const roleColors = {
    user: 'white',
    planner: 'yellow',
    nucleus: 'magenta',
    system: 'gray',
  };
  
  const roleLabels = {
    user: 'You',
    planner: 'Planner',
    nucleus: 'Nucleus',
    system: 'System',
  };
  
  const color = roleColors[message.role] || 'white';
  const label = roleLabels[message.role] || message.role;
  
  return (
    <Box flexDirection="column" marginY={0}>
      <Text color={color} bold>
        {label}{message.streaming ? ' (streaming...)' : ''}:
      </Text>
      <Text color={color}>
        {message.content || '...'}
      </Text>
    </Box>
  );
};
