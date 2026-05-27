# Architecture

## Overview

Command Center is an Electron application with three layers:

```
┌────────────────────────────────────────┐
│           Renderer (React 19)          │
│  Components, Views, Client API         │
├────────────────────────────────────────┤
│         Preload (Context Bridge)       │
│  Type-safe IPC bridge                  │
├────────────────────────────────────────┤
│         Main Process (Node.js)         │
│  Orchestrator, Runners, SQLite Store   │
└────────────────────────────────────────┘
```

## Main Process (`src/main/`)

The main process manages all business logic and data:

- **Orchestrator** (`services/orchestrator.ts`) — Central coordinator for missions, tasks, agents, runs, and all CRUD operations. Exposes the `Orchestrator` interface consumed by IPC handlers.
- **AppStore** (`db/appStore.ts`) — SQLite-backed key-value store using sql.js (WASM). Organizes data into typed collections (missions, tasks, agents, runs, etc.).
- **Migrations** (`db/migrations.ts`) — Schema versioning with automatic migration on startup.
- **Runners** (`runners/`) — Execution backends that implement the `Runner` interface:
  - `CommandRunner` — Spawns local child processes
  - `OpenAIRunner` — Calls OpenAI's chat completions API
- **Services**:
  - `auth.ts` — PBKDF2 password hashing, session management
  - `license.ts` — License key validation with tier-based feature gating
  - `marketplace.ts` — Package registry for installable runners/plugins
  - `pluginRuntime.ts` — Lifecycle hook invocation engine
  - `telemetry.ts` — Opt-in usage analytics with webhook export
  - `backup.ts` — Data backup and restore
  - `approvalPolicy.ts` — Grant-based approval rule matching

### Data Flow

1. User creates a mission → orchestrator stores it in SQLite
2. Task is assigned to an agent → runner spawns execution
3. Runner communicates via the Runner Protocol (stdin/stdout JSON)
4. Events, artifacts, and approval requests flow back through the orchestrator
5. Dashboard snapshot is polled by the renderer every 3 seconds (with delta detection)

## Preload (`src/preload/`)

The preload script uses Electron's `contextBridge` to expose a `commandCenter` API object to the renderer. This is the only channel between renderer and main process.

```typescript
// Example: Renderer calls
window.commandCenter.getSnapshot()
window.commandCenter.createMission(title, goal)
window.commandCenter.launchRun(agentId, taskId)
```

Each method maps to an `ipcRenderer.invoke()` call that the main process handles via `ipcMain.handle()`.

## Renderer (`src/renderer/`)

React 19 application with these views:

| View | Purpose |
|------|---------|
| `MissionControl` | Dashboard with mission/task management |
| `AgentsView` | Agent roster, run launching, log viewer |
| `MarketplaceView` | Browse and install runner packages |
| `TeamView` | User management and role assignment |
| `WorkflowsView` | Multi-step workflow builder |
| `AnalyticsView` | ROI tracking, run statistics |
| `SecurityView` | Sandbox configuration |
| `UsageView` | Token/cost tracking |
| `SettingsView` | Runner profiles, appearance, notifications, telemetry, backup |

### State Management

The renderer polls `getSnapshot()` from the main process every 3 seconds. The snapshot contains the full application state. Delta detection (version tracking) ensures no-op polls when data hasn't changed.

### Component Architecture

- **ErrorBoundary** — Wraps each tab to prevent full-app crashes
- **ToastProvider** — Global toast notification system
- **ConfirmDialog** — Reusable confirmation modal for destructive actions
- **Sidebar** — Grouped navigation with keyboard shortcuts

## Shared (`src/shared/`)

Types and utilities shared between main and renderer:

- `domain.ts` — All TypeScript interfaces (Mission, Task, Agent, Run, etc.)
- `runnerProtocol.ts` — Runner-to-host message format
- `oneClickTasks.ts` — Pre-built task templates

## IPC Communication

All IPC channels follow a `namespace:action` pattern:

```
snapshot           — Full state snapshot
mission:create     — Create a mission
mission:update     — Update a mission
task:create        — Create a task
run:launch         — Launch an agent run
run:stop           — Stop an active run
telemetry:getPrefs — Get telemetry preferences
backup:create      — Create a backup
...
```

See [API Reference](./api-reference.md) for the complete channel list.
