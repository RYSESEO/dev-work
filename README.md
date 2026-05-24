# Multi-Agent Command Center

A desktop command center for orchestrating AI agent runs, managing missions, approving actions, and tracking usage — built with Electron, React, and TypeScript.

## Features

### Core
- **Mission management** — create and switch between missions with goals and status tracking
- **Task board** — prioritized work items with status, assignment, and descriptions
- **Agent fleet** — configure agent profiles with roles and runner backends
- **One-click tasks** — pre-built task templates (review repo, plan feature, fix tests, etc.)
- **Approval system** — session-scoped approval grants with risk-level classification
- **Cost & usage tracking** — per-agent token estimates, cost breakdown, and run history
- **Activity timeline** — real-time event feed from active agent runs
- **Runner protocol** — NDJSON-based protocol for pluggable agent runners

### Marketplace & Plugins
- **Runner marketplace** — browse, install, and manage runner packages (OpenAI, Anthropic, Ollama, custom)
- **Plugin system** — extensible hook-based plugin architecture (beforeRunStart, afterRunComplete, onApproval, etc.)
- **One-click install/uninstall** — marketplace entries with ratings, downloads, and version tracking

### Team & Access Control
- **Multi-user support** — create and manage team members with role assignments
- **Role-based access control** — admin, operator, and viewer roles with granular permissions
- **Permission matrix** — clear visibility into what each role can do

### Workflow Automation
- **Workflow templates** — reusable multi-step agent chains (e.g., Plan → Build → Review → Deploy)
- **Visual workflow builder** — step-by-step editor with agent role assignment and failure policies
- **Workflow execution engine** — sequential step execution with stop/skip/retry on failure
- **Workflow run tracking** — real-time progress, step status, and history

### Analytics & ROI
- **Analytics dashboard** — total runs, success rate, average duration, cost breakdown
- **ROI tracking** — estimated time saved, agent costs, and net savings calculations
- **Runs-by-day chart** — visual activity timeline with cost overlay
- **Agent performance** — per-agent run counts, success rates, and performance bars

### Security & Sandbox
- **Sandbox configuration** — Docker and Firecracker runtime options for isolated execution
- **Resource limits** — memory, CPU, and timeout controls per sandbox
- **Network policy** — enable or block network access for sandboxed agents
- **Security dashboard** — at-a-glance view of all security settings

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

### Test & Lint

```bash
cd app
npm test           # Run all tests (Vitest)
npm run typecheck  # Type-check only
npm run test:watch # Watch mode
npm run lint       # ESLint
npm run lint:fix   # ESLint with auto-fix
npm run format     # Prettier format
npm run format:check # Prettier check
```

### Package for Distribution

```bash
cd app
npm run pack       # Build + package (unpacked, for testing)
npm run dist       # Build + package installers for current platform
npm run dist:win   # Windows (NSIS + portable)
npm run dist:mac   # macOS (DMG)
npm run dist:linux # Linux (AppImage + deb)
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
│   │   │   ├── commandRunner.ts # Local command runner
│   │   │   └── openaiRunner.ts  # OpenAI API runner
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
│               ├── MarketplaceView.tsx
│               ├── WorkflowsView.tsx
│               ├── AnalyticsView.tsx
│               ├── TeamView.tsx
│               ├── SecurityView.tsx
│               ├── MetricStrip.tsx
│               ├── TabNav.tsx
│               └── ActivityTimeline.tsx
├── tests/
│   ├── main/
│   │   ├── appStore.test.ts
│   │   ├── orchestrator.test.ts
│   │   ├── orchestratorRuns.test.ts
│   │   ├── commandRunner.test.ts
│   │   ├── approvalPolicy.test.ts
│   │   ├── marketplace.test.ts
│   │   ├── teamAndRbac.test.ts
│   │   ├── workflows.test.ts
│   │   ├── analytics.test.ts
│   │   └── sandbox.test.ts
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

## Runners

The orchestrator supports pluggable runners via the `Runner` interface. Each runner profile specifies a `type` that determines which runner handles it:

| Runner | Type | Description |
|--------|------|-------------|
| `CommandRunner` | `command` | Spawns a local child process, communicates via NDJSON over stdin/stdout |
| `OpenAIRunner` | `openai` | Calls the OpenAI Chat Completions API (requires `OPENAI_API_KEY`) |

To add a new runner, implement the `Runner` interface in `src/main/runners/`, add a corresponding profile type to `domain.ts`, and register it in the orchestrator's `runners` map.

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
