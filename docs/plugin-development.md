# Plugin Development

Plugins extend Command Center with custom behavior at key lifecycle points. This guide covers the plugin architecture, available hooks, and how to build your own plugins.

## Plugin Model

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  hooks: PluginHook[];
  config: Record<string, string>;
  enabled: boolean;
  installedAt: string;
}
```

## Available Hooks

Plugins can subscribe to these lifecycle events:

| Hook | Trigger | Payload |
|------|---------|---------|
| `beforeRunStart` | Before a run begins execution | `{ runId, taskId }` |
| `afterRunComplete` | After a run finishes (success or failure) | `{ runId, taskId }` |
| `onApprovalRequest` | When an agent requests approval | `{ requestId, tool, risk }` |
| `onArtifactCreated` | When an agent produces an artifact | `{ artifactId, name, mime }` |
| `onMissionCreated` | When a new mission is created | `{ missionId }` |
| `onTaskCreated` | When a new task is created | `{ taskId, missionId }` |

## Creating a Plugin

### 1. Define the Manifest

Create a `manifest.json` in your plugin package:

```json
{
  "id": "my-slack-notifier",
  "name": "Slack Notifier",
  "version": "1.0.0",
  "description": "Sends Slack notifications on run completion",
  "hooks": ["afterRunComplete", "onApprovalRequest"],
  "config": {
    "SLACK_WEBHOOK_URL": "",
    "SLACK_CHANNEL": "#dev-agents"
  }
}
```

### 2. Install via Marketplace

Plugins are distributed through the marketplace. To install:

1. Go to the **Marketplace** tab
2. Find your plugin or install from a local path
3. Click **Install** — the plugin is registered and its hooks are activated

### 3. Configure

After installation, configure the plugin in **Settings**:

- Set required environment variables (API keys, webhook URLs)
- Enable/disable individual plugins
- Adjust config values per-plugin

## Plugin Runtime

The plugin runtime (`pluginRuntime.ts`) manages hook invocation:

```typescript
interface PluginRuntime {
  invokeHook(hook: PluginHook, payload: Record<string, unknown>): Promise<void>;
  getPlugins(): Plugin[];
  enablePlugin(pluginId: string): void;
  disablePlugin(pluginId: string): void;
}
```

When a lifecycle event occurs, the runtime:

1. Finds all enabled plugins subscribed to that hook
2. Invokes each plugin's handler with the event payload
3. Logs any errors without blocking the main flow

## Example: Webhook Notifier Plugin

```typescript
// This runs inside the plugin runtime
export default {
  hooks: {
    async afterRunComplete({ runId, taskId }) {
      const webhookUrl = this.config.WEBHOOK_URL;
      if (!webhookUrl) return;

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Run ${runId} completed for task ${taskId}`,
          timestamp: new Date().toISOString()
        })
      });
    }
  }
};
```

## Example: Auto-Approval Plugin

```typescript
export default {
  hooks: {
    async onApprovalRequest({ requestId, tool, risk }) {
      // Auto-approve low-risk file reads
      if (risk === 'low' && tool.startsWith('read_')) {
        return { action: 'approve' };
      }
      // Everything else goes through manual approval
      return { action: 'manual' };
    }
  }
};
```

## Marketplace Distribution

To publish a plugin to the marketplace:

1. Package your plugin as a directory with `manifest.json`
2. Include a README with usage instructions
3. Submit to the marketplace registry

### Manifest Format

```json
{
  "id": "unique-plugin-id",
  "name": "Human-Readable Name",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Your Name",
  "hooks": ["hookName1", "hookName2"],
  "config": {
    "CONFIG_KEY": "default_value"
  },
  "category": "notifications",
  "tags": ["slack", "webhooks"]
}
```

## Best Practices

1. **Handle errors gracefully** — Plugin failures should never crash the host app. Wrap all async operations in try/catch.
2. **Keep hooks lightweight** — Avoid long-running operations in hooks. Use webhooks for external integrations.
3. **Document config keys** — Clearly explain what each config value does in your README.
4. **Version carefully** — Follow semver. Breaking changes to hook signatures require a major version bump.
5. **Test independently** — Test your plugin logic outside of Command Center before installing.
