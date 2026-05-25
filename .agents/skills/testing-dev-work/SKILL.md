---
name: testing-dev-work
description: How to set up, build, test, and run end-to-end tests for the dev-work Electron app. Use when verifying UI or backend changes.
---

## Project Overview

dev-work is an Electron desktop app (React renderer + Node.js main process) for orchestrating autonomous agent workflows. It uses electron-vite for dev/build.

## Quick Commands

```bash
cd /home/ubuntu/repos/dev-work/app

# Install dependencies
npm install

# Dev server (launches Electron window)
DISPLAY=:0 npm run dev

# Run tests (Vitest)
npm test

# Typecheck
npm run typecheck
# or: npx tsc -b

# Lint
npm run lint
# or: npx eslint src/ tests/

# Build for distribution
npm run build
```

## Environment Requirements

- Node.js (deps already in node_modules)
- X11 display for Electron GUI: `DISPLAY=:0` must be set
- Electron v41.x is installed locally in node_modules
- `wmctrl` is useful for maximizing the Electron window for recordings:
  ```bash
  sudo apt-get install -y wmctrl
  DISPLAY=:0 wmctrl -r "Multi-Agent Command Center" -b add,maximized_vert,maximized_horz
  ```

## Running the Electron App

1. `cd /home/ubuntu/repos/dev-work/app && DISPLAY=:0 npm run dev`
2. The app window title is "Multi-Agent Command Center"
3. Dev server runs on http://localhost:5173/ (renderer only — full app requires Electron)
4. DBus errors in console are expected and harmless in headless environments
5. GPU errors (`ContextResult::kTransientFailure`) are expected and don't affect functionality

## App Architecture for Testing

- **10 tabs** in the nav bar: Mission Control, Agents, Tasks, Workflows, Marketplace, Analytics, Team, Security, Usage, Settings
- Tab navigation is via `TabNav.tsx` — clicking a tab sets `activeTab` state in `App.tsx`
- Each tab renders a different component conditionally
- Data flows through `DashboardSnapshot` (polled every 3s) except Analytics (loaded on-demand via IPC)
- Backend state is persisted in SQLite via `appStore.ts`
- IPC handlers are registered in `ipc.ts`, bridged through `preload/index.ts`

## Seeded Default Data

On first run, the orchestrator seeds:
- 1 runner profile (Demo Local Agent)
- 3 agents (Planner, Builder, Reviewer)
- 6 marketplace entries (3 runners: OpenAI=installed, Anthropic, Ollama; 3 plugins: Slack, GitHub, Metrics)
- 1 admin user (Admin, admin@localhost)
- Sandbox config defaults: enabled=false, runtime=none, memory=512MB, CPU=1, timeout=300s

## Testing Approach

- **Unit tests**: `npm test` runs Vitest (32+ tests across main process and renderer)
- **E2E GUI testing**: Launch app with `npm run dev`, use computer tool to click through tabs
- **Key things to verify per tab**:
  - Marketplace: 6 entries render, install/uninstall toggles badge
  - Team: default admin user, add member form, role change dropdown
  - Workflows: create workflow with steps, verify card appears with step count
  - Analytics: async-loaded, check zero-state values (0 runs, 0%, $0)
  - Security: config grid shows defaults, edit form saves and persists
- **Regression**: Always check Mission Control and Agents tabs still render

## Common Issues

- If the app window doesn't appear, verify `DISPLAY=:0` is set and X11 is running (`xdpyinfo`)
- Electron may log DBus and GPU errors to stderr — these are cosmetic
- Analytics tab loads data asynchronously via `commandCenterClient.getAnalytics()` — if it shows "Loading analytics data..." indefinitely, the IPC handler may be broken
- The app data is stored in a local SQLite file — restarting the app preserves state from previous runs

## No CI Configured

This repo has no CI pipeline. Verification is manual: run typecheck + test + lint locally.
