# Multi-Agent Command Center

A desktop command center for orchestrating AI agent runs, managing missions, approving actions, and tracking usage — built with Electron, React, and TypeScript.

## Features

- **Mission management** — create and switch between missions with goals and status tracking
- **Task board** — prioritized work items with status, assignment, and descriptions
- **Agent fleet** — configure agent profiles with roles and runner backends
- **One-click tasks** — pre-built task templates (review repo, plan feature, fix tests, etc.)
- **Approval system** — session-scoped approval grants with risk-level classification
- **Cost & usage tracking** — per-agent token estimates, cost breakdown, and run history
- **Activity timeline** — real-time event feed from active agent runs
- **Runner protocol** — NDJSON-based protocol for pluggable agent runners

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Electron                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Main     │  │ Preload  │  │ Renderer  │ │
│  │ Process   │──│  Bridge  │──│  (React)  │ │
│  │           │  └──────────┘  └───────────┘ │
│  │ ┌───────┐ │                              │
│  │ │ Store │ │  ← SQLite via sql.js         │
│  │ └───────┘ │                              │
│  │ ┌───────┐ │                              │
│  │ │Orch.  │ │  ← Mission/Task/Run mgmt    │
│  │ └───────┘ │                              │
│  │ ┌───────┐ │                              │
│  │ │Runner │ │  ← Spawns agent processes    │
│  │ └───────┘ │                              │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
```

- **Main process** — Electron main with IPC handlers, SQLite persistence, orchestrator, and runner management
- **Renderer** — React 19 SPA with tab navigation, dashboard, and data views
- **Preload bridge** — typed `contextBridge` API with context isolation and sandbox enabled
- **Runner protocol** — NDJSON over stdin/stdout for agent communication (logs, usage, approvals, artifacts)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 41 |
| UI framework | React 19, lucide-react icons |
| Language | TypeScript 6 (strict mode) |
| Build | electron-vite, Vite 7 |
| Testing | Vitest, Testing Library, jsdom |
| Database | sql.js (SQLite compiled to WASM) |
| Styling | Plain CSS with custom properties |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- npm

### Install & Run

```bash
cd app
npm install
npm run dev        # Launch Electron dev server with hot reload
```

### Build

```bash
cd app
npm run build      # Type-check + production build
```

### Test

```bash
cd app
npm test           # Run all tests (Vitest)
npm run typecheck  # Type-check only
npm run test:watch # Watch mode
```

## Project Structure

```
app/
├── scripts/
│   └── demo-agent.mjs          # Demo agent process (exercises runner protocol)
├── src/
│   ├── main/
│   │   ├── index.ts             # Electron main process entry
│   │   ├── ipc.ts               # IPC handler registration
│   │   ├── db/
│   │   │   └── appStore.ts      # SQLite persistence (sql.js)
│   │   ├── runners/
│   │   │   ├── types.ts         # Runner interfaces
│   │   │   └── commandRunner.ts # Local command runner
│   │   └── services/
│   │       ├── orchestrator.ts  # Mission/task/run coordination
│   │       └── approvalPolicy.ts# Session-scoped approval matching
│   ├── preload/
│   │   └── index.ts             # Context bridge (renderer ↔ main)
│   ├── shared/
│   │   ├── domain.ts            # Domain types and helpers
│   │   ├── oneClickTasks.ts     # Built-in task templates
│   │   └── runnerProtocol.ts    # NDJSON message types
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx         # React entry
│           ├── App.tsx          # Tab shell and routing
│           ├── styles.css       # Design system
│           ├── api/
│           │   └── client.ts    # Typed preload bridge client
│           └── components/
│               ├── MissionControl.tsx
│               ├── MissionCreator.tsx
│               ├── OneClickLaunchers.tsx
│               ├── TaskBoard.tsx
│               ├── ApprovalQueue.tsx
│               ├── AgentRoster.tsx
│               ├── AgentsView.tsx
│               ├── TasksView.tsx
│               ├── CostUsageView.tsx
│               ├── SettingsView.tsx
│               ├── MetricStrip.tsx
│               ├── TabNav.tsx
│               └── ActivityTimeline.tsx
├── tests/
│   ├── main/
│   │   ├── appStore.test.ts
│   │   ├── orchestrator.test.ts
│   │   ├── orchestratorRuns.test.ts
│   │   ├── commandRunner.test.ts
│   │   └── approvalPolicy.test.ts
│   └── shared/
│       ├── domain.test.ts
│       └── oneClickTasks.test.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── electron.vite.config.ts
└── vitest.config.ts
```

## Runner Protocol

Agents communicate via NDJSON (newline-delimited JSON) over stdin/stdout:

**Agent → Host:**
| Message | Description |
|---------|-------------|
| `log` | Info/warning/error log line |
| `usage` | Token count, command count, output bytes |
| `approval_request` | Request permission for a scoped action |
| `artifact` | Report a generated file (log, summary, report) |
| `complete` | Signal successful completion |
| `failed` | Signal failure with message |

**Host → Agent:**
| Message | Description |
|---------|-------------|
| `approval_result` | Approve (with grant ID) or reject (with reason) |
| `stop` | Request graceful shutdown |

## License

Private — all rights reserved.
