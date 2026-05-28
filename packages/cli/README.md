# @dev-work/cli

CLI wrapper for tracking AI agent commands in the [dev-work](https://github.com/RYSESEO/dev-work) dashboard.

## Install

```bash
npm install -g @dev-work/cli
```

## Setup

1. Open the **Integrations** tab in dev-work
2. Create an API key with `events:write` scope
3. Set the env var or use `--api-key`:

```bash
export DEVWORK_API_KEY="dw_your_key_here"
```

## Commands

### `dw-agent run` — Wrap any command

Wraps a command and auto-reports `run.started` / `run.completed` / `run.failed` events to dev-work.

```bash
# Run a test suite
dw-agent run -- npm test

# Run an AI agent
dw-agent run --agent cursor -- cursor-agent --task "Fix auth bug"

# Run with custom agent name
dw-agent run --agent my-bot -- python agent.py --prompt "Refactor utils"
```

The wrapped command's stdout/stderr are passed through. The exit code is preserved.

### `dw-agent heartbeat` — Send a heartbeat

```bash
dw-agent heartbeat --agent my-bot
```

### `dw-agent report` — Report usage

```bash
dw-agent report 1500 0.045 --model gpt-4o --provider openai
```

### `dw-agent status` — Check server health

```bash
dw-agent status
```

## Options

| Option | Env Var | Default | Description |
|--------|---------|---------|-------------|
| `--api-key <key>` | `DEVWORK_API_KEY` | — | API key (required) |
| `--host <host>` | `DEVWORK_HOST` | `127.0.0.1` | Webhook host |
| `--port <port>` | `DEVWORK_PORT` | `9400` | Webhook port |
| `--agent <name>` | `DEVWORK_AGENT_NAME` | `cli-agent` | Agent name |
| `--model <model>` | — | — | Model name (for report) |
| `--provider <name>` | — | — | Provider name (for report) |

## How It Works

```
┌─────────────────────────────────────────────────┐
│  dw-agent run -- npm test                       │
│                                                 │
│  1. Sends run.started event to webhook API      │
│  2. Spawns "npm test" as child process          │
│  3. Passes through all stdio                    │
│  4. On exit:                                    │
│     - exit 0 → sends run.completed              │
│     - exit !0 → sends run.failed                │
│  5. Exits with same code as child               │
└─────────────────────────────────────────────────┘
         │
         ▼
  POST /api/v1/events → dev-work webhook server
```

## License

MIT
