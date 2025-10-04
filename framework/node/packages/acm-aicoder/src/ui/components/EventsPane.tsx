// Event Stream Pane Component
// Shows ledger events, tool calls, context updates, policy decisions

import React from 'react';
import { Box, Text } from 'ink';
import type { EventEntry } from '../store.js';

interface EventsPaneProps {
  events: EventEntry[];
  height: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
  focused: boolean;
}

export const EventsPane: React.FC<EventsPaneProps> = ({
  events,
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
      borderColor={focused ? 'white' : 'blue'}
    >
      <Box paddingX={1} borderStyle="single" borderColor={focused ? 'white' : 'blue'}>
        <Text bold color={focused ? 'white' : 'blue'}>Event Stream</Text>
        <Box flexGrow={1} />
        <ScrollIndicator
          up={canScrollUp}
          down={canScrollDown}
          color={focused ? 'white' : 'blue'}
        />
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {events.map(event => (
          <EventItem key={event.id} event={event} />
        ))}
        {events.length === 0 && (
          <Text color="gray">No events yet. Events will appear here as actions occur.</Text>
        )}
      </Box>
    </Box>
  );
};

const EventItem: React.FC<{ event: EventEntry }> = ({ event }) => {
  const color = event.color || 'white';
  
  // Format event data for display
  const formatData = (data: any): string => {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      // Show a summary for objects
      if (data.message) return data.message;
      if (data.status) return `status: ${data.status}`;
      if (data.name) return data.name;
      return JSON.stringify(data).slice(0, 50);
    }
    return String(data);
  };
  
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  
  return (
    <Box>
      <Text color="gray">[{timestamp}] </Text>
      <Text color={color} bold>{event.type}</Text>
      <Text>: {formatData(event.data)}</Text>
    </Box>
  );
};

const ScrollIndicator: React.FC<{ up: boolean; down: boolean; color: string }> = ({ up, down, color }) => (
  <Text color={color}>{up ? '˄' : ' '} {down ? '˅' : ' '}</Text>
);
