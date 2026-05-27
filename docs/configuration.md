# Configuration

## Runner Profiles

Runner profiles define how agents execute tasks. Configure them in **Settings → Runner Profiles**.

### Command Runner

Executes shell commands in a local workspace:

```json
{
  "type": "command",
  "name": "Local Shell",
  "workspace": "/path/to/project",
  "env": {}
}
```

### OpenAI Runner

Connects to OpenAI's chat completions API:

```json
{
  "type": "openai",
  "name": "GPT-4 Turbo",
  "workspace": "/path/to/project",
  "env": {
    "OPENAI_API_KEY": "sk-...",
    "MODEL": "gpt-4-turbo"
  }
}
```

### Anthropic Runner

Connects to Anthropic's messages API:

```json
{
  "type": "anthropic",
  "name": "Claude Sonnet",
  "workspace": "/path/to/project",
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "MODEL": "claude-sonnet-4-20250514"
  }
}
```

### Ollama Runner (Local)

Connects to a local Ollama instance:

```json
{
  "type": "ollama",
  "name": "Local Llama",
  "workspace": "/path/to/project",
  "env": {
    "OLLAMA_HOST": "http://localhost:11434",
    "MODEL": "llama3"
  }
}
```

### Custom HTTP Runner

Connects to any HTTP endpoint that accepts the runner protocol:

```json
{
  "type": "custom-http",
  "name": "My Custom API",
  "workspace": "/path/to/project",
  "env": {
    "ENDPOINT_URL": "https://my-api.example.com/v1/run",
    "API_KEY": "...",
    "MODEL": "my-model"
  }
}
```

## Sandbox Configuration

Configure execution sandboxing in **Settings → Security**:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Enable sandbox execution |
| `runtime` | `docker` | Container runtime (`docker` or `firecracker`) |
| `memoryMb` | `512` | Memory limit in MB |
| `cpuCount` | `1` | CPU core limit |
| `timeoutSeconds` | `300` | Maximum execution time |
| `networkPolicy` | `restricted` | Network access (`none`, `restricted`, `full`) |
| `allowedPaths` | `[]` | Host paths accessible inside the sandbox |

## Telemetry

Opt-in usage analytics. Configure in **Settings → Telemetry**:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Enable usage tracking |
| `webhookUrl` | `""` | Optional webhook URL for event export |

When enabled, these events are tracked locally in SQLite:
- `mission_created` — When a mission is created
- `run_started` — When an agent run begins
- `run_finished` — When a run completes or fails

No data leaves your machine unless a webhook URL is configured.

## Backup & Restore

### Manual Backup

Create a backup from **Settings → Backup & Restore → Create Backup**. Backups are saved as JSON files containing all application data.

### Auto-Backup

The system can automatically create backups before database migrations. Backups are stored in the `backups/` directory relative to the data directory.

### Restore

To restore from a backup, use the `restoreBackup` API with the path to a backup JSON file.

## Notifications

Configure desktop notifications in **Settings → Notifications**:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Master toggle |
| `onApprovalRequest` | `true` | Notify when agent requests approval |
| `onRunComplete` | `true` | Notify when a run finishes |
| `onRunFailed` | `true` | Notify when a run fails |

## Appearance

| Setting | Options | Description |
|---------|---------|-------------|
| Theme | `light`, `dark`, `system` | UI color scheme |

Theme preference is stored in `localStorage` under the key `command-center:theme`.

## License Tiers

| Tier | Missions | Agents | Runners | Workflows |
|------|----------|--------|---------|-----------|
| Free | 3 | 2 | 1 | 1 |
| Pro | 50 | 20 | 10 | 25 |
| Team | Unlimited | Unlimited | Unlimited | Unlimited |

Activate a license key in **Settings → License**.
