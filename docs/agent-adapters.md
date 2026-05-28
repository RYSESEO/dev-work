# Agent Adapters

Pre-built integrations for connecting popular AI agents to the dev-work dashboard.

## Available Adapters

| Adapter | Package | Method |
|---------|---------|--------|
| TypeScript SDK | `@dev-work/agent-sdk` | npm package |
| CLI Wrapper | `@dev-work/cli` | npm global install |
| GitHub Actions | `RYSESEO/dev-work/packages/github-action` | GitHub Action |
| GitLab CI | Template YAML | Include directive |
| Cursor | SDK / CLI | Wrapper or script |
| Copilot | SDK / CLI | API or wrapper |
| Devin | SDK / Bridge | Webhook bridge |

## TypeScript SDK

The SDK provides a type-safe client for sending events to the webhook API.

```bash
npm install @dev-work/agent-sdk
```

```typescript
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: 'dw_your_key',
  port: 9400
});

// Full run lifecycle
const run = await client.startRun('my-agent', 'Task description');
await run.progress('Working...');
await run.usage(1500, 0.045, 'gpt-4o', 'openai');
await run.artifact('Summary', 'summary', 'Changes made');
await run.complete('Done!', 12000);

// Or from environment variables
import { createClientFromEnv } from '@dev-work/agent-sdk';
const envClient = createClientFromEnv(); // reads DEVWORK_API_KEY, etc.
```

See [`packages/agent-sdk/README.md`](../packages/agent-sdk/README.md) for full API reference.

## CLI Wrapper

Wrap any command and auto-report runs to dev-work.

```bash
npm install -g @dev-work/cli
export DEVWORK_API_KEY="dw_your_key"

# Track commands
dw-agent run -- npm test
dw-agent run --agent cursor -- cursor-agent --task "Fix bug"

# Manual reporting
dw-agent report 1500 0.045 --model gpt-4o
dw-agent heartbeat --agent my-bot
dw-agent status
```

See [`packages/cli/README.md`](../packages/cli/README.md) for full documentation.

## GitHub Actions

```yaml
- name: Run tests (tracked)
  uses: RYSESEO/dev-work/packages/github-action@main
  with:
    api-key: ${{ secrets.DEVWORK_API_KEY }}
    host: ${{ secrets.DEVWORK_HOST }}
    run-command: 'npm test'
```

See [`packages/github-action/README.md`](../packages/github-action/README.md).

## GitLab CI

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/RYSESEO/dev-work/main/packages/adapters/gitlab-ci-template.yml'

build:
  extends: .devwork-tracked
  variables:
    DEVWORK_API_KEY: $DEVWORK_API_KEY
  script:
    - npm ci && npm test
```

## Cursor / Copilot / Devin

See the adapter guides:
- [`packages/adapters/cursor.md`](../packages/adapters/cursor.md)
- [`packages/adapters/copilot.md`](../packages/adapters/copilot.md)
- [`packages/adapters/devin.md`](../packages/adapters/devin.md)

## Architecture

All adapters send events to the same webhook API endpoint:

```
Adapter → POST /api/v1/events → dev-work webhook server → Dashboard
```

Each adapter:
1. Authenticates with a `dw_` API key (Bearer token)
2. Sends structured events (`run.started`, `run.completed`, `usage.report`, etc.)
3. Events are linked to an integration record in the dashboard
4. Stats (event count, tokens, cost) are tracked per-integration

## Environment Variables

All adapters read from the same env vars:

| Variable | Required | Default |
|----------|----------|---------|
| `DEVWORK_API_KEY` | Yes | — |
| `DEVWORK_HOST` | No | `127.0.0.1` |
| `DEVWORK_PORT` | No | `9400` |
| `DEVWORK_AGENT_NAME` | No | varies |
| `DEVWORK_AGENT_VERSION` | No | — |
| `DEVWORK_BASE_URL` | No | — |
