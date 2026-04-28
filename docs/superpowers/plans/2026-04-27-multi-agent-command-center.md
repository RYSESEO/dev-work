# Multi-Agent Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-first Electron desktop command center that can create software-building missions, launch local approval-gated agent runs, track tasks, usage, estimated cost, approvals, logs, and artifacts.

**Architecture:** The app is an Electron desktop shell with a React renderer and a local Node orchestration layer. V1 uses a pluggable runner interface with a configurable command runner and a demo NDJSON-speaking agent process, backed by SQLite via `sql.js` and per-run log files.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Testing Library, `sql.js`, Node child processes, CSS modules or plain CSS, lucide-react icons.

---

## Scope Check

This plan builds one vertical v1 slice across the desktop shell, data model, runner protocol, approvals, and dashboard. The first runner is a configurable local command runner plus a bundled demo agent script that exercises approvals and logs. Codex-specific and OpenAI API runners use the same runner interface after v1.

## File Structure

Create the app under `app/` so the existing design docs remain at the repository root.

- `app/package.json`: scripts and dependencies.
- `app/electron.vite.config.ts`: Electron/Vite build config.
- `app/vitest.config.ts`: Vitest config for shared, main-process, and renderer tests.
- `app/tsconfig.json`: TypeScript project references.
- `app/tsconfig.node.json`: TypeScript settings for Electron main, preload, scripts, and tests.
- `app/tsconfig.web.json`: TypeScript settings for React renderer.
- `app/src/main/index.ts`: Electron main process bootstrap.
- `app/src/main/ipc.ts`: typed IPC handlers exposed to the renderer.
- `app/src/main/db/appStore.ts`: SQLite persistence wrapper using `sql.js`.
- `app/src/main/services/orchestrator.ts`: mission, task, run, approval, event, and usage coordination.
- `app/src/main/services/approvalPolicy.ts`: session-scoped approval grant matching.
- `app/src/main/runners/types.ts`: runner interfaces.
- `app/src/main/runners/commandRunner.ts`: configurable local command runner.
- `app/src/preload/index.ts`: safe renderer bridge.
- `app/src/shared/domain.ts`: domain types used by main and renderer.
- `app/src/shared/oneClickTasks.ts`: built-in one-click task templates.
- `app/src/shared/runnerProtocol.ts`: NDJSON runner protocol message types.
- `app/src/renderer/index.html`: renderer HTML entry.
- `app/src/renderer/src/main.tsx`: React entry.
- `app/src/renderer/src/App.tsx`: tab shell and app layout.
- `app/src/renderer/src/testSetup.ts`: renderer test setup.
- `app/src/renderer/src/api/client.ts`: typed client around the preload bridge.
- `app/src/renderer/src/components/*.tsx`: dashboard components.
- `app/src/renderer/src/styles.css`: visual system and layout.
- `app/scripts/demo-agent.mjs`: local demo agent process that emits logs, usage, approval requests, and completion events.
- `app/tests/**/*.test.ts`: main-process and shared unit tests.
- `app/tests/**/*.test.tsx`: renderer unit tests.

## Task 1: Scaffold Electron React Workspace

**Files:**
- Create: `app/package.json`
- Create: `app/electron.vite.config.ts`
- Create: `app/vitest.config.ts`
- Create: `app/tsconfig.json`
- Create: `app/tsconfig.node.json`
- Create: `app/tsconfig.web.json`
- Create: `app/src/main/index.ts`
- Create: `app/src/preload/index.ts`
- Create: `app/src/renderer/index.html`
- Create: `app/src/renderer/src/main.tsx`
- Create: `app/src/renderer/src/App.tsx`
- Create: `app/src/renderer/src/testSetup.ts`
- Create: `app/src/renderer/src/styles.css`

- [ ] **Step 1: Install the desktop app toolchain**

Run from `app/` after creating the directory:

```powershell
npm init -y
npm install react react-dom sql.js lucide-react
npm install -D electron electron-vite vite typescript vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @types/node @types/react @types/react-dom
```

Expected: `package.json` and `package-lock.json` exist, and npm reports installed packages without audit-blocking errors.

- [ ] **Step 2: Replace `app/package.json` scripts and metadata**

Use this structure, keeping the dependency versions npm installed:

```json
{
  "name": "multi-agent-command-center",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "tsc -b && electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "lucide-react": "*",
    "react": "*",
    "react-dom": "*",
    "sql.js": "*"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "*",
    "@testing-library/react": "*",
    "@types/node": "*",
    "@types/react": "*",
    "@types/react-dom": "*",
    "@vitejs/plugin-react": "*",
    "electron": "*",
    "electron-vite": "*",
    "jsdom": "*",
    "typescript": "*",
    "vite": "*",
    "vitest": "*"
  }
}
```

- [ ] **Step 3: Add Electron Vite config**

Create `app/electron.vite.config.ts`:

```ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: 'src/main/index.ts'
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: 'src/preload/index.ts'
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: 'src/renderer/index.html'
      }
    }
  }
});
```

Create `app/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/renderer/src/testSetup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
```

- [ ] **Step 4: Add TypeScript project configs**

Create `app/tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

Create `app/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"],
    "outDir": "out-tsc/node"
  },
  "include": ["src/main/**/*.ts", "src/preload/**/*.ts", "src/shared/**/*.ts", "tests/**/*.ts"]
}
```

Create `app/tsconfig.web.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals"],
    "outDir": "out-tsc/web"
  },
  "include": ["src/renderer/src/**/*.ts", "src/renderer/src/**/*.tsx", "src/shared/**/*.ts"]
}
```

- [ ] **Step 5: Add minimal Electron and React shell**

Create `app/src/main/index.ts`:

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'Multi-Agent Command Center',
    backgroundColor: '#101317',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

Create `app/src/preload/index.ts`:

```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('commandCenter', {
  version: '0.1.0'
});
```

Create `app/src/renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Multi-Agent Command Center</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `app/src/renderer/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `app/src/renderer/src/App.tsx`:

```tsx
export function App(): JSX.Element {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Windows desktop command center</p>
        <h1>Multi-Agent Command Center</h1>
        <p>Coordinate software-building missions, agent runs, approvals, usage, and cost from one local dashboard.</p>
      </section>
    </main>
  );
}
```

Create `app/src/renderer/src/testSetup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `app/src/renderer/src/styles.css`:

```css
:root {
  color: #e8ecef;
  background: #101317;
  font-family: "Segoe UI", system-ui, sans-serif;
}

body {
  margin: 0;
  min-width: 1180px;
  background: #101317;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
  box-sizing: border-box;
}

.hero-panel {
  border: 1px solid #29313a;
  border-radius: 8px;
  padding: 28px;
  background: #171b21;
}

.eyebrow {
  color: #8cb4ff;
  margin: 0 0 8px;
  font-size: 13px;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: 34px;
  font-weight: 650;
}

p {
  color: #aab4bf;
  line-height: 1.5;
}
```

- [ ] **Step 6: Verify the shell**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: both commands complete successfully. Then run:

```powershell
npm run dev
```

Expected: Electron opens a Windows desktop window with the command center title panel.

- [ ] **Step 7: Commit**

```powershell
git add app/package.json app/package-lock.json app/electron.vite.config.ts app/vitest.config.ts app/tsconfig.json app/tsconfig.node.json app/tsconfig.web.json app/src
git commit -m "chore: scaffold electron command center"
```

## Task 2: Define Shared Domain And One-Click Templates

**Files:**
- Create: `app/src/shared/domain.ts`
- Create: `app/src/shared/oneClickTasks.ts`
- Create: `app/tests/shared/domain.test.ts`
- Create: `app/tests/shared/oneClickTasks.test.ts`

- [ ] **Step 1: Write domain tests**

Create `app/tests/shared/domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createId, isTerminalRunStatus } from '../../src/shared/domain';

describe('domain helpers', () => {
  it('creates ids with the requested prefix', () => {
    expect(createId('run')).toMatch(/^run_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('detects terminal run states', () => {
    expect(isTerminalRunStatus('completed')).toBe(true);
    expect(isTerminalRunStatus('failed')).toBe(true);
    expect(isTerminalRunStatus('stopped')).toBe(true);
    expect(isTerminalRunStatus('running')).toBe(false);
    expect(isTerminalRunStatus('paused_for_approval')).toBe(false);
  });
});
```

Create `app/tests/shared/oneClickTasks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { oneClickTasks } from '../../src/shared/oneClickTasks';

describe('oneClickTasks', () => {
  it('ships with software-building launchers', () => {
    const ids = oneClickTasks.map((task) => task.id);
    expect(ids).toEqual([
      'review-repo',
      'plan-feature',
      'fix-failing-tests',
      'implementation-plan',
      'summarize-changes',
      'code-review',
      'draft-pr-notes'
    ]);
  });

  it('declares risk, prompt, and expected approval scopes for each launcher', () => {
    for (const task of oneClickTasks) {
      expect(task.title.length).toBeGreaterThan(4);
      expect(task.promptTemplate).toContain('{{workspacePath}}');
      expect(['low', 'medium', 'high']).toContain(task.riskLevel);
      expect(task.expectedScopes.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/shared/domain.test.ts tests/shared/oneClickTasks.test.ts
```

Expected: FAIL because `src/shared/domain.ts` and `src/shared/oneClickTasks.ts` do not exist.

- [ ] **Step 3: Add shared domain types**

Create `app/src/shared/domain.ts`:

