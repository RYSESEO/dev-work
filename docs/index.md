# Multi-Agent Command Center

**A desktop-native platform for orchestrating AI agents with full visibility and control.**

Multi-Agent Command Center is an Electron application that lets you define missions, assign tasks to AI agents, monitor their execution in real-time, and maintain approval control over sensitive operations — all from a single dashboard.

## Why Command Center?

| Feature | Cloud Platforms | IDE Extensions | **Command Center** |
|---------|----------------|----------------|-------------------|
| Local-first data | ✗ | ✗ | ✓ |
| Multi-agent orchestration | ✓ | ✗ | ✓ |
| Approval workflows | ✗ | ✗ | ✓ |
| Agent-agnostic | ✗ | ✗ | ✓ |
| Visual dashboard | ✓ | ✗ | ✓ |
| Plugin system | ✗ | ✓ | ✓ |

## Quick Start

```bash
git clone https://github.com/RYSESEO/dev-work.git
cd dev-work/app
npm install
npm run dev
```

→ [Getting Started Guide](./getting-started.md)

## Documentation

- [Getting Started](./getting-started.md) — Installation, first mission, basic workflow
- [Architecture](./architecture.md) — How the app is structured (main process, renderer, IPC)
- [Runner Protocol](./runner-protocol.md) — Build custom runners to connect any AI provider
- [Plugin Development](./plugin-development.md) — Extend the platform with lifecycle hooks
- [API Reference](./api-reference.md) — Complete IPC handler and client API documentation
- [Configuration](./configuration.md) — Runner profiles, sandbox settings, telemetry, backups
- [License Keys](./license-keys.md) — Signed key format, issuing keys, key rotation

## Key Concepts

- **Missions** — High-level objectives that contain one or more tasks
- **Tasks** — Individual units of work assigned to agents
- **Agents** — AI-powered workers that execute tasks using runner profiles
- **Runners** — Execution backends (local command, OpenAI, custom HTTP)
- **Approval Grants** — Permission rules that control what agents can do
- **Workflows** — Reusable multi-step automation chains

## License

MIT
