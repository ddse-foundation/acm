// Main TUI Application Component
// Three-column layout with command input

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { ChatPane } from './components/ChatPane.js';
import { GoalsTasksPane } from './components/GoalsTasksPane.js';
import { EventsPane } from './components/EventsPane.js';
import type { AppStore } from './store.js';

interface AppProps {
  store: AppStore;
  onCommand: (command: string) => void;
}

export const App: React.FC<AppProps> = ({ store, onCommand }) => {
  const [state, setState] = useState(store.getState());
  const [input, setInput] = useState('');
  const { exit } = useApp();
  
  useEffect(() => {
    const handleUpdate = () => {
      setState(store.getState());
    };
    
    store.on('update', handleUpdate);
    return () => {
      store.off('update', handleUpdate);
    };
  }, [store]);
  
  const handleSubmit = (value: string) => {
    if (!value.trim()) return;
    
    // Handle built-in commands
    if (value === '/exit' || value === '/quit') {
      exit();
      return;
    }
    
    if (value === '/help') {
      store.addMessage('system', `
Available commands:
  /exit, /quit     - Exit the application
  /help            - Show this help
  /retry           - Retry the last failed task
  /skip            - Skip the current task
  /context         - Show current context info
  /budget          - Show budget details
  /reset           - Reset session (clear goal and tasks)
  
File mentions:
  Use #path/to/file to reference files in your workspace
  
Type your goal or request to start planning.
      `.trim());
      setInput('');
      return;
    }
    
    if (value === '/reset') {
      store.reset();
      setInput('');
      return;
    }
    
    if (value === '/budget' && state.budgetStatus) {
      const bs = state.budgetStatus;
      store.addMessage('system', 
        `Budget Status:\n` +
        `  Total Spent: $${bs.totalSpentUsd.toFixed(4)}\n` +
        (bs.limitUsd ? `  Limit: $${bs.limitUsd.toFixed(2)}\n` : '') +
        (bs.remainingUsd !== undefined ? `  Remaining: $${bs.remainingUsd.toFixed(4)}\n` : '') +
        (bs.percentUsed !== undefined ? `  Used: ${bs.percentUsed.toFixed(1)}%\n` : '') +
        `  API Calls: ${bs.callCount}`
      );
      setInput('');
      return;
    }
    
    if (value === '/context' && state.currentContext) {
      store.addMessage('system',
        `Current Context:\n` +
        `  ID: ${state.currentContext.id}\n` +
        `  Facts: ${Object.keys(state.currentContext.facts || {}).length} entries`
      );
      setInput('');
      return;
    }
    
    // Pass command to handler
    onCommand(value);
    setInput('');
  };
  
  // Calculate terminal dimensions (approximate)
  const termHeight = process.stdout.rows || 24;
  const termWidth = process.stdout.columns || 80;
  
  const mainHeight = termHeight - 4; // Leave room for input
  const col1Width = Math.floor(termWidth * 0.40);
  const col2Width = Math.floor(termWidth * 0.30);
  const col3Width = termWidth - col1Width - col2Width - 4;
  
  return (
    <Box flexDirection="column" height={termHeight}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">ACM AI Coder - Interactive Mode</Text>
        <Box flexGrow={1} />
        {state.isProcessing && <Text color="yellow">⟳ Processing...</Text>}
      </Box>
      
      {/* Main content - 3 columns */}
      <Box flexGrow={1}>
        <Box width={col1Width}>
          <ChatPane messages={state.messages} height={mainHeight} />
        </Box>
        <Box width={col2Width}>
          <GoalsTasksPane
            goal={state.currentGoal}
            plan={state.currentPlan}
            tasks={state.tasks}
            budgetStatus={state.budgetStatus}
            height={mainHeight}
          />
        </Box>
        <Box width={col3Width}>
          <EventsPane events={state.events} height={mainHeight} />
        </Box>
      </Box>
      
      {/* Command input */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>&gt; </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type your goal or command (e.g., /help)..."
        />
      </Box>
    </Box>
  );
};
