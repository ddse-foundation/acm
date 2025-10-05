// Main TUI Application Component
// Three-column layout with command input

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { ChatPane } from './components/ChatPane.js';
import { GoalsTasksPane } from './components/GoalsTasksPane.js';
import { EventsPane } from './components/EventsPane.js';
import type { AppStore } from './store.js';

type Pane = 'chat' | 'tasks' | 'events';

interface WindowMeta {
  startIndex: number;
  endIndex: number;
  clampedOffset: number;
  maxOffset: number;
  capacity: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
}

const paneLabels: Record<Pane, string> = {
  chat: 'Chat',
  tasks: 'Goal/Tasks',
  events: 'Events',
};

const paneOrder: Pane[] = ['chat', 'tasks', 'events'];

const computeWindow = (total: number, capacity: number, requestedOffset: number): WindowMeta => {
  const normalizedCapacity = Math.max(1, capacity);
  const maxOffset = Math.max(0, total - normalizedCapacity);
  const clampedOffset = Math.min(Math.max(requestedOffset, 0), maxOffset);
  const startIndex = Math.max(0, total - normalizedCapacity - clampedOffset);
  const endIndex = Math.min(total, startIndex + normalizedCapacity);

  return {
    startIndex,
    endIndex,
    clampedOffset,
    maxOffset,
    capacity: normalizedCapacity,
    canScrollUp: clampedOffset < maxOffset,
    canScrollDown: clampedOffset > 0,
  };
};

interface AppProps {
  store: AppStore;
  onCommand: (command: string) => void;
}

