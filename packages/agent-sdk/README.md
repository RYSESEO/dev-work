# @dev-work/agent-sdk

TypeScript SDK for reporting AI agent activity to the [dev-work](https://github.com/RYSESEO/dev-work) dashboard.

## Install

```bash
npm install @dev-work/agent-sdk
```

## Quick Start

```typescript
import { DevWorkClient } from '@dev-work/agent-sdk';

const client = new DevWorkClient({
  apiKey: 'dw_your_key_here', // from Integrations tab
  port: 9400                   // default webhook port
});

// Track a full run lifecycle
const run = await client.startRun('my-agent', 'Refactor auth module');
await run.progress('Analyzing 3 files...');
await run.usage(1500, 0.045, 'gpt-4o', 'openai');
await run.artifact('Summary', 'summary', 'Changed auth.ts, middleware.ts');
await run.complete('Refactoring complete', 12000);

client.destroy();
```

## Environment Variables

Create a client from env vars instead of hardcoding config:

```typescript
import { createClientFromEnv } from '@dev-work/agent-sdk';

// Reads DEVWORK_API_KEY, DEVWORK_HOST, DEVWORK_PORT, etc.
const client = createClientFromEnv();
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEVWORK_API_KEY` | Yes | — | API key from Integrations tab |
| `DEVWORK_HOST` | No | `127.0.0.1` | Webhook server host |
| `DEVWORK_PORT` | No | `9400` | Webhook server port |
| `DEVWORK_BASE_URL` | No | — | Full URL (overrides host/port) |
| `DEVWORK_AGENT_NAME` | No | `custom-agent` | Agent name for heartbeats |
| `DEVWORK_AGENT_VERSION` | No | — | Agent version string |
| `DEVWORK_HEARTBEAT_INTERVAL` | No | `0` | Auto-heartbeat interval in ms |

## API

### `new DevWorkClient(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | **Required.** API key starting with `dw_` |
| `host` | `string` | `127.0.0.1` | Webhook server host |
| `port` | `number` | `9400` | Webhook server port |
| `baseUrl` | `string` | — | Full URL override |
| `timeout` | `number` | `10000` | Request timeout in ms |
| `retries` | `number` | `2` | Retry count for 5xx/network errors |
| `heartbeatInterval` | `number` | `0` | Auto-heartbeat interval in ms |
| `agentName` | `string` | `custom-agent` | Agent name for heartbeats |
| `agentVersion` | `string` | — | Agent version string |

### Event Methods

```typescript
// Raw event
await client.sendEvent('heartbeat', { agentName: 'my-agent' });

// Run lifecycle
await client.runStarted('agent', 'run-123', 'Fix bug');
await client.runProgress('agent', 'run-123', 'Working on it...');
await client.runCompleted('agent', 'run-123', 'Done', 5000);
await client.runFailed('agent', 'run-123', 'Crash', 3000);

// Usage & artifacts
await client.reportUsage(1500, 0.045, 'gpt-4o', 'openai', 'run-123');
await client.reportArtifact('Log', 'log', 'file contents', '/path/to/file');

// Health check (no auth)
const status = await client.status();
```

### Run Tracker

`startRun()` returns a `RunTracker` for cleaner run lifecycle management:

```typescript
const run = await client.startRun('cursor', 'Implement feature X');

await run.progress('Step 1 complete');
await run.usage(800, 0.024, 'gpt-4o', 'openai');
await run.artifact('Diff', 'file', null, 'src/feature.ts');
await run.complete('Feature implemented', 15000);
// or: await run.fail('Timeout exceeded', 30000);
```

### Auto-Heartbeat

```typescript
const client = new DevWorkClient({
  apiKey: 'dw_...',
  heartbeatInterval: 30_000, // every 30s
  agentName: 'my-agent',
  agentVersion: '1.0.0'
});

// Heartbeats are sent automatically
// Call destroy() to stop
client.destroy();
```

### Error Handling

```typescript
import { DevWorkClient, DevWorkApiError } from '@dev-work/agent-sdk';

try {
  await client.sendEvent('run.started', payload);
} catch (err) {
  if (err instanceof DevWorkApiError) {
    console.error(`API error ${err.statusCode}: ${err.body.error}`);
  }
}
```

## License

MIT
