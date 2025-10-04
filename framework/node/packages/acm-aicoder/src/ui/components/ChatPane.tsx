// Chat Pane Component
// Displays user messages, planner reasoning, and nucleus thoughts

import React from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../store.js';

interface ChatPaneProps {
  messages: ChatMessage[];
  height: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
  focused: boolean;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  height,
  canScrollUp,
  canScrollDown,
  focused,
}) => {
  
  return (
    <Box
      flexDirection="column"
      height={height}
      borderStyle="single"
      borderColor={focused ? 'white' : 'cyan'}
    >
      <Box paddingX={1} borderStyle="single" borderColor={focused ? 'white' : 'cyan'}>
        <Text bold color={focused ? 'white' : 'cyan'}>Chat</Text>
        <Box flexGrow={1} />
        <ScrollIndicator
          up={canScrollUp}
          down={canScrollDown}
          color={focused ? 'white' : 'cyan'}
        />
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {messages.length === 0 && (
          <Text color="gray">Conversation will appear here.</Text>
        )}
        {messages.map(msg => (
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

const ScrollIndicator: React.FC<{ up: boolean; down: boolean; color: string }> = ({ up, down, color }) => (
  <Text color={color}>{up ? '˄' : ' '} {down ? '˅' : ' '}</Text>
);
