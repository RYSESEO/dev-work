# Devin Adapter for dev-work

Track [Devin](https://devin.ai) session activity in the dev-work dashboard.

## Overview

Devin sessions produce structured events (session start, planning, coding, testing, PR creation). This adapter maps Devin's webhook events to the dev-work event schema.

## Setup

### Option 1: Devin Webhook → dev-work Bridge

Create a lightweight bridge service that receives Devin webhooks and forwards them to dev-work:

```typescript
import http from 'node:http';
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: process.env.DEVWORK_API_KEY!,
  agentName: 'devin',
  agentVersion: '2.0'
});

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end();
    return;
  }

  const body = await new Promise<string>((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  const event = JSON.parse(body);

  // Map Devin events to dev-work events
  switch (event.type) {
    case 'session.created':
      await client.runStarted('devin', event.session_id, event.prompt, {
        url: event.url,
        requester: event.requester
      });
      break;

    case 'session.updated':
      await client.runProgress('devin', event.session_id,
        event.status_message || 'Working...', {
        status: event.status,
        step: event.current_step
      });
      break;

    case 'session.completed':
      await client.runCompleted('devin', event.session_id,
        event.summary || 'Session completed',
        event.duration_ms, {
        pr_url: event.pr_url || '',
        files_changed: String(event.files_changed || 0)
      });
      break;

    case 'session.failed':
      await client.runFailed('devin', event.session_id,
        event.error || 'Session failed',
        event.duration_ms);
      break;

    case 'usage':
      await client.reportUsage(
        event.tokens,
        event.cost_usd,
        event.model,
        'devin',
        event.session_id
      );
      break;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(3001, () => {
  console.log('Devin → dev-work bridge listening on :3001');
});
```

### Option 2: SDK in Your Devin Workflow

If you trigger Devin sessions programmatically, use the SDK directly:

```typescript
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: process.env.DEVWORK_API_KEY!,
  agentName: 'devin',
  heartbeatInterval: 60_000
});

// Track a Devin session
const run = await client.startRun('devin', 'Implement user auth', {
  sessionUrl: 'https://app.devin.ai/sessions/abc123'
});

// Report progress as session updates come in
await run.progress('Planning implementation...', { step: 'planning' });
await run.progress('Writing code...', { step: 'coding' });
await run.progress('Running tests...', { step: 'testing' });

// Report usage
await run.usage(12000, 0.36, 'claude-3.5-sonnet', 'anthropic');

// Report artifacts (PRs, files)
await run.artifact('Pull Request', 'report', 'PR #42: Implement user auth');

// Complete
await run.complete('PR created and tests passing', 180000, {
  prUrl: 'https://github.com/org/repo/pull/42',
  filesChanged: '8',
  testsAdded: '5'
});

client.destroy();
```

### Option 3: CLI Wrapper

```bash
# Track Devin CLI invocations
dw-agent run --agent devin -- devin "Fix the login page CSS"
```

## Integration in dev-work

1. Open the **Integrations** tab
2. Create an API key with `events:write` scope
3. Click **Add Integration** → select **Devin** type
4. Set up the webhook bridge or SDK integration
5. Events appear in the **Connected Agents** grid

## Event Mapping

| Devin Event | dev-work Event | Payload |
|-------------|---------------|---------|
| session.created | run.started | prompt, session URL |
| session.updated | run.progress | status message, step |
| session.completed | run.completed | summary, PR URL, files changed |
| session.failed | run.failed | error message |
| usage | usage.report | tokens, cost, model |
