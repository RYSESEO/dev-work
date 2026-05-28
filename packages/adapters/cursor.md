# Cursor Adapter for dev-work

Track [Cursor](https://cursor.sh) AI agent activity in the dev-work dashboard.

## Overview

Cursor doesn't expose a native extension API for tracking agent interactions, so we use a **file watcher + CLI wrapper** approach to capture agent activity.

## Setup

### Option 1: CLI Wrapper (Recommended)

Wrap Cursor's agent commands with `dw-agent` to auto-report runs:

```bash
# Install the CLI
npm install -g @dev-work/cli

# Set your API key
export DEVWORK_API_KEY="dw_your_key_here"

# Wrap cursor commands
dw-agent run --agent cursor -- cursor-agent --task "Fix auth bug"
```

### Option 2: TypeScript SDK in custom scripts

If you have automation scripts that invoke Cursor programmatically:

```typescript
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: process.env.DEVWORK_API_KEY!,
  agentName: 'cursor',
  agentVersion: '0.45.0',
  heartbeatInterval: 60_000
});

// Track a Cursor session
const run = await client.startRun('cursor', 'Refactor auth module', {
  model: 'gpt-4o',
  workspace: '/home/user/my-app'
});

// Report progress as Cursor works
await run.progress('Analyzing 3 files...', { filesAnalyzed: '3' });

// Report token usage
await run.usage(4200, 0.126, 'gpt-4o', 'openai');

// Report artifacts (generated code, diffs)
await run.artifact('Refactoring Summary', 'summary',
  'Converted 3 functions from session-based to JWT auth.');

// Complete the run
await run.complete('Auth module refactored', 32000, {
  filesChanged: '4',
  testsRun: '12',
  testsPassed: '12'
});

client.destroy();
```

### Option 3: Shell script (minimal)

```bash
#!/bin/bash
# cursor-report.sh — Minimal Cursor tracking via curl

API_KEY="${DEVWORK_API_KEY}"
HOST="${DEVWORK_HOST:-127.0.0.1}"
PORT="${DEVWORK_PORT:-9400}"
RUN_ID="cursor_$(date +%s)"

# Report start
curl -s -X POST "http://${HOST}:${PORT}/api/v1/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"type\": \"run.started\",
    \"payload\": {
      \"runId\": \"${RUN_ID}\",
      \"agentName\": \"cursor\",
      \"status\": \"started\",
      \"prompt\": \"$1\"
    }
  }"

# ... do work ...

# Report completion
curl -s -X POST "http://${HOST}:${PORT}/api/v1/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{
    \"type\": \"run.completed\",
    \"payload\": {
      \"runId\": \"${RUN_ID}\",
      \"agentName\": \"cursor\",
      \"status\": \"completed\",
      \"output\": \"Task completed\"
    }
  }"
```

## Integration in dev-work

1. Open the **Integrations** tab
2. Create an API key with `events:write` scope
3. Click **Add Integration** → select **Cursor** type
4. Use any of the options above to start sending events
5. Events appear in the **Connected Agents** grid with live stats

## What Gets Tracked

| Metric | Source |
|--------|--------|
| Run count | run.started / run.completed events |
| Success rate | completed vs failed runs |
| Token usage | usage.report events |
| Cost | usage.report costUsd field |
| Duration | durationMs in run.completed |
| Artifacts | artifact.created events |
| Uptime | heartbeat events |
