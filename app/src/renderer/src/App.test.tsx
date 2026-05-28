import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { DashboardSnapshot } from '../../shared/domain';

const snapshot: DashboardSnapshot = {
  missions: [
    {
      id: 'mission_1',
      title: 'Build command center',
      goal: 'Coordinate agents',
      status: 'active',
      createdAt: '',
      updatedAt: ''
    }
  ],
  tasks: [
    {
      id: 'task_1',
      missionId: 'mission_1',
      title: 'Create dashboard',
      description: 'Build UI',
      status: 'running',
      priority: 'high',
      assigneeAgentId: 'agent_builder',
      createdAt: '',
      updatedAt: ''
    }
  ],
  agents: [
    {
      id: 'agent_builder',
      name: 'Builder',
      role: 'Builder',
      runnerProfileId: 'runner_demo_command',
      status: 'running',
      successCount: 0,
      failureCount: 0
    }
  ],
  runnerProfiles: [],
  runs: [
    {
      id: 'run_1',
      taskId: 'task_1',
      agentProfileId: 'agent_builder',
      runnerProfileId: 'runner_demo_command',
      status: 'paused_for_approval',
      startedAt: '',
      completedAt: null,
      estimatedCostUsd: 0.012,
      estimatedTokens: 1200
    }
  ],
  approvals: [
    {
      id: 'approval_1',
      runId: 'run_1',
      title: 'Run tests',
      description: 'Run npm test',
      riskLevel: 'medium',
      scope: { kind: 'command_category', category: 'test' },
      status: 'pending',
      createdAt: '',
      resolvedAt: null
    }
  ],
  grants: [],
  usage: [],
  events: [
    {
      id: 'event_1',
      runId: 'run_1',
      missionId: 'mission_1',
      taskId: 'task_1',
      at: '',
      level: 'warning',
      title: 'Approval requested',
      body: 'Run tests'
    }
  ],
  artifacts: [],
  marketplace: [],
  plugins: [],
  users: [],
  workflows: [],
  workflowRuns: [],
  currentUser: null,
  analytics: null,
  sandboxConfig: { enabled: false, runtime: 'none', image: '', memoryLimitMb: 512, cpuLimit: 1, networkAccess: false, mountPaths: [], timeoutSeconds: 300 },
  license: { tier: 'free', maxAgents: 3, maxRunners: 1, maxUsers: 1, features: [], validUntil: null, activated: false },
  integrations: [],
  apiKeys: [],
  webhookServer: { enabled: false, port: 9400, host: '127.0.0.1' },
  costIntelligence: { budgets: [], forecasts: [], anomalies: [], modelCosts: [], totalSpentToday: 0, totalSpentThisWeek: 0, totalSpentThisMonth: 0 }
};

beforeEach(() => {
  window.commandCenter = {
    getSnapshot: vi.fn(async () => snapshot),
    createMission: vi.fn(),
    createTask: vi.fn(),
    launchRun: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
    installMarketplaceEntry: vi.fn(),
    uninstallMarketplaceEntry: vi.fn(),
    togglePlugin: vi.fn(),
    addRunnerProfile: vi.fn(),
    removeRunnerProfile: vi.fn(),
    createUser: vi.fn(),
    updateUserRole: vi.fn(),
    createWorkflow: vi.fn(),
    launchWorkflow: vi.fn(),
    updateSandboxConfig: vi.fn(),
    getAnalytics: vi.fn()
  } as unknown as typeof window.commandCenter;
});

describe('App', () => {
  it('renders mission control data', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText('Build command center')).toBeInTheDocument());
    expect(screen.getByText('Create dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('Builder')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Run tests')[0]).toBeInTheDocument();
  });
});