```ts
export type IdPrefix =
  | 'mission'
  | 'task'
  | 'agent'
  | 'run'
  | 'event'
  | 'approval'
  | 'grant'
  | 'artifact'
  | 'runner';

export type MissionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type TaskStatus = 'draft' | 'queued' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type RunStatus = 'queued' | 'running' | 'paused_for_approval' | 'completed' | 'failed' | 'stopped';
export type AgentStatus = 'idle' | 'running' | 'blocked' | 'offline';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Mission {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  missionId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'normal' | 'high';
  assigneeAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  runnerProfileId: string;
  status: AgentStatus;
  successCount: number;
  failureCount: number;
}

export interface RunnerProfile {
  id: string;
  name: string;
  type: 'command';
  command: string;
  args: string[];
  workspacePath: string;
  env: Record<string, string>;
  costPerThousandTokensUsd: number;
}

export interface Run {
  id: string;
  taskId: string;
  agentProfileId: string;
  runnerProfileId: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  estimatedCostUsd: number;
  estimatedTokens: number;
}

export type ApprovalScope =
  | { kind: 'read_workspace' }
  | { kind: 'edit_files'; paths: string[] }
  | { kind: 'edit_folder'; path: string }
  | { kind: 'command_exact'; command: string }
  | { kind: 'command_category'; category: 'test' | 'lint' | 'build' | 'git-read' }
  | { kind: 'install_dependencies' }
  | { kind: 'network' }
  | { kind: 'git_commit' }
  | { kind: 'git_push' };

export interface ApprovalRequest {
  id: string;
  runId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  scope: ApprovalScope;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
}

export interface ApprovalGrant {
  id: string;
  runId: string;
  requestId: string;
  scope: ApprovalScope;
  duration: 'session';
  createdAt: string;
}

export interface UsageEvent {
  id: string;
  runId: string;
  at: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
  commandCount: number;
  outputBytes: number;
}

export interface SignificantEvent {
  id: string;
  runId: string | null;
  missionId: string | null;
  taskId: string | null;
  at: string;
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body: string;
}

export interface Artifact {
  id: string;
  runId: string;
  title: string;
  path: string;
  kind: 'log' | 'summary' | 'file' | 'report';
  createdAt: string;
}

export interface DashboardSnapshot {
  missions: Mission[];
  tasks: Task[];
  agents: AgentProfile[];
  runnerProfiles: RunnerProfile[];
  runs: Run[];
  approvals: ApprovalRequest[];
  grants: ApprovalGrant[];
  usage: UsageEvent[];
  events: SignificantEvent[];
  artifacts: Artifact[];
}

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}
```

- [ ] **Step 4: Add one-click task templates**

Create `app/src/shared/oneClickTasks.ts`:

```ts
import type { ApprovalScope, RiskLevel } from './domain';

export interface OneClickTaskTemplate {
  id: string;
  title: string;
  description: string;
  recommendedAgentRole: string;
  riskLevel: RiskLevel;
  expectedScopes: ApprovalScope[];
  promptTemplate: string;
}

export const oneClickTasks: OneClickTaskTemplate[] = [
  {
    id: 'review-repo',
    title: 'Review this repo',
    description: 'Inspect the workspace and produce prioritized findings.',
    recommendedAgentRole: 'Reviewer',
    riskLevel: 'low',
    expectedScopes: [{ kind: 'read_workspace' }],
    promptTemplate: 'Review the repository at {{workspacePath}}. Focus on bugs, regressions, missing tests, and risky architecture. Return prioritized findings.'
  },
  {
    id: 'plan-feature',
    title: 'Plan a feature',
    description: 'Turn a feature request into a buildable task plan.',
    recommendedAgentRole: 'Planner',
    riskLevel: 'low',
    expectedScopes: [{ kind: 'read_workspace' }],
    promptTemplate: 'Read the workspace at {{workspacePath}} and create an implementation plan for this feature: {{userInput}}.'
  },
  {
    id: 'fix-failing-tests',
    title: 'Fix failing tests',
    description: 'Run the test suite, diagnose failures, and propose or apply approved fixes.',
    recommendedAgentRole: 'Builder',
    riskLevel: 'high',
    expectedScopes: [{ kind: 'command_category', category: 'test' }, { kind: 'edit_folder', path: '{{workspacePath}}' }],
    promptTemplate: 'In {{workspacePath}}, find failing tests, request permission before commands or edits, and fix the smallest safe set of issues.'
  },
  {
    id: 'implementation-plan',
    title: 'Generate implementation plan',
    description: 'Create a step-by-step plan from the current mission goal.',
    recommendedAgentRole: 'Planner',
    riskLevel: 'low',
    expectedScopes: [{ kind: 'read_workspace' }],
    promptTemplate: 'Use the mission context and workspace at {{workspacePath}} to write a task-by-task implementation plan.'
  },
  {
    id: 'summarize-changes',
    title: 'Summarize changes',
    description: 'Summarize current workspace changes for handoff.',
    recommendedAgentRole: 'Reporter',
    riskLevel: 'medium',
    expectedScopes: [{ kind: 'command_category', category: 'git-read' }],
    promptTemplate: 'Summarize current changes in {{workspacePath}} using git status and diff. Do not commit.'
  },
  {
    id: 'code-review',
    title: 'Run code review',
    description: 'Review the active changes and produce actionable findings.',
    recommendedAgentRole: 'Reviewer',
    riskLevel: 'medium',
    expectedScopes: [{ kind: 'read_workspace' }, { kind: 'command_category', category: 'git-read' }],
    promptTemplate: 'Review the current changes in {{workspacePath}}. Lead with findings, include file references, and mention test gaps.'
  },
  {
    id: 'draft-pr-notes',
    title: 'Draft PR notes',
    description: 'Draft a concise change summary and verification notes.',
    recommendedAgentRole: 'Reporter',
    riskLevel: 'medium',
    expectedScopes: [{ kind: 'command_category', category: 'git-read' }],
    promptTemplate: 'Draft PR notes for the current changes in {{workspacePath}}. Include summary, tests, and risks.'
  }
];
```

- [ ] **Step 5: Verify tests pass**

Run:

```powershell
npm test -- tests/shared/domain.test.ts tests/shared/oneClickTasks.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/src/shared app/tests/shared
git commit -m "feat: define command center domain"
```

## Task 3: Add SQLite Persistence

**Files:**
- Create: `app/src/main/db/appStore.ts`
- Create: `app/tests/main/appStore.test.ts`

- [ ] **Step 1: Write store tests**

Create `app/tests/main/appStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore';
import type { Mission } from '../../src/shared/domain';

describe('appStore', () => {
  it('persists and reads records by collection', async () => {
    const store = await createAppStore(':memory:');
    const mission: Mission = {
      id: 'mission_test',
      title: 'Build command center',
      goal: 'Coordinate agents',
      status: 'active',
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z'
    };

    store.put('missions', mission.id, mission);

    expect(store.getAll<Mission>('missions')).toEqual([mission]);
    expect(store.getById<Mission>('missions', mission.id)).toEqual(mission);
  });

  it('updates existing records without duplicating ids', async () => {
    const store = await createAppStore(':memory:');

    store.put('missions', 'mission_test', { id: 'mission_test', title: 'First' });
    store.put('missions', 'mission_test', { id: 'mission_test', title: 'Second' });

    expect(store.getAll<{ id: string; title: string }>('missions')).toEqual([{ id: 'mission_test', title: 'Second' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/main/appStore.test.ts
```

Expected: FAIL because `appStore.ts` does not exist.

- [ ] **Step 3: Implement SQL.js store**

Create `app/src/main/db/appStore.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

export type StoreCollection =
  | 'missions'
  | 'tasks'
  | 'agents'
  | 'runnerProfiles'
  | 'runs'
  | 'approvals'
  | 'grants'
  | 'usage'
  | 'events'
  | 'artifacts';

export interface AppStore {
  put<T extends { id: string }>(collection: StoreCollection, id: string, value: T): void;
  getById<T>(collection: StoreCollection, id: string): T | null;
  getAll<T>(collection: StoreCollection): T[];
  remove(collection: StoreCollection, id: string): void;
  exportToDisk(): void;
}

const collections: StoreCollection[] = [
  'missions',
  'tasks',
  'agents',
  'runnerProfiles',
  'runs',
  'approvals',
  'grants',
  'usage',
  'events',
  'artifacts'
];

export async function createAppStore(databasePath: string): Promise<AppStore> {
  const SQL = await initSqlJs();
  const isMemory = databasePath === ':memory:';
  const existing = !isMemory && fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : undefined;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);

  function persist(): void {
    if (isMemory) return;
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.writeFileSync(databasePath, Buffer.from(db.export()));
  }

  return {
    put<T extends { id: string }>(collection: StoreCollection, id: string, value: T): void {
      assertCollection(collection);
      db.run(
        `INSERT INTO records (collection, id, json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(collection, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
        [collection, id, JSON.stringify(value), new Date().toISOString()]
      );
      persist();
    },
    getById<T>(collection: StoreCollection, id: string): T | null {
      assertCollection(collection);
      const stmt = db.prepare('SELECT json FROM records WHERE collection = ? AND id = ?');
      stmt.bind([collection, id]);
      const value = stmt.step() ? (JSON.parse(stmt.getAsObject().json as string) as T) : null;
      stmt.free();
      return value;
    },
    getAll<T>(collection: StoreCollection): T[] {
      assertCollection(collection);
      const stmt = db.prepare('SELECT json FROM records WHERE collection = ? ORDER BY updated_at ASC');
      stmt.bind([collection]);
      const values: T[] = [];
      while (stmt.step()) values.push(JSON.parse(stmt.getAsObject().json as string) as T);
      stmt.free();
      return values;
    },
    remove(collection: StoreCollection, id: string): void {
      assertCollection(collection);
      db.run('DELETE FROM records WHERE collection = ? AND id = ?', [collection, id]);
      persist();
    },
    exportToDisk(): void {
      persist();
    }
  };
}

