---
name: chrome-debug
description: Debug the scoreboard UI in Chrome using DevTools MCP. Inspect page state, console errors, network requests, and interact with elements. Use when debugging UI issues, checking for JS errors, or testing user interactions.
allowed-tools: mcp__claude-in-chrome__*
---

# Chrome Browser Debugger

Debug the BIC Scoreboard UI running in Chrome using the Claude in Chrome extension.

## Prerequisites

- Chrome browser open with the Claude in Chrome extension installed
- UI running at `http://localhost:5173` (dev) or `http://localhost:8080` (production)

## Getting Started

Always start by checking current browser tabs:

```
mcp__claude-in-chrome__tabs_context_mcp - Get info about open tabs
```

## Common Debugging Workflows

### 1. Quick Health Check

Start with a page read and console check to assess page state:

```
1. mcp__claude-in-chrome__read_page - Get current page structure and content
2. mcp__claude-in-chrome__read_console_messages - Check for errors/warnings
```

### 2. Investigate Console Errors

When debugging JavaScript errors:

```
1. mcp__claude-in-chrome__read_console_messages - Get all console output
2. Use pattern parameter to filter for specific messages (e.g., pattern="error")
```

### 3. Debug Network/API Issues

When debugging WebSocket or REST API problems:

```
1. mcp__claude-in-chrome__read_network_requests - See all requests
2. Filter results to find WebSocket or specific API calls
```

### 4. Test User Interactions

Simulate user actions to reproduce issues:

```
1. mcp__claude-in-chrome__read_page - Find elements to interact with
2. mcp__claude-in-chrome__computer action="click" coordinate=[x, y]
3. mcp__claude-in-chrome__form_input - Fill form fields
4. mcp__claude-in-chrome__computer action="key" text="Enter"
```

### 5. Navigate and Reload

Control page navigation:

```
mcp__claude-in-chrome__navigate url="http://localhost:5173" - Go to URL
mcp__claude-in-chrome__javascript_tool code="location.reload()" - Refresh page
```

### 6. Execute Custom JavaScript

Run scripts in page context:

```
mcp__claude-in-chrome__javascript_tool code="document.title"
mcp__claude-in-chrome__javascript_tool code="JSON.stringify(window.gameState)"
```

### 7. Record Multi-Step Interactions

Create GIF recordings of UI workflows:

```
mcp__claude-in-chrome__gif_creator filename="test_workflow.gif"
- Capture frames during interactions for review
```

## Scoreboard-Specific Debugging

### Check Game State

```javascript
// Evaluate in page context
mcp__claude-in-chrome__javascript_tool code="JSON.stringify(window.__gameState || 'No state exposed', null, 2)"
```

### Debug WebSocket Connection

```
1. mcp__claude-in-chrome__read_network_requests - Look for WebSocket connections
2. mcp__claude-in-chrome__read_console_messages pattern="WebSocket" - Check for WS errors
3. Look for "update" events in console logs
```

### Test Penalty Dialog

```
1. mcp__claude-in-chrome__read_page - Find "Add Penalty" button
2. mcp__claude-in-chrome__computer action="click" coordinate=[x, y] - Click add button
3. mcp__claude-in-chrome__read_page - Verify dialog opened
4. mcp__claude-in-chrome__form_input - Fill player number and minutes
5. mcp__claude-in-chrome__computer action="click" coordinate=[x, y] - Click save
```

### Test Goal Entry

```
1. Find and click goal button for team
2. Fill goal dialog (period, time, player, assists)
3. Submit and verify game state updates via read_page
```

## Context Reduction Guidelines

**DO** use these efficiently:

- `read_page` - Get structured page content
- `read_console_messages` with `pattern` - Filter to relevant logs
- `get_page_text` - Get just the text content when structure isn't needed

**DO NOT** include in responses:

- Full page content (summarize key elements instead)
- All network requests (filter to relevant types)
- Full request/response bodies (summarize key data)

**Summary Format:**

```
Page State: Control UI loaded, game active
Console: 2 warnings (deprecation), 0 errors
Network: WebSocket connected, 12 API calls (all 200 OK)
Key Elements:
  - Clock: 15:32 (running)
  - Score: Home 2 - Away 1
  - Penalties: 2 active
```

## Multi-Tab Operations

When working with multiple browser tabs:

```
1. mcp__claude-in-chrome__tabs_context_mcp - See all open tabs
2. mcp__claude-in-chrome__tabs_create_mcp url="http://localhost:5173" - Open new tab
```

## Keyboard Shortcuts

Use browser shortcuts for quick actions:

```
mcp__claude-in-chrome__shortcuts_list - See available shortcuts
mcp__claude-in-chrome__shortcuts_execute shortcut="<name>" - Execute a shortcut
```

## Finding Elements

Use the find tool to locate specific elements:

```
mcp__claude-in-chrome__find query="Add Penalty" - Find element by text
```
