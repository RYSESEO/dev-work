# Command Center UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the renderer into a premium asymmetric Mission Studio while preserving existing command-center behavior.

**Architecture:** Keep the Electron main process, IPC bridge, shared domain, store, and orchestration unchanged. Modify React renderer components and CSS classes so the same snapshot data is presented through a new command header, metric rail, asymmetric dashboard grid, refined panels, responsive tables, and CSS-only motion.

**Tech Stack:** Electron, React 19, TypeScript, plain CSS, existing `lucide-react` icons, Vitest, Testing Library.

---

### Task 1: Renderer Shell And Navigation

**Files:**
- Modify: `app/src/renderer/src/App.tsx`
- Modify: `app/src/renderer/src/components/TabNav.tsx`
- Modify: `app/src/renderer/src/styles.css`

- [ ] Add a top-level shell wrapper for the dock-like navigation and content.
- [ ] Convert loading and error states to redesigned notice/skeleton surfaces.
- [ ] Add lucide icons to tabs while keeping the same tab IDs and labels.
- [ ] Remove the fixed desktop `min-width` from global CSS.

### Task 2: Mission Dashboard Layout

**Files:**
- Modify: `app/src/renderer/src/components/MissionControl.tsx`
- Modify: `app/src/renderer/src/components/MetricStrip.tsx`
- Modify: `app/src/renderer/src/styles.css`

- [ ] Replace the old top bar with a command header containing mission text, status, refresh, and a compact command field.
- [ ] Convert metrics into a horizontal data rail with a subtle repeated stream effect.
- [ ] Recompose the dashboard into left, center, and right grid regions that collapse to one column on small screens.

### Task 3: Operational Panels

**Files:**
- Modify: `app/src/renderer/src/components/OneClickLaunchers.tsx`
- Modify: `app/src/renderer/src/components/MissionCreator.tsx`
- Modify: `app/src/renderer/src/components/TaskBoard.tsx`
- Modify: `app/src/renderer/src/components/ApprovalQueue.tsx`
- Modify: `app/src/renderer/src/components/AgentRoster.tsx`
- Modify: `app/src/renderer/src/components/ActivityTimeline.tsx`
- Modify: `app/src/renderer/src/styles.css`

- [ ] Update one-click tasks into varied command tiles with risk and agent metadata.
- [ ] Restyle mission creation with label-above-input fields and helper copy.
- [ ] Restyle tasks as an intelligent stack with status chips and assignee metadata.
- [ ] Restyle approvals as an urgent dynamic-island style queue with approve/reject actions.
- [ ] Restyle agents and activity as compact live-status rails with empty states.

### Task 4: Secondary Data Views

**Files:**
- Modify: `app/src/renderer/src/components/AgentsView.tsx`
- Modify: `app/src/renderer/src/components/TasksView.tsx`
- Modify: `app/src/renderer/src/components/CostUsageView.tsx`
- Modify: `app/src/renderer/src/components/SettingsView.tsx`
- Modify: `app/src/renderer/src/styles.css`

- [ ] Wrap secondary views in the same redesigned page header and panel system.
- [ ] Keep table content unchanged but improve table chrome, scrolling, typography, and empty states.
- [ ] Preserve all existing visible data and identifiers used by tests.

### Task 5: Verification

**Files:**
- Test: `app/src/renderer/src/App.test.tsx`
- Test: `app/src/renderer/src/components/OneClickLaunchers.test.tsx`

- [ ] Run `.\tools\npm.cmd test` from `app`.
- [ ] Run `.\tools\npm.cmd run typecheck` from `app`.
- [ ] Run `.\tools\npm.cmd run build` from `app`.
- [ ] Launch `.\tools\npm.cmd run dev` from `app` and confirm Electron starts with the renderer.
