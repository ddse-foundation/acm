# ACM AI Coder - Interactive TUI Mockup

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║               ACM AI Coder - Interactive Mode                      ⟳ Processing║
╠═════════════════════════╤═════════════════════════════╤═════════════════════════╣
║                         │                             │                         ║
║  ┌─────────────────┐    │  ┌─────────────────────┐   │  ┌─────────────────┐   ║
║  │      Chat       │    │  │ Goal/Tasks/Progress │   │  │   Event Stream  │   ║
║  └─────────────────┘    │  └─────────────────────┘   │  └─────────────────┘   ║
║                         │                             │                         ║
║  System:                │  Goal:                      │  [14:23:45] GOAL_      ║
║  Welcome to ACM AI      │  Analyze src/index.ts       │  CREATED: goal-123     ║
║  Coder (Phase 2)        │  and find bugs              │                         ║
║                         │                             │  [14:23:46] BUDGET_    ║
║  Configuration:         │  Tasks:                     │  CHECK: $0.0024        ║
║    Model: gpt-4o        │  ○ analyze_workspace        │                         ║
║    Engine: langgraph    │  ○ collect_context_pack     │  [14:23:47] PLAN_      ║
║    Workspace: /project  │  ○ search_code              │  SELECTED: plan-456    ║
║    Budget: $10.00       │                             │                         ║
║                         │  Budget:                    │  [14:23:48] TASK_      ║
║  Type your goal to      │  Spent: $0.0024 / $10.00    │  START: task-0         ║
║  start planning.        │  Used: 0.0%                 │                         ║
║                         │  Remaining: $9.9976         │  [14:23:49] CONTEXT_   ║
║  You:                   │  Calls: 1                   │  INTERNALIZED: 3 files ║
║  Analyze src/index.ts   │                             │                         ║
║  and find bugs          │                             │  [14:23:50] TASK_      ║
║                         │                             │  END: task-0           ║
║  Planner (streaming...):│                             │                         ║
║  I'll analyze the file  │                             │  [14:23:51] NUCLEUS_   ║
║  by first collecting    │                             │  INFERENCE: context ok ║
║  context from the       │                             │                         ║
║  workspace, then...     │                             │                         ║
║                         │                             │                         ║
║                         │                             │                         ║
║                         │                             │                         ║
╠═════════════════════════╧═════════════════════════════╧═════════════════════════╣
║  > Type your goal or command (e.g., /help)...                                   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Layout Breakdown

### Left Column (40%) - Chat Pane
- **Purpose:** User messages, planner reasoning, nucleus thoughts, system messages
- **Colors:**
  - User: white
  - Planner: yellow (streaming indicator when active)
  - Nucleus: magenta
  - System: gray
- **Scrolling:** Shows most recent messages that fit in viewport

### Middle Column (30%) - Goals/Tasks/Progress
- **Goal Section:** Current goal intent
- **Tasks Section:** Live task list with status icons
  - ○ pending (gray)
  - ◐ running (yellow)
  - ● succeeded (green)
  - ✗ failed (red)
  - ⟳ retrying (yellow)
- **Budget Section:** Real-time spend tracking
  - Total spent vs. limit
  - Percentage used (color-coded)
  - Remaining budget
  - API call count

### Right Column (30%) - Event Stream
- **Purpose:** Ledger entries, tool calls, context updates, policy decisions
- **Format:** [timestamp] TYPE: data
- **Colors:**
  - PLAN_SELECTED, TASK_END: green
  - TASK_START: blue
  - ERROR: red
  - POLICY_DECISION: yellow
  - Others: gray
- **Pruning:** Keeps last 100 events

### Bottom - Command Input
- **Text input:** Accepts goals or commands
- **Commands:** /exit, /help, /budget, /context, /reset
- **File mentions:** #path/to/file syntax
- **Submit:** Press Enter to send

## Example Session Flow

### 1. Startup
```
> acm-aicoder --llm-model gpt-4o --llm-base-url https://api.openai.com \
              --llm-engine langgraph --workspace /myproject --budget-usd 10

[TUI launches with welcome message]
```

### 2. User Types Goal
```
> Find all TypeScript errors in src/ directory
[ENTER]
```

### 3. Budget Check
```
Event Stream:
[14:25:01] BUDGET_CHECK: estimated $0.0035, 1200 tokens
```

### 4. Planner Streams Reasoning
```
Chat Pane:
Planner (streaming...):
First, I'll analyze the TypeScript files in src/...
Then I'll run the type checker...
Finally, I'll categorize the errors...
```

### 5. Tasks Execute
```
Tasks Pane:
◐ analyze_workspace (running)
○ collect_context_pack
○ fix_type_error

Event Stream:
[14:25:02] TASK_START: task-0
[14:25:03] CONTEXT_INTERNALIZED: 15 files
[14:25:04] TASK_END: task-0
```

### 6. Completion
```
System:
Goal completed successfully!
Replay bundle saved to: /myproject/.aicoder/replays/2025-01-04T14-25-05
```

## Interactive Commands

### /help
Shows available commands and usage examples.

### /budget
```
Budget Status:
  Total Spent: $0.0124
  Limit: $10.00
  Remaining: $9.9876
  Used: 0.1%
  API Calls: 4
```

### /context
```
Current Context:
  ID: ctx-1735998305123
  Facts: 3 entries
```

### /reset
Clears current goal and tasks, resets budget, keeps chat history.

### /exit or /quit
Saves replay bundle and exits cleanly.

## Visual Styling

- **Borders:** Single-line for panes, double-line for header/footer
- **Colors:** ANSI terminal colors (cyan, yellow, green, red, blue, magenta)
- **Responsive:** Adjusts to terminal size (minimum 80 columns)
- **Updates:** Real-time re-renders on state changes

## Terminal Requirements

- **Minimum Width:** 80 columns
- **Minimum Height:** 24 rows
- **Terminal Type:** xterm-compatible (supports ANSI colors)
- **Not Recommended:** tmux/screen nested sessions (may cause layout issues)

---

This mockup represents the actual TUI layout implemented in Phase 2.
All components are functional and wired to the ACM framework.