function assertCollection(collection: StoreCollection): void {
  if (!collections.includes(collection)) {
    throw new Error(`Unknown store collection: ${collection}`);
  }
}
```

- [ ] **Step 4: Verify persistence tests pass**

Run:

```powershell
npm test -- tests/main/appStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/src/main/db app/tests/main/appStore.test.ts
git commit -m "feat: add local sqlite persistence"
```

## Task 4: Implement Session-Scoped Approval Policy

**Files:**
- Create: `app/src/main/services/approvalPolicy.ts`
- Create: `app/tests/main/approvalPolicy.test.ts`

- [ ] **Step 1: Write approval matching tests**

Create `app/tests/main/approvalPolicy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { grantMatchesRequest } from '../../src/main/services/approvalPolicy';
import type { ApprovalGrant, ApprovalRequest } from '../../src/shared/domain';

const baseRequest: ApprovalRequest = {
  id: 'approval_request',
  runId: 'run_1',
  title: 'Run tests',
  description: 'Run npm test',
  riskLevel: 'medium',
  scope: { kind: 'command_category', category: 'test' },
  status: 'pending',
  createdAt: '2026-04-27T00:00:00.000Z',
  resolvedAt: null
};

const baseGrant: ApprovalGrant = {
  id: 'grant_1',
  runId: 'run_1',
  requestId: 'approval_request',
  scope: { kind: 'command_category', category: 'test' },
  duration: 'session',
  createdAt: '2026-04-27T00:00:01.000Z'
};

