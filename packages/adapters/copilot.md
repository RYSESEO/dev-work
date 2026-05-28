# GitHub Copilot Adapter for dev-work

Track [GitHub Copilot](https://github.com/features/copilot) usage and productivity in the dev-work dashboard.

## Overview

GitHub Copilot doesn't expose a direct extension API for tracking suggestions. This adapter uses the **Copilot usage API** (for organizations) and a **VS Code output channel monitor** approach.

## Setup

### Option 1: Organization Usage API

If you have GitHub Copilot for Business/Enterprise, use the GitHub API to pull usage data:

```typescript
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: process.env.DEVWORK_API_KEY!,
  agentName: 'copilot'
});

// Fetch from GitHub Copilot usage API
const response = await fetch(
  'https://api.github.com/orgs/YOUR_ORG/copilot/usage',
  { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
);
const usage = await response.json();

// Report aggregated usage to dev-work
for (const day of usage) {
  await client.reportUsage(
    day.total_suggestions_count,
    0, // GitHub doesn't expose per-suggestion cost
    'copilot',
    'github'
  );
}

client.destroy();
```

### Option 2: CLI Wrapper for Copilot CLI

Track Copilot CLI (`gh copilot`) invocations:

```bash
# Install the CLI
npm install -g @dev-work/cli

# Wrap copilot commands
dw-agent run --agent copilot -- gh copilot suggest "How to deploy to K8s"
dw-agent run --agent copilot -- gh copilot explain "git rebase --onto"
```

### Option 3: Manual Reporting Script

Track Copilot activity via periodic usage reports:

```typescript
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: process.env.DEVWORK_API_KEY!,
  agentName: 'copilot',
  heartbeatInterval: 300_000 // 5 min heartbeat
});

// Report a coding session with Copilot
const run = await client.startRun('copilot', 'Coding session: feature-auth', {
  editor: 'vscode',
  language: 'typescript'
});

// Report suggestions accepted during the session
await run.usage(850, 0, 'copilot', 'github');

// Report artifacts (files modified with Copilot assistance)
await run.artifact('Modified Files', 'report',
  'auth.ts, middleware.ts, tests/auth.test.ts');

await run.complete('Session ended', 3600000, {
  suggestionsAccepted: '24',
  suggestionsRejected: '8',
  filesModified: '3'
});

client.destroy();
```

## Integration in dev-work

1. Open the **Integrations** tab
2. Create an API key with `events:write` scope
3. Click **Add Integration** → select **Copilot** type
4. Choose an integration method above
5. Events appear in the **Connected Agents** grid

## Tracked Metrics

| Metric | Source |
|--------|--------|
| Sessions | run.started / run.completed |
| Suggestions | usage.report token counts |
| Acceptance rate | metadata.suggestionsAccepted / total |
| Files modified | artifact.created events |
| Time spent | durationMs in run.completed |
| Active hours | heartbeat events |