export const App: React.FC<AppProps> = ({ store, onCommand }) => {
  const [state, setState] = useState(store.getState());
  const [input, setInput] = useState('');
  const [focusedPane, setFocusedPane] = useState<Pane>('chat');
  const [scrollOffsets, setScrollOffsets] = useState<{ chat: number; tasks: number; events: number }>(
    { chat: 0, tasks: 0, events: 0 }
  );
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
  /budget          - Show token budget details
  /reset           - Reset session (clear goal and tasks)
  /reasoning       - Toggle nucleus reasoning messages
  
Pane controls:
  Tab              - Switch focused column
  Ctrl+↑ / Ctrl+↓  - Scroll active column
  PgUp / PgDn      - Page through active column
  Ctrl+C           - Exit immediately

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
        `Token Usage:\n` +
        `  Total Tokens: ${bs.totalTokens}\n` +
        `  Input Tokens: ${bs.totalInputTokens}\n` +
        `  Output Tokens: ${bs.totalOutputTokens}\n` +
        (bs.maxTokens !== undefined ? `  Allowance: ${bs.maxTokens}\n` : '') +
        (bs.remainingTokens !== undefined ? `  Remaining: ${bs.remainingTokens}\n` : '') +
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

    if (value === '/reasoning') {
      const enabled = store.toggleReasoningVisible();
      store.addMessage(
        'system',
        `Nucleus reasoning messages ${enabled ? 'enabled' : 'hidden'} (Ctrl+R to toggle).`
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

  const visibleMessages = useMemo(
    () =>
      state.showReasoning
        ? state.messages
        : state.messages.filter(message => message.role !== 'nucleus'),
    [state.messages, state.showReasoning]
  );

  const chatCapacity = Math.max(1, mainHeight - 2);
  const chatWindow = useMemo(
    () => computeWindow(visibleMessages.length, chatCapacity, scrollOffsets.chat),
    [visibleMessages.length, chatCapacity, scrollOffsets.chat]
  );
  const chatMessages = useMemo(
    () => visibleMessages.slice(chatWindow.startIndex, chatWindow.endIndex),
    [visibleMessages, chatWindow]
  );

  const tasksTotalEntries = useMemo(() => {
    const goalEntry = state.currentGoal ? 1 : 0;
    const summaryEntry = state.goalSummary ? 1 : 0;
    const tasksHeader = state.tasks.length > 0 ? 1 : 0;
    const taskEntries = state.tasks.length;
    const contextHeader = state.currentContext ? 1 : 0;
    const contextLines = state.currentContext ? 2 : 0;
    const placeholderEntry = state.currentGoal ? 0 : 1;
    return (
      goalEntry +
      summaryEntry +
      tasksHeader +
      taskEntries +
      contextHeader +
      contextLines +
      placeholderEntry
    );
  }, [state.currentGoal, state.goalSummary, state.tasks, state.currentContext]);
  const tasksCapacity = Math.max(1, mainHeight - 2);
  const tasksWindow = useMemo(
    () => computeWindow(tasksTotalEntries, tasksCapacity, scrollOffsets.tasks),
    [tasksTotalEntries, tasksCapacity, scrollOffsets.tasks]
  );

  const eventsCapacity = Math.max(1, mainHeight - 2);
  const eventsWindow = useMemo(
    () => computeWindow(state.events.length, eventsCapacity, scrollOffsets.events),
    [state.events.length, eventsCapacity, scrollOffsets.events]
  );
  const eventEntries = useMemo(
    () => state.events.slice(eventsWindow.startIndex, eventsWindow.endIndex),
    [state.events, eventsWindow]
  );

  const windowByPane = useMemo(
    () => ({ chat: chatWindow, tasks: tasksWindow, events: eventsWindow }),
    [chatWindow, tasksWindow, eventsWindow]
  );

  useEffect(() => {
    if (scrollOffsets.chat !== chatWindow.clampedOffset) {
      setScrollOffsets(prev =>
        prev.chat === chatWindow.clampedOffset
          ? prev
          : { ...prev, chat: chatWindow.clampedOffset }
      );
    }
  }, [chatWindow.clampedOffset, scrollOffsets.chat]);

  useEffect(() => {
    if (scrollOffsets.tasks !== tasksWindow.clampedOffset) {
      setScrollOffsets(prev =>
        prev.tasks === tasksWindow.clampedOffset
          ? prev
          : { ...prev, tasks: tasksWindow.clampedOffset }
      );
    }
  }, [tasksWindow.clampedOffset, scrollOffsets.tasks]);

  useEffect(() => {
    if (scrollOffsets.events !== eventsWindow.clampedOffset) {
      setScrollOffsets(prev =>
        prev.events === eventsWindow.clampedOffset
          ? prev
          : { ...prev, events: eventsWindow.clampedOffset }
      );
    }
  }, [eventsWindow.clampedOffset, scrollOffsets.events]);

  const setPaneOffset = useCallback(
    (pane: Pane, offset: number) => {
      const meta = windowByPane[pane];
      if (!meta) return;
      const clamped = Math.min(Math.max(offset, 0), meta.maxOffset);
      setScrollOffsets(prev =>
        prev[pane] === clamped ? prev : { ...prev, [pane]: clamped }
      );
    },
    [windowByPane]
  );

  const adjustScroll = useCallback(
    (pane: Pane, delta: number) => {
      const meta = windowByPane[pane];
      if (!meta) return;
      setPaneOffset(pane, meta.clampedOffset + delta);
    },
    [setPaneOffset, windowByPane]
  );

  useInput((inputKey, key) => {
    if (key.tab) {
      setFocusedPane(prev => {
        const idx = paneOrder.indexOf(prev);
        const nextIdx = key.shift
          ? (idx - 1 + paneOrder.length) % paneOrder.length
          : (idx + 1) % paneOrder.length;
        return paneOrder[nextIdx];
      });
      return;
    }

    if (key.ctrl && inputKey && inputKey.toLowerCase() === 'r') {
      const enabled = store.toggleReasoningVisible();
      store.addMessage(
        'system',
        `Nucleus reasoning messages ${enabled ? 'enabled' : 'hidden'} (Ctrl+R to toggle).`
      );
      return;
    }

    const meta = windowByPane[focusedPane];
    if (!meta) return;

  const lineScrollModifier = key.ctrl || key.meta || (('alt' in key) && (key as any).alt);

    if ((lineScrollModifier || key.shift) && key.upArrow) {
      adjustScroll(focusedPane, 1);
      return;
    }

    if ((lineScrollModifier || key.shift) && key.downArrow) {
      adjustScroll(focusedPane, -1);
      return;
    }

    if (key.pageUp || (key.shift && key.upArrow)) {
      adjustScroll(focusedPane, meta.capacity);
      return;
    }

    if (key.pageDown || (key.shift && key.downArrow)) {
      adjustScroll(focusedPane, -meta.capacity);
      return;
    }
  });
  
  return (
    <Box flexDirection="column" height={termHeight}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">ACM AI Coder - Interactive Mode</Text>
        <Box marginLeft={2}>
          <Text color="cyan">Focus: {paneLabels[focusedPane]}</Text>
          <Text>
            {' '}
            <Text color="gray">Tab</Text> = Switch
            {'  '}
            <Text color="gray">Shift+Tab</Text> = Reverse
            {'  '}
            <Text color="gray">Ctrl+R</Text> = Reasoning Toggle
            {'  '}
            <Text color="gray">Ctrl+↑/↓</Text> = Scroll
            {'  '}
            <Text color="gray">PgUp/PgDn</Text> = Page
            {'  '}
            <Text color="gray">Ctrl+C</Text> = Exit
          </Text>
        </Box>
      </Box>

  <Box flexGrow={1} flexDirection="row" gap={2} paddingX={1}>
        <Box width={col1Width}>
          <ChatPane
            messages={chatMessages}
            height={mainHeight}
            canScrollUp={chatWindow.canScrollUp}
            canScrollDown={chatWindow.canScrollDown}
            focused={focusedPane === 'chat'}
          />
        </Box>
        <Box width={col2Width}>
          <GoalsTasksPane
            goal={state.currentGoal}
            plan={state.currentPlan}
            context={state.currentContext}
            tasks={state.tasks}
            goalSummary={state.goalSummary}
            height={mainHeight}
            scrollOffset={tasksWindow.clampedOffset}
            canScrollUp={tasksWindow.canScrollUp}
            canScrollDown={tasksWindow.canScrollDown}
            focused={focusedPane === 'tasks'}
          />
        </Box>
        <Box width={col3Width}>
          <EventsPane
            events={eventEntries}
            height={mainHeight}
            canScrollUp={eventsWindow.canScrollUp}
            canScrollDown={eventsWindow.canScrollDown}
            focused={focusedPane === 'events'}
          />
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