describe('approvalPolicy', () => {
  it('matches same run and same command category', () => {
    expect(grantMatchesRequest(baseGrant, baseRequest)).toBe(true);
  });

  it('does not match a different run', () => {
    expect(grantMatchesRequest({ ...baseGrant, runId: 'run_2' }, baseRequest)).toBe(false);
  });

  it('matches exact command only when command text is identical', () => {
    const grant: ApprovalGrant = { ...baseGrant, scope: { kind: 'command_exact', command: 'npm test' } };
    const request: ApprovalRequest = { ...baseRequest, scope: { kind: 'command_exact', command: 'npm test' } };
    const other: ApprovalRequest = { ...baseRequest, scope: { kind: 'command_exact', command: 'npm run build' } };

    expect(grantMatchesRequest(grant, request)).toBe(true);
    expect(grantMatchesRequest(grant, other)).toBe(false);
  });

  it('matches folder grants for child paths', () => {
    const grant: ApprovalGrant = { ...baseGrant, scope: { kind: 'edit_folder', path: 'C:/repo/src' } };
    const request: ApprovalRequest = { ...baseRequest, scope: { kind: 'edit_files', paths: ['C:/repo/src/App.tsx'] } };

    expect(grantMatchesRequest(grant, request)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/main/approvalPolicy.test.ts
```

Expected: FAIL because `approvalPolicy.ts` does not exist.

- [ ] **Step 3: Implement grant matching**

Create `app/src/main/services/approvalPolicy.ts`:

```ts
import path from 'node:path';
import type { ApprovalGrant, ApprovalRequest, ApprovalScope } from '../../shared/domain';

export function grantMatchesRequest(grant: ApprovalGrant, request: ApprovalRequest): boolean {
  if (grant.runId !== request.runId) return false;
  return scopeIncludes(grant.scope, request.scope);
}

export function findMatchingGrant(grants: ApprovalGrant[], request: ApprovalRequest): ApprovalGrant | null {
  return grants.find((grant) => grantMatchesRequest(grant, request)) ?? null;
}

function scopeIncludes(grant: ApprovalScope, request: ApprovalScope): boolean {
  if (grant.kind === request.kind) {
    if (grant.kind === 'read_workspace') return true;
    if (grant.kind === 'install_dependencies') return true;
    if (grant.kind === 'network') return true;
    if (grant.kind === 'git_commit') return true;
    if (grant.kind === 'git_push') return true;
    if (grant.kind === 'command_exact' && request.kind === 'command_exact') return grant.command === request.command;
    if (grant.kind === 'command_category' && request.kind === 'command_category') return grant.category === request.category;
    if (grant.kind === 'edit_folder' && request.kind === 'edit_folder') return sameOrInside(request.path, grant.path);
    if (grant.kind === 'edit_files' && request.kind === 'edit_files') {
      return request.paths.every((requestedPath) => grant.paths.includes(requestedPath));
    }
  }

  if (grant.kind === 'edit_folder' && request.kind === 'edit_files') {
    return request.paths.every((requestedPath) => sameOrInside(requestedPath, grant.path));
  }

  return false;
}

function sameOrInside(childPath: string, parentPath: string): boolean {
  const normalizedChild = path.resolve(childPath).toLowerCase();
  const normalizedParent = path.resolve(parentPath).toLowerCase();
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${path.sep}`);
}
```

- [ ] **Step 4: Verify approval tests pass**

Run:

```powershell
npm test -- tests/main/approvalPolicy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/src/main/services/approvalPolicy.ts app/tests/main/approvalPolicy.test.ts
git commit -m "feat: add session scoped approval policy"
```

## Task 5: Define Runner Protocol And Command Runner

**Files:**
- Create: `app/src/shared/runnerProtocol.ts`
- Create: `app/src/main/runners/types.ts`
- Create: `app/src/main/runners/commandRunner.ts`
- Create: `app/scripts/demo-agent.mjs`
- Create: `app/tests/main/commandRunner.test.ts`

- [ ] **Step 1: Write command runner test**

Create `app/tests/main/commandRunner.test.ts`:

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CommandRunner } from '../../src/main/runners/commandRunner';

describe('CommandRunner', () => {
  it('streams demo agent events and pauses for approval', async () => {
    const runner = new CommandRunner();
    const scriptPath = path.resolve('scripts/demo-agent.mjs');
    const events: string[] = [];

    const handle = await runner.start({
      runId: 'run_demo',
      prompt: 'Review workspace',
      profile: {
        id: 'runner_demo',
        name: 'Demo Agent',
        type: 'command',
        command: process.execPath,
        args: [scriptPath],
        workspacePath: process.cwd(),
        env: {},
        costPerThousandTokensUsd: 0.01
      },
      onMessage(message) {
        events.push(message.type);
        if (message.type === 'approval_request') {
          handle.send({ type: 'approval_result', requestId: message.requestId, approved: true, grantId: 'grant_demo' });
        }
      }
    });

    const result = await handle.done;

    expect(result.exitCode).toBe(0);
    expect(events).toContain('log');
    expect(events).toContain('approval_request');
    expect(events).toContain('usage');
    expect(events).toContain('complete');
  }, 10000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/main/commandRunner.test.ts
```

Expected: FAIL because runner files and the demo script do not exist.

- [ ] **Step 3: Add runner protocol types**

Create `app/src/shared/runnerProtocol.ts`:

```ts
import type { ApprovalScope, RiskLevel } from './domain';

export type RunnerToHostMessage =
  | { type: 'log'; level: 'info' | 'warning' | 'error'; message: string }
  | { type: 'usage'; estimatedTokens: number; commandCount: number; outputBytes: number }
  | {
      type: 'approval_request';
      requestId: string;
      title: string;
      description: string;
      riskLevel: RiskLevel;
      scope: ApprovalScope;
    }
  | { type: 'artifact'; title: string; path: string; kind: 'log' | 'summary' | 'file' | 'report' }
  | { type: 'complete'; summary: string }
  | { type: 'failed'; message: string };

export type HostToRunnerMessage =
  | { type: 'approval_result'; requestId: string; approved: true; grantId: string }
  | { type: 'approval_result'; requestId: string; approved: false; reason: string }
  | { type: 'stop'; reason: string };
```

Create `app/src/main/runners/types.ts`:

```ts
import type { RunnerProfile } from '../../shared/domain';
import type { HostToRunnerMessage, RunnerToHostMessage } from '../../shared/runnerProtocol';

export interface RunnerStartRequest {
  runId: string;
  prompt: string;
  profile: RunnerProfile;
  onMessage(message: RunnerToHostMessage): void;
}

export interface RunnerResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export interface RunnerHandle {
  done: Promise<RunnerResult>;
  send(message: HostToRunnerMessage): void;
  stop(reason: string): void;
}

export interface Runner {
  start(request: RunnerStartRequest): Promise<RunnerHandle>;
}
```

- [ ] **Step 4: Implement command runner**

Create `app/src/main/runners/commandRunner.ts`:

```ts
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import type { HostToRunnerMessage, RunnerToHostMessage } from '../../shared/runnerProtocol';
import type { Runner, RunnerHandle, RunnerResult, RunnerStartRequest } from './types';

export class CommandRunner implements Runner {
  async start(request: RunnerStartRequest): Promise<RunnerHandle> {
    const child = spawn(request.profile.command, request.profile.args, {
      cwd: request.profile.workspacePath,
      env: {
        ...process.env,
        ...request.profile.env,
        COMMAND_CENTER_RUN_ID: request.runId,
        COMMAND_CENTER_PROMPT: request.prompt,
        COMMAND_CENTER_WORKSPACE: request.profile.workspacePath
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stdout = readline.createInterface({ input: child.stdout });
    stdout.on('line', (line) => {
      const parsed = parseRunnerLine(line);
      if (parsed) request.onMessage(parsed);
      if (!parsed && line.trim()) request.onMessage({ type: 'log', level: 'info', message: line });
    });

    const stderr = readline.createInterface({ input: child.stderr });
    stderr.on('line', (line) => {
      request.onMessage({ type: 'log', level: 'error', message: line });
    });

    const done = new Promise<RunnerResult>((resolve) => {
      child.on('exit', (exitCode, signal) => resolve({ exitCode, signal }));
    });

    return {
      done,
      send(message: HostToRunnerMessage): void {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      },
      stop(reason: string): void {
        child.stdin.write(`${JSON.stringify({ type: 'stop', reason } satisfies HostToRunnerMessage)}\n`);
        child.kill();
      }
    };
  }
}

function parseRunnerLine(line: string): RunnerToHostMessage | null {
  try {
    const parsed = JSON.parse(line) as RunnerToHostMessage;
    if (typeof parsed.type === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Add demo agent script**

Create `app/scripts/demo-agent.mjs`:

```js
import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
const waiters = new Map();

input.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.type === 'approval_result') {
    const resolve = waiters.get(message.requestId);
    if (resolve) {
      waiters.delete(message.requestId);
      resolve(message);
    }
  }
  if (message.type === 'stop') {
    emit({ type: 'failed', message: `Stopped: ${message.reason}` });
    process.exit(1);
  }
});

function emit(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForApproval(requestId) {
  return new Promise((resolve) => waiters.set(requestId, resolve));
}

emit({ type: 'log', level: 'info', message: `Starting demo agent for ${process.env.COMMAND_CENTER_RUN_ID}` });
await delay(100);
emit({ type: 'usage', estimatedTokens: 420, commandCount: 0, outputBytes: 1200 });
await delay(100);

const requestId = 'approval_demo_test_command';
emit({
  type: 'approval_request',
  requestId,
  title: 'Run test command',
  description: 'Demo agent wants permission to run the test command category for this session.',
  riskLevel: 'medium',
  scope: { kind: 'command_category', category: 'test' }
});

const approval = await waitForApproval(requestId);
if (!approval.approved) {
  emit({ type: 'failed', message: 'Approval rejected by user.' });
  process.exit(1);
}

emit({ type: 'log', level: 'info', message: `Approval granted: ${approval.grantId}` });
await delay(100);
emit({ type: 'usage', estimatedTokens: 900, commandCount: 1, outputBytes: 2400 });
emit({ type: 'artifact', title: 'Demo Run Summary', path: 'artifacts/demo-summary.md', kind: 'summary' });
emit({ type: 'complete', summary: 'Demo agent completed after receiving a session-scoped approval grant.' });
```

- [ ] **Step 6: Verify command runner test passes**

Run:

```powershell
npm test -- tests/main/commandRunner.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/src/shared/runnerProtocol.ts app/src/main/runners app/scripts/demo-agent.mjs app/tests/main/commandRunner.test.ts
git commit -m "feat: add command runner protocol"
```

## Task 6: Build Orchestration Service

**Files:**
- Create: `app/src/main/services/orchestrator.ts`
- Create: `app/tests/main/orchestrator.test.ts`

- [ ] **Step 1: Write orchestration tests**

Create `app/tests/main/orchestrator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore';
import { createOrchestrator } from '../../src/main/services/orchestrator';

describe('orchestrator', () => {
  it('creates a mission with default agents and runner profiles', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const mission = orchestrator.createMission('Build dashboard', 'Create a command center UI.');
    const snapshot = orchestrator.getSnapshot();

    expect(mission.status).toBe('active');
    expect(snapshot.missions).toHaveLength(1);
    expect(snapshot.agents.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.runnerProfiles.length).toBeGreaterThanOrEqual(1);
  });

  it('creates standalone one-click tasks', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const task = orchestrator.createTask(null, 'Review this repo', 'Review the current workspace.', 'high');

    expect(task.missionId).toBeNull();
    expect(task.status).toBe('queued');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/main/orchestrator.test.ts
```

Expected: FAIL because `orchestrator.ts` does not exist.

- [ ] **Step 3: Implement orchestration service core**

Create `app/src/main/services/orchestrator.ts`:

```ts
import path from 'node:path';
import type { AppStore } from '../db/appStore';
import { createId, nowIso, type AgentProfile, type DashboardSnapshot, type Mission, type RunnerProfile, type Task } from '../../shared/domain';

export interface Orchestrator {
  getSnapshot(): DashboardSnapshot;
  createMission(title: string, goal: string): Mission;
  createTask(missionId: string | null, title: string, description: string, priority?: Task['priority']): Task;
}

export async function createOrchestrator(store: AppStore): Promise<Orchestrator> {
  seedDefaults(store);

  return {
    getSnapshot(): DashboardSnapshot {
      return {
        missions: store.getAll('missions'),
        tasks: store.getAll('tasks'),
        agents: store.getAll('agents'),
        runnerProfiles: store.getAll('runnerProfiles'),
        runs: store.getAll('runs'),
        approvals: store.getAll('approvals'),
        grants: store.getAll('grants'),
        usage: store.getAll('usage'),
        events: store.getAll('events'),
        artifacts: store.getAll('artifacts')
      };
    },
    createMission(title: string, goal: string): Mission {
      const at = nowIso();
      const mission: Mission = {
        id: createId('mission'),
        title,
        goal,
        status: 'active',
        createdAt: at,
        updatedAt: at
      };
      store.put('missions', mission.id, mission);
      return mission;
    },
    createTask(missionId: string | null, title: string, description: string, priority: Task['priority'] = 'normal'): Task {
      const at = nowIso();
      const task: Task = {
        id: createId('task'),
        missionId,
        title,
        description,
        status: 'queued',
        priority,
        assigneeAgentId: null,
        createdAt: at,
        updatedAt: at
      };
      store.put('tasks', task.id, task);
      return task;
    }
  };
}

function seedDefaults(store: AppStore): void {
  if (store.getAll<RunnerProfile>('runnerProfiles').length === 0) {
    const runner: RunnerProfile = {
      id: 'runner_demo_command',
      name: 'Demo Local Agent',
      type: 'command',
      command: process.execPath,
      args: [path.resolve('scripts/demo-agent.mjs')],
      workspacePath: process.cwd(),
      env: {},
      costPerThousandTokensUsd: 0.01
    };
    store.put('runnerProfiles', runner.id, runner);
  }

  if (store.getAll<AgentProfile>('agents').length === 0) {
    const agents: AgentProfile[] = [
      { id: 'agent_planner', name: 'Planner', role: 'Planner', runnerProfileId: 'runner_demo_command', status: 'idle', successCount: 0, failureCount: 0 },
      { id: 'agent_builder', name: 'Builder', role: 'Builder', runnerProfileId: 'runner_demo_command', status: 'idle', successCount: 0, failureCount: 0 },
      { id: 'agent_reviewer', name: 'Reviewer', role: 'Reviewer', runnerProfileId: 'runner_demo_command', status: 'idle', successCount: 0, failureCount: 0 }
    ];
    for (const agent of agents) store.put('agents', agent.id, agent);
  }
}
```

- [ ] **Step 4: Verify orchestration tests pass**

Run:

```powershell
npm test -- tests/main/orchestrator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/src/main/services/orchestrator.ts app/tests/main/orchestrator.test.ts
git commit -m "feat: add mission orchestration core"
```

## Task 7: Add Run Launch, Approval, Usage, And Event Handling

**Files:**
- Modify: `app/src/main/services/orchestrator.ts`
- Create: `app/tests/main/orchestratorRuns.test.ts`

- [ ] **Step 1: Write run lifecycle test**

Create `app/tests/main/orchestratorRuns.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore';
import { createOrchestrator } from '../../src/main/services/orchestrator';

describe('orchestrator run lifecycle', () => {
  it('launches a demo run and creates a pending approval', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);
    const task = orchestrator.createTask(null, 'Demo task', 'Exercise runner.');

    const run = await orchestrator.launchRun(task.id, 'agent_builder', 'Demo prompt');
    await orchestrator.waitForRunEvent(run.id, 'approval_request', 5000);

    const snapshot = orchestrator.getSnapshot();
    expect(snapshot.runs.find((item) => item.id === run.id)?.status).toBe('paused_for_approval');
    expect(snapshot.approvals.find((item) => item.runId === run.id)?.status).toBe('pending');
  }, 10000);

  it('approves once and records a session grant', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);
    const task = orchestrator.createTask(null, 'Demo task', 'Exercise runner.');

    const run = await orchestrator.launchRun(task.id, 'agent_builder', 'Demo prompt');
    await orchestrator.waitForRunEvent(run.id, 'approval_request', 5000);
    const approval = orchestrator.getSnapshot().approvals[0];

    orchestrator.approveRequest(approval.id);
    await orchestrator.waitForRunEvent(run.id, 'complete', 5000);

    const snapshot = orchestrator.getSnapshot();
    expect(snapshot.grants).toHaveLength(1);
    expect(snapshot.runs.find((item) => item.id === run.id)?.status).toBe('completed');
    expect(snapshot.usage.reduce((sum, item) => sum + item.estimatedTokens, 0)).toBeGreaterThan(0);
  }, 10000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/main/orchestratorRuns.test.ts
```

Expected: FAIL because the orchestrator does not expose run lifecycle methods.

- [ ] **Step 3: Extend orchestrator interface**

Modify the `Orchestrator` interface in `app/src/main/services/orchestrator.ts`:

```ts
export interface Orchestrator {
  getSnapshot(): DashboardSnapshot;
  createMission(title: string, goal: string): Mission;
  createTask(missionId: string | null, title: string, description: string, priority?: Task['priority']): Task;
  launchRun(taskId: string, agentProfileId: string, prompt: string): Promise<Run>;
  approveRequest(approvalRequestId: string): void;
  rejectRequest(approvalRequestId: string, reason: string): void;
  waitForRunEvent(runId: string, eventType: string, timeoutMs: number): Promise<void>;
}
```

Add imports:

```ts
import { CommandRunner } from '../runners/commandRunner';
import type { RunnerHandle } from '../runners/types';
import type { RunnerToHostMessage } from '../../shared/runnerProtocol';
import { findMatchingGrant } from './approvalPolicy';
import {
  createId,
  nowIso,
  type AgentProfile,
  type ApprovalGrant,
  type ApprovalRequest,
  type Artifact,
  type DashboardSnapshot,
  type Mission,
  type Run,
  type RunnerProfile,
  type SignificantEvent,
  type Task,
  type UsageEvent
} from '../../shared/domain';
```

- [ ] **Step 4: Add run state helpers inside `createOrchestrator`**

Add before the returned object:

```ts
const runner = new CommandRunner();
const handles = new Map<string, RunnerHandle>();
const waiters = new Map<string, Array<{ type: string; resolve: () => void; timer: NodeJS.Timeout }>>();

function emitWaiter(runId: string, type: string): void {
  const runWaiters = waiters.get(runId) ?? [];
  const remaining = runWaiters.filter((waiter) => {
    if (waiter.type === type) {
      clearTimeout(waiter.timer);
      waiter.resolve();
      return false;
    }
    return true;
  });
  waiters.set(runId, remaining);
}

function addEvent(runId: string | null, taskId: string | null, title: string, body: string, level: SignificantEvent['level'] = 'info'): void {
  const task = taskId ? store.getById<Task>('tasks', taskId) : null;
  const event: SignificantEvent = {
    id: createId('event'),
    runId,
    taskId,
    missionId: task?.missionId ?? null,
    at: nowIso(),
    title,
    body,
    level
  };
  store.put('events', event.id, event);
}
```

- [ ] **Step 5: Add run lifecycle methods to the returned object**

Add these methods inside the object returned by `createOrchestrator`:

```ts
async launchRun(taskId: string, agentProfileId: string, prompt: string): Promise<Run> {
  const task = store.getById<Task>('tasks', taskId);
  const agent = store.getById<AgentProfile>('agents', agentProfileId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!agent) throw new Error(`Agent not found: ${agentProfileId}`);

  const profile = store.getById<RunnerProfile>('runnerProfiles', agent.runnerProfileId);
  if (!profile) throw new Error(`Runner profile not found: ${agent.runnerProfileId}`);

  const at = nowIso();
  const run: Run = {
    id: createId('run'),
    taskId,
    agentProfileId,
    runnerProfileId: profile.id,
    status: 'running',
    startedAt: at,
    completedAt: null,
    estimatedCostUsd: 0,
    estimatedTokens: 0
  };

  store.put('runs', run.id, run);
  store.put('tasks', task.id, { ...task, status: 'running', assigneeAgentId: agent.id, updatedAt: at });
  store.put('agents', agent.id, { ...agent, status: 'running' });
  addEvent(run.id, task.id, 'Run started', `${agent.name} started ${task.title}.`);

  const handle = await runner.start({
    runId: run.id,
    prompt,
    profile,
    onMessage: (message) => handleRunnerMessage(run.id, message)
  });

  handles.set(run.id, handle);
  void handle.done.then((result) => {
    const current = store.getById<Run>('runs', run.id);
    const currentTask = store.getById<Task>('tasks', task.id);
    const currentAgent = store.getById<AgentProfile>('agents', agent.id);
    if (!current || current.status === 'completed' || current.status === 'failed' || current.status === 'stopped') return;
    const failed = result.exitCode !== 0;
    store.put('runs', current.id, { ...current, status: failed ? 'failed' : 'completed', completedAt: nowIso() });
    if (currentTask) store.put('tasks', currentTask.id, { ...currentTask, status: failed ? 'failed' : 'completed', updatedAt: nowIso() });
    if (currentAgent) store.put('agents', currentAgent.id, { ...currentAgent, status: 'idle', successCount: currentAgent.successCount + (failed ? 0 : 1), failureCount: currentAgent.failureCount + (failed ? 1 : 0) });
    emitWaiter(run.id, failed ? 'failed' : 'complete');
  });

  return run;
},
approveRequest(approvalRequestId: string): void {
  const approval = store.getById<ApprovalRequest>('approvals', approvalRequestId);
  if (!approval) throw new Error(`Approval not found: ${approvalRequestId}`);

  const grant: ApprovalGrant = {
    id: createId('grant'),
    runId: approval.runId,
    requestId: approval.id,
    scope: approval.scope,
    duration: 'session',
    createdAt: nowIso()
  };
  store.put('grants', grant.id, grant);
  store.put('approvals', approval.id, { ...approval, status: 'approved', resolvedAt: nowIso() });

  const run = store.getById<Run>('runs', approval.runId);
  if (run) store.put('runs', run.id, { ...run, status: 'running' });

  handles.get(approval.runId)?.send({ type: 'approval_result', requestId: approval.id, approved: true, grantId: grant.id });
  addEvent(approval.runId, run?.taskId ?? null, 'Approval granted', approval.title, 'success');
},
rejectRequest(approvalRequestId: string, reason: string): void {
  const approval = store.getById<ApprovalRequest>('approvals', approvalRequestId);
  if (!approval) throw new Error(`Approval not found: ${approvalRequestId}`);
  store.put('approvals', approval.id, { ...approval, status: 'rejected', resolvedAt: nowIso() });
  handles.get(approval.runId)?.send({ type: 'approval_result', requestId: approval.id, approved: false, reason });
  addEvent(approval.runId, null, 'Approval rejected', reason, 'warning');
},
waitForRunEvent(runId: string, eventType: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventType}`)), timeoutMs);
    const runWaiters = waiters.get(runId) ?? [];
    runWaiters.push({ type: eventType, resolve, timer });
    waiters.set(runId, runWaiters);
  });
}
```

- [ ] **Step 6: Add message handling helpers**

Add this helper inside `createOrchestrator`, directly below `addEvent`, so it can access `store`, `handles`, and `emitWaiter`:

```ts
function handleRunnerMessage(runId: string, message: RunnerToHostMessage): void {
  const run = store.getById<Run>('runs', runId);
  if (!run) return;

  if (message.type === 'approval_request') {
    const request: ApprovalRequest = {
      id: message.requestId,
      runId,
      title: message.title,
      description: message.description,
      riskLevel: message.riskLevel,
      scope: message.scope,
      status: 'pending',
      createdAt: nowIso(),
      resolvedAt: null
    };
    const grant = findMatchingGrant(store.getAll('grants'), request);
    if (grant) {
      handles.get(runId)?.send({ type: 'approval_result', requestId: request.id, approved: true, grantId: grant.id });
      addEvent(runId, run.taskId, 'Approval grant reused', request.title, 'info');
      return;
    }
    store.put('approvals', request.id, request);
    store.put('runs', run.id, { ...run, status: 'paused_for_approval' });
    addEvent(runId, run.taskId, 'Approval requested', request.title, 'warning');
    emitWaiter(runId, 'approval_request');
    return;
  }

  if (message.type === 'usage') {
    const estimatedCostUsd = (message.estimatedTokens / 1000) * (store.getById<RunnerProfile>('runnerProfiles', run.runnerProfileId)?.costPerThousandTokensUsd ?? 0);
    const usage: UsageEvent = {
      id: createId('event'),
      runId,
      at: nowIso(),
      estimatedTokens: message.estimatedTokens,
      estimatedCostUsd,
      commandCount: message.commandCount,
      outputBytes: message.outputBytes
    };
    store.put('usage', usage.id, usage);
    store.put('runs', run.id, { ...run, estimatedTokens: run.estimatedTokens + message.estimatedTokens, estimatedCostUsd: run.estimatedCostUsd + estimatedCostUsd });
    return;
  }

  if (message.type === 'artifact') {
    const artifact: Artifact = {
      id: createId('artifact'),
      runId,
      title: message.title,
      path: message.path,
      kind: message.kind,
      createdAt: nowIso()
    };
    store.put('artifacts', artifact.id, artifact);
    return;
  }

  if (message.type === 'log') {
    addEvent(runId, run.taskId, message.message, message.level, message.level === 'error' ? 'error' : 'info');
    return;
  }

  if (message.type === 'complete') {
    store.put('runs', run.id, { ...run, status: 'completed', completedAt: nowIso() });
    const task = store.getById<Task>('tasks', run.taskId);
    if (task) store.put('tasks', task.id, { ...task, status: 'completed', updatedAt: nowIso() });
    addEvent(runId, run.taskId, 'Run completed', message.summary, 'success');
    emitWaiter(runId, 'complete');
    return;
  }

  if (message.type === 'failed') {
    store.put('runs', run.id, { ...run, status: 'failed', completedAt: nowIso() });
    const task = store.getById<Task>('tasks', run.taskId);
    if (task) store.put('tasks', task.id, { ...task, status: 'failed', updatedAt: nowIso() });
    addEvent(runId, run.taskId, 'Run failed', message.message, 'error');
    emitWaiter(runId, 'failed');
  }
}
```

- [ ] **Step 7: Verify run lifecycle tests pass**

Run:

```powershell
npm test -- tests/main/orchestratorRuns.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add app/src/main/services/orchestrator.ts app/tests/main/orchestratorRuns.test.ts
git commit -m "feat: orchestrate approval gated runs"
```

## Task 8: Expose Typed IPC And Preload API

**Files:**
- Create: `app/src/main/ipc.ts`
- Modify: `app/src/main/index.ts`
- Modify: `app/src/preload/index.ts`
- Create: `app/src/renderer/src/api/client.ts`
- Create: `app/src/renderer/src/global.d.ts`

- [ ] **Step 1: Add IPC registration**

Create `app/src/main/ipc.ts`:

```ts
import { app, ipcMain } from 'electron';
import path from 'node:path';
import { createAppStore } from './db/appStore';
import { createOrchestrator, type Orchestrator } from './services/orchestrator';

let orchestratorPromise: Promise<Orchestrator> | null = null;

function getOrchestrator(): Promise<Orchestrator> {
  orchestratorPromise ??= createAppStore(path.join(app.getPath('userData'), 'command-center.sqlite')).then(createOrchestrator);
  return orchestratorPromise;
}

export function registerIpcHandlers(): void {
  ipcMain.handle('dashboard:getSnapshot', async () => (await getOrchestrator()).getSnapshot());
  ipcMain.handle('mission:create', async (_event, title: string, goal: string) => (await getOrchestrator()).createMission(title, goal));
  ipcMain.handle('task:create', async (_event, missionId: string | null, title: string, description: string, priority?: 'low' | 'normal' | 'high') =>
    (await getOrchestrator()).createTask(missionId, title, description, priority)
  );
  ipcMain.handle('run:launch', async (_event, taskId: string, agentProfileId: string, prompt: string) =>
    (await getOrchestrator()).launchRun(taskId, agentProfileId, prompt)
  );
  ipcMain.handle('approval:approve', async (_event, approvalRequestId: string) => (await getOrchestrator()).approveRequest(approvalRequestId));
  ipcMain.handle('approval:reject', async (_event, approvalRequestId: string, reason: string) =>
    (await getOrchestrator()).rejectRequest(approvalRequestId, reason)
  );
}
```

- [ ] **Step 2: Register IPC during app boot**

Modify `app/src/main/index.ts`:

```ts
import { registerIpcHandlers } from './ipc';
```

Call before `createWindow()`:

```ts
registerIpcHandlers();
createWindow();
```

- [ ] **Step 3: Expose preload bridge**

Replace `app/src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { DashboardSnapshot } from '../shared/domain';

const commandCenter = {
  getSnapshot: (): Promise<DashboardSnapshot> => ipcRenderer.invoke('dashboard:getSnapshot'),
  createMission: (title: string, goal: string) => ipcRenderer.invoke('mission:create', title, goal),
  createTask: (missionId: string | null, title: string, description: string, priority?: 'low' | 'normal' | 'high') =>
    ipcRenderer.invoke('task:create', missionId, title, description, priority),
  launchRun: (taskId: string, agentProfileId: string, prompt: string) => ipcRenderer.invoke('run:launch', taskId, agentProfileId, prompt),
  approveRequest: (approvalRequestId: string) => ipcRenderer.invoke('approval:approve', approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string) => ipcRenderer.invoke('approval:reject', approvalRequestId, reason)
};

contextBridge.exposeInMainWorld('commandCenter', commandCenter);

export type CommandCenterApi = typeof commandCenter;
```

- [ ] **Step 4: Add renderer global type and client**

Create `app/src/renderer/src/global.d.ts`:

```ts
import type { CommandCenterApi } from '../../preload';

declare global {
  interface Window {
    commandCenter: CommandCenterApi;
  }
}
```

Create `app/src/renderer/src/api/client.ts`:

```ts
export const commandCenterClient = {
  getSnapshot: () => window.commandCenter.getSnapshot(),
  createMission: (title: string, goal: string) => window.commandCenter.createMission(title, goal),
  createTask: (missionId: string | null, title: string, description: string, priority?: 'low' | 'normal' | 'high') =>
    window.commandCenter.createTask(missionId, title, description, priority),
  launchRun: (taskId: string, agentProfileId: string, prompt: string) => window.commandCenter.launchRun(taskId, agentProfileId, prompt),
  approveRequest: (approvalRequestId: string) => window.commandCenter.approveRequest(approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string) => window.commandCenter.rejectRequest(approvalRequestId, reason)
};
```

- [ ] **Step 5: Verify typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/src/main/ipc.ts app/src/main/index.ts app/src/preload/index.ts app/src/renderer/src/api app/src/renderer/src/global.d.ts
git commit -m "feat: expose command center ipc"
```

## Task 9: Build Mission Control Dashboard

**Files:**
- Modify: `app/src/renderer/src/App.tsx`
- Create: `app/src/renderer/src/components/MissionControl.tsx`
- Create: `app/src/renderer/src/components/MetricStrip.tsx`
- Create: `app/src/renderer/src/components/TaskBoard.tsx`
- Create: `app/src/renderer/src/components/AgentRoster.tsx`
- Create: `app/src/renderer/src/components/ApprovalQueue.tsx`
- Create: `app/src/renderer/src/components/ActivityTimeline.tsx`
- Modify: `app/src/renderer/src/styles.css`
- Create: `app/src/renderer/src/App.test.tsx`

- [ ] **Step 1: Write dashboard smoke test**

Create `app/src/renderer/src/App.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { DashboardSnapshot } from '../../shared/domain';

const snapshot: DashboardSnapshot = {
  missions: [{ id: 'mission_1', title: 'Build command center', goal: 'Coordinate agents', status: 'active', createdAt: '', updatedAt: '' }],
  tasks: [{ id: 'task_1', missionId: 'mission_1', title: 'Create dashboard', description: 'Build UI', status: 'running', priority: 'high', assigneeAgentId: 'agent_builder', createdAt: '', updatedAt: '' }],
  agents: [{ id: 'agent_builder', name: 'Builder', role: 'Builder', runnerProfileId: 'runner_demo_command', status: 'running', successCount: 0, failureCount: 0 }],
  runnerProfiles: [],
  runs: [{ id: 'run_1', taskId: 'task_1', agentProfileId: 'agent_builder', runnerProfileId: 'runner_demo_command', status: 'paused_for_approval', startedAt: '', completedAt: null, estimatedCostUsd: 0.012, estimatedTokens: 1200 }],
  approvals: [{ id: 'approval_1', runId: 'run_1', title: 'Run tests', description: 'Run npm test', riskLevel: 'medium', scope: { kind: 'command_category', category: 'test' }, status: 'pending', createdAt: '', resolvedAt: null }],
  grants: [],
  usage: [],
  events: [{ id: 'event_1', runId: 'run_1', missionId: 'mission_1', taskId: 'task_1', at: '', level: 'warning', title: 'Approval requested', body: 'Run tests' }],
  artifacts: []
};

beforeEach(() => {
  window.commandCenter = {
    getSnapshot: vi.fn(async () => snapshot),
    createMission: vi.fn(),
    createTask: vi.fn(),
    launchRun: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn()
  };
});

describe('App', () => {
  it('renders mission control data', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText('Build command center')).toBeInTheDocument());
    expect(screen.getByText('Create dashboard')).toBeInTheDocument();
    expect(screen.getByText('Builder')).toBeInTheDocument();
    expect(screen.getByText('Run tests')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/renderer/src/App.test.tsx
```

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Replace `App.tsx` with data-loading shell**

Use this implementation:

```tsx
import { useEffect, useState } from 'react';
import { MissionControl } from './components/MissionControl';
import { commandCenterClient } from './api/client';
import type { DashboardSnapshot } from '../../shared/domain';

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      setSnapshot(await commandCenterClient.getSnapshot());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.');
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (error) return <main className="app-shell"><section className="notice error">{error}</section></main>;
  if (!snapshot) return <main className="app-shell"><section className="notice">Loading command center...</section></main>;

  return <MissionControl snapshot={snapshot} onRefresh={refresh} />;
}
```

- [ ] **Step 4: Add dashboard components**

Create `MissionControl.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';
import { AgentRoster } from './AgentRoster';
import { ApprovalQueue } from './ApprovalQueue';
import { ActivityTimeline } from './ActivityTimeline';
import { MetricStrip } from './MetricStrip';
import { TaskBoard } from './TaskBoard';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function MissionControl({ snapshot, onRefresh }: Props): JSX.Element {
  const mission = snapshot.missions[0];

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Mission Control</p>
          <h1>{mission?.title ?? 'No active mission'}</h1>
          <p>{mission?.goal ?? 'Create a mission to begin coordinating agents.'}</p>
        </div>
        <button className="primary-button" onClick={() => void onRefresh()}>Refresh</button>
      </header>
      <MetricStrip snapshot={snapshot} />
      <section className="dashboard-grid">
        <TaskBoard snapshot={snapshot} />
        <ApprovalQueue snapshot={snapshot} onRefresh={onRefresh} />
        <AgentRoster snapshot={snapshot} />
        <ActivityTimeline snapshot={snapshot} />
      </section>
    </main>
  );
}
```

Create `MetricStrip.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function MetricStrip({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const activeRuns = snapshot.runs.filter((run) => run.status === 'running' || run.status === 'paused_for_approval').length;
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === 'pending').length;
  const estimatedCost = snapshot.runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0);
  const estimatedTokens = snapshot.runs.reduce((sum, run) => sum + run.estimatedTokens, 0);

  return (
    <section className="metric-strip">
      <Metric label="Active runs" value={activeRuns.toString()} />
      <Metric label="Pending approvals" value={pendingApprovals.toString()} />
      <Metric label="Estimated tokens" value={estimatedTokens.toLocaleString()} />
      <Metric label="Estimated cost" value={`$${estimatedCost.toFixed(4)}`} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}
```

Create `app/src/renderer/src/components/TaskBoard.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function TaskBoard({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent]));

  return (
    <section className="panel">
      <h2>Tasks</h2>
      <ul className="item-list">
        {snapshot.tasks.map((task) => (
          <li className="item" key={task.id}>
            <strong>{task.title}</strong>
            <p>{task.description}</p>
            <div className="item-meta">
              {task.status} · {task.priority} · {task.assigneeAgentId ? agentsById.get(task.assigneeAgentId)?.name ?? 'Assigned' : 'Unassigned'}
            </div>
          </li>
        ))}
        {snapshot.tasks.length === 0 && <li className="item item-meta">No tasks yet.</li>}
      </ul>
    </section>
  );
}
```

Create `app/src/renderer/src/components/AgentRoster.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function AgentRoster({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const activeRunByAgent = new Map(snapshot.runs.map((run) => [run.agentProfileId, run]));

  return (
    <section className="panel">
      <h2>Agents</h2>
      <ul className="item-list">
        {snapshot.agents.map((agent) => {
          const run = activeRunByAgent.get(agent.id);
          return (
            <li className="item" key={agent.id}>
              <strong>{agent.name}</strong>
              <p>{agent.role}</p>
              <div className="item-meta">
                {agent.status} · {run ? run.status : 'no active run'} · success {agent.successCount} · failed {agent.failureCount}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

Create `app/src/renderer/src/components/ApprovalQueue.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function ApprovalQueue({ snapshot, onRefresh }: Props): JSX.Element {
  const pending = snapshot.approvals.filter((approval) => approval.status === 'pending');

  async function approve(id: string): Promise<void> {
    await commandCenterClient.approveRequest(id);
    await onRefresh();
  }

  async function reject(id: string): Promise<void> {
    await commandCenterClient.rejectRequest(id, 'Rejected from dashboard');
    await onRefresh();
  }

  return (
    <section className="panel">
      <h2>Approvals</h2>
      <ul className="item-list">
        {pending.map((approval) => (
          <li className="item" key={approval.id}>
            <strong>{approval.title}</strong>
            <p>{approval.description}</p>
            <div className="item-meta">{approval.riskLevel} risk · {approval.scope.kind}</div>
            <div className="button-row">
              <button className="primary-button" onClick={() => void approve(approval.id)}>Approve Session</button>
              <button className="danger-button" onClick={() => void reject(approval.id)}>Reject</button>
            </div>
          </li>
        ))}
        {pending.length === 0 && <li className="item item-meta">No approvals waiting.</li>}
      </ul>
    </section>
  );
}
```

Create `app/src/renderer/src/components/ActivityTimeline.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function ActivityTimeline({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const events = [...snapshot.events].slice(-8).reverse();

  return (
    <section className="panel">
      <h2>Significant events</h2>
      <ul className="item-list">
        {events.map((event) => (
          <li className="item" key={event.id}>
            <strong>{event.title}</strong>
            <p>{event.body}</p>
            <div className="item-meta">{event.level} · {event.at || 'just now'}</div>
          </li>
        ))}
        {events.length === 0 && <li className="item item-meta">No events yet.</li>}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Add dashboard styles**

Append to `app/src/renderer/src/styles.css`:

```css
.top-bar {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.primary-button,
.secondary-button,
.danger-button {
  border: 1px solid #3a4652;
  border-radius: 6px;
  color: #e8ecef;
  background: #1f6feb;
  padding: 9px 12px;
  font: inherit;
  cursor: pointer;
}

.secondary-button {
  background: #20262d;
}

.danger-button {
  background: #7f1d1d;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.metric,
.panel {
  border: 1px solid #29313a;
  border-radius: 8px;
  background: #171b21;
  padding: 16px;
}

.metric span,
.item-meta {
  color: #8f9aa6;
  font-size: 12px;
}

.metric strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}

.item-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  border: 1px solid #29313a;
  border-radius: 6px;
  padding: 12px;
  background: #101317;
}

.button-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.notice {
  border: 1px solid #29313a;
  border-radius: 8px;
  padding: 16px;
  background: #171b21;
}

.notice.error {
  border-color: #7f1d1d;
}
```

- [ ] **Step 6: Verify renderer test passes**

Run:

```powershell
npm test -- src/renderer/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add app/src/renderer/src
git commit -m "feat: build mission control dashboard"
```

## Task 10: Add Mission, One-Click Task, And Run Launch Controls

**Files:**
- Modify: `app/src/renderer/src/components/MissionControl.tsx`
- Create: `app/src/renderer/src/components/MissionCreator.tsx`
- Create: `app/src/renderer/src/components/OneClickLaunchers.tsx`
- Modify: `app/src/renderer/src/styles.css`
- Create: `app/src/renderer/src/components/OneClickLaunchers.test.tsx`

- [ ] **Step 1: Write one-click launcher test**

Create `app/src/renderer/src/components/OneClickLaunchers.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OneClickLaunchers } from './OneClickLaunchers';
import type { DashboardSnapshot } from '../../../shared/domain';

const snapshot: DashboardSnapshot = {
  missions: [{ id: 'mission_1', title: 'Mission', goal: 'Goal', status: 'active', createdAt: '', updatedAt: '' }],
  tasks: [],
  agents: [{ id: 'agent_builder', name: 'Builder', role: 'Builder', runnerProfileId: 'runner_demo_command', status: 'idle', successCount: 0, failureCount: 0 }],
  runnerProfiles: [],
  runs: [],
  approvals: [],
  grants: [],
  usage: [],
  events: [],
  artifacts: []
};

beforeEach(() => {
  window.commandCenter = {
    getSnapshot: vi.fn(),
    createMission: vi.fn(),
    createTask: vi.fn(async () => ({ id: 'task_created' })),
    launchRun: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn()
  };
});

describe('OneClickLaunchers', () => {
  it('creates a task and launches a run', async () => {
    render(<OneClickLaunchers snapshot={snapshot} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByText('Review this repo'));

    await waitFor(() => expect(window.commandCenter.createTask).toHaveBeenCalled());
    expect(window.commandCenter.launchRun).toHaveBeenCalledWith('task_created', 'agent_builder', expect.stringContaining('Review the repository'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/renderer/src/components/OneClickLaunchers.test.tsx
```

Expected: FAIL because `OneClickLaunchers.tsx` does not exist.

- [ ] **Step 3: Add mission creator**

Create `app/src/renderer/src/components/MissionCreator.tsx`:

```tsx
import { useState } from 'react';
import { commandCenterClient } from '../api/client';

export function MissionCreator({ onRefresh }: { onRefresh(): Promise<void> }): JSX.Element {
  const [title, setTitle] = useState('Build a software feature');
  const [goal, setGoal] = useState('Coordinate agents to plan, implement, verify, and summarize the work.');

  async function submit(): Promise<void> {
    await commandCenterClient.createMission(title, goal);
    await onRefresh();
  }

  return (
    <section className="panel">
      <h2>Create mission</h2>
      <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Goal<textarea value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
      <button className="primary-button" onClick={() => void submit()}>Create Mission</button>
    </section>
  );
}
```

- [ ] **Step 4: Add one-click launchers**

Create `app/src/renderer/src/components/OneClickLaunchers.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';
import { oneClickTasks } from '../../../shared/oneClickTasks';
import { commandCenterClient } from '../api/client';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function OneClickLaunchers({ snapshot, onRefresh }: Props): JSX.Element {
  const missionId = snapshot.missions[0]?.id ?? null;

  async function launch(templateId: string): Promise<void> {
    const template = oneClickTasks.find((item) => item.id === templateId);
    if (!template) return;
    const agent = snapshot.agents.find((item) => item.role === template.recommendedAgentRole) ?? snapshot.agents[0];
    if (!agent) return;
    const workspacePath = snapshot.runnerProfiles[0]?.workspacePath ?? '';
    const prompt = template.promptTemplate.replaceAll('{{workspacePath}}', workspacePath).replaceAll('{{userInput}}', snapshot.missions[0]?.goal ?? '');
    const task = await commandCenterClient.createTask(missionId, template.title, template.description, template.riskLevel === 'high' ? 'high' : 'normal');
    await commandCenterClient.launchRun(task.id, agent.id, prompt);
    await onRefresh();
  }

  return (
    <section className="panel">
      <h2>One-click tasks</h2>
      <div className="launcher-grid">
        {oneClickTasks.map((template) => (
          <button key={template.id} className="launcher-button" onClick={() => void launch(template.id)}>
            <strong>{template.title}</strong>
            <span>{template.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Insert controls into Mission Control**

Modify `MissionControl.tsx` imports:

```tsx
import { MissionCreator } from './MissionCreator';
import { OneClickLaunchers } from './OneClickLaunchers';
```

Insert above the dashboard grid:

```tsx
{snapshot.missions.length === 0 ? <MissionCreator onRefresh={onRefresh} /> : <OneClickLaunchers snapshot={snapshot} onRefresh={onRefresh} />}
```

- [ ] **Step 6: Add form and launcher styles**

Append:

```css
label {
  display: grid;
  gap: 6px;
  color: #8f9aa6;
  font-size: 13px;
  margin-bottom: 12px;
}

input,
textarea {
  border: 1px solid #3a4652;
  border-radius: 6px;
  background: #101317;
  color: #e8ecef;
  padding: 10px;
  font: inherit;
}

textarea {
  min-height: 86px;
  resize: vertical;
}

.launcher-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.launcher-button {
  min-height: 96px;
  border: 1px solid #29313a;
  border-radius: 8px;
  background: #101317;
  color: #e8ecef;
  text-align: left;
  padding: 12px;
  cursor: pointer;
}

.launcher-button span {
  display: block;
  margin-top: 6px;
  color: #8f9aa6;
  font-size: 12px;
  line-height: 1.35;
}
```

- [ ] **Step 7: Verify tests pass**

Run:

```powershell
npm test -- src/renderer/src/components/OneClickLaunchers.test.tsx src/renderer/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add app/src/renderer/src/components app/src/renderer/src/styles.css
git commit -m "feat: add mission and one click launch controls"
```

## Task 11: Add Agents, Tasks, Settings, And Cost Detail Views

**Files:**
- Modify: `app/src/renderer/src/App.tsx`
- Create: `app/src/renderer/src/components/TabNav.tsx`
- Create: `app/src/renderer/src/components/AgentsView.tsx`
- Create: `app/src/renderer/src/components/TasksView.tsx`
- Create: `app/src/renderer/src/components/SettingsView.tsx`
- Create: `app/src/renderer/src/components/CostUsageView.tsx`
- Modify: `app/src/renderer/src/styles.css`

- [ ] **Step 1: Add tab navigation component**

Create `app/src/renderer/src/components/TabNav.tsx`:

```tsx
export type AppTab = 'mission' | 'agents' | 'tasks' | 'usage' | 'settings';

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: 'mission', label: 'Mission Control' },
  { id: 'agents', label: 'Agents' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'usage', label: 'Usage' },
  { id: 'settings', label: 'Settings' }
];

export function TabNav({ active, onChange }: { active: AppTab; onChange(tab: AppTab): void }): JSX.Element {
  return (
    <nav className="tab-nav">
      {tabs.map((tab) => (
        <button key={tab.id} className={tab.id === active ? 'tab active' : 'tab'} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add detail views**

Create `app/src/renderer/src/components/AgentsView.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function AgentsView({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const runsByAgent = new Map(snapshot.runs.map((run) => [run.agentProfileId, run]));

  return (
    <main className="app-shell">
      <section className="panel">
        <h1>Agents</h1>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Status</th><th>Current run</th><th>Success</th><th>Failed</th></tr>
          </thead>
          <tbody>
            {snapshot.agents.map((agent) => {
              const run = runsByAgent.get(agent.id);
              return (
                <tr key={agent.id}>
                  <td>{agent.name}</td>
                  <td>{agent.role}</td>
                  <td>{agent.status}</td>
                  <td>{run ? `${run.id} · ${run.status}` : 'Idle'}</td>
                  <td>{agent.successCount}</td>
                  <td>{agent.failureCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

Create `app/src/renderer/src/components/TasksView.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function TasksView({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent.name]));

  return (
    <main className="app-shell">
      <section className="panel">
        <h1>Tasks</h1>
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Description</th></tr>
          </thead>
          <tbody>
            {snapshot.tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.status}</td>
                <td>{task.priority}</td>
                <td>{task.assigneeAgentId ? agentsById.get(task.assigneeAgentId) ?? task.assigneeAgentId : 'Unassigned'}</td>
                <td>{task.description}</td>
              </tr>
            ))}
            {snapshot.tasks.length === 0 && <tr><td colSpan={5}>No tasks yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

Create `app/src/renderer/src/components/CostUsageView.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function CostUsageView({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  const agentsById = new Map(snapshot.agents.map((agent) => [agent.id, agent]));
  const rows = snapshot.agents.map((agent) => {
    const runs = snapshot.runs.filter((run) => run.agentProfileId === agent.id);
    return {
      agent,
      runCount: runs.length,
      estimatedTokens: runs.reduce((sum, run) => sum + run.estimatedTokens, 0),
      estimatedCostUsd: runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0),
      approvals: snapshot.approvals.filter((approval) => runs.some((run) => run.id === approval.runId)).length
    };
  });
  const totalCost = rows.reduce((sum, row) => sum + row.estimatedCostUsd, 0);
  const totalTokens = rows.reduce((sum, row) => sum + row.estimatedTokens, 0);

  return (
    <main className="app-shell">
      <section className="metric-strip">
        <article className="metric"><span>Total estimated tokens</span><strong>{totalTokens.toLocaleString()}</strong></article>
        <article className="metric"><span>Total estimated cost</span><strong>${totalCost.toFixed(4)}</strong></article>
      </section>
      <section className="panel">
        <h1>Usage by agent</h1>
        <table className="data-table">
          <thead>
            <tr><th>Agent</th><th>Role</th><th>Runs</th><th>Tokens</th><th>Cost</th><th>Approvals</th></tr>
          </thead>
          <tbody>
            {rows.map(({ agent, runCount, estimatedTokens, estimatedCostUsd, approvals }) => (
              <tr key={agent.id}>
                <td>{agentsById.get(agent.id)?.name ?? agent.name}</td>
                <td>{agent.role}</td>
                <td>{runCount}</td>
                <td>{estimatedTokens.toLocaleString()}</td>
                <td>${estimatedCostUsd.toFixed(4)}</td>
                <td>{approvals}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}>No usage recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

Create `app/src/renderer/src/components/SettingsView.tsx`:

```tsx
import type { DashboardSnapshot } from '../../../shared/domain';

export function SettingsView({ snapshot }: { snapshot: DashboardSnapshot }): JSX.Element {
  return (
    <main className="app-shell">
      <section className="panel">
        <h1>Runner settings</h1>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Command</th><th>Args</th><th>Workspace</th><th>Cost rate</th></tr>
          </thead>
          <tbody>
            {snapshot.runnerProfiles.map((profile) => (
              <tr key={profile.id}>
                <td>{profile.name}</td>
                <td>{profile.command}</td>
                <td>{profile.args.join(' ')}</td>
                <td>{profile.workspacePath}</td>
                <td>${profile.costPerThousandTokensUsd.toFixed(4)} / 1K tokens</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Wire tabs in `App.tsx`**

Add:

```tsx
import { useEffect, useState } from 'react';
import { AgentsView } from './components/AgentsView';
import { CostUsageView } from './components/CostUsageView';
import { MissionControl } from './components/MissionControl';
import { SettingsView } from './components/SettingsView';
import { TabNav, type AppTab } from './components/TabNav';
import { TasksView } from './components/TasksView';
```

Inside `App`, add:

```tsx
const [activeTab, setActiveTab] = useState<AppTab>('mission');
```

Replace the final return with:

```tsx
return (
  <>
    <TabNav active={activeTab} onChange={setActiveTab} />
    {activeTab === 'mission' && <MissionControl snapshot={snapshot} onRefresh={refresh} />}
    {activeTab === 'agents' && <AgentsView snapshot={snapshot} />}
    {activeTab === 'tasks' && <TasksView snapshot={snapshot} />}
    {activeTab === 'usage' && <CostUsageView snapshot={snapshot} />}
    {activeTab === 'settings' && <SettingsView snapshot={snapshot} />}
  </>
);
```

- [ ] **Step 4: Add tab and table styles**

Append:

```css
.tab-nav {
  display: flex;
  gap: 8px;
  padding: 16px 32px 0;
  background: #101317;
}

.tab {
  border: 1px solid #29313a;
  border-radius: 6px;
  background: #171b21;
  color: #aab4bf;
  padding: 9px 12px;
  cursor: pointer;
}

.tab.active {
  color: #e8ecef;
  border-color: #4f7cff;
  background: #1d2635;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid #29313a;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

.data-table th {
  color: #8f9aa6;
  font-weight: 600;
  font-size: 12px;
}
```

- [ ] **Step 5: Verify build and tests**

Run:

```powershell
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/src/renderer/src
git commit -m "feat: add detail views"
```

## Task 12: Final Verification And V1 Hardening

**Files:**
- Modify: `app/src/main/services/orchestrator.ts`
- Modify: `app/src/renderer/src/styles.css`
- Create: `app/docs/manual-verification.md`

- [ ] **Step 1: Add manual verification checklist**

Create `app/docs/manual-verification.md`:

```md
# Manual Verification

Run from `app/`:

```powershell
npm run dev
```

Verify:

- The desktop app opens on Windows.
- Creating a mission updates Mission Control.
- Clicking "Review this repo" creates a task and starts a run.
- The run pauses on an approval card.
- Approving the request resumes the run.
- The run completes and records a session-scoped grant.
- Metrics show active runs, pending approvals, estimated tokens, and estimated cost.
- Agents view shows status and cost detail.
- Tasks view shows task state.
- Usage view rolls up cost per agent.
- Settings view shows the demo runner profile.
```

- [ ] **Step 2: Add log persistence for run events**

In `orchestrator.ts`, write every significant event body to a per-run log file under `app.getPath('userData')/logs/<runId>.log` when running inside Electron. In tests, keep log writing disabled by checking `process.env.VITEST`.

Use this helper:

```ts
function appendRunLog(runId: string | null, line: string): void {
  if (!runId || process.env.VITEST) return;
  const logDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(path.join(logDir, `${runId}.log`), `${new Date().toISOString()} ${line}\n`);
}
```

Call `appendRunLog(runId, `${title}: ${body}`)` inside `addEvent`.

- [ ] **Step 3: Polish dense desktop layout**

Review `styles.css` for text overflow at the minimum window width. Add these rules:

```css
* {
  box-sizing: border-box;
}

h1,
h2,
h3,
p,
td,
th,
button,
span {
  overflow-wrap: anywhere;
}

button {
  min-width: 0;
}
```

- [ ] **Step 4: Run full verification commands**

Run:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 5: Start the app and verify manually**

Run:

```powershell
npm run dev
```

Expected: desktop app opens and passes every item in `app/docs/manual-verification.md`.

- [ ] **Step 6: Commit**

```powershell
git add app app/docs/manual-verification.md
git commit -m "chore: verify command center v1"
```

## Self-Review Notes

- Spec coverage: missions, tasks, one-click launchers, pluggable command runner, approval-gated sessions, session-scoped grants, usage, cost, significant events, SQLite persistence, logs, and Windows desktop UI are covered.
- Scope: the plan builds a working v1 with a demo local runner and keeps Codex/API runners behind the shared runner interface.
- Type consistency: domain names, run statuses, approval scopes, and dashboard snapshot fields are reused across tests, main process, preload, and renderer.
- Risk: the demo runner proves the approval protocol. A real external agent must speak the same NDJSON protocol or be wrapped by a runner adapter.
