import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../../../shared/domain';
import { OneClickLaunchers } from './OneClickLaunchers';
import { ToastProvider } from './ToastProvider';

const snapshot: DashboardSnapshot = {
  missions: [{ id: 'mission_1', title: 'Mission', goal: 'Goal', status: 'active', createdAt: '', updatedAt: '' }],
  tasks: [],
  agents: [
    {
      id: 'agent_builder',
      name: 'Builder',
      role: 'Builder',
      runnerProfileId: 'runner_demo_command',
      status: 'idle',
      successCount: 0,
      failureCount: 0
    }
  ],
  runnerProfiles: [],
  runs: [],
  approvals: [],
  grants: [],
  usage: [],
  events: [],
  artifacts: [],
  marketplace: [],
  plugins: [],
  users: [],
  workflows: [],
  workflowRuns: [],
  currentUser: null,
  analytics: null,
  sandboxConfig: { enabled: false, runtime: 'none', image: '', memoryLimitMb: 512, cpuLimit: 1, networkAccess: false, mountPaths: [], timeoutSeconds: 300 },
  license: { tier: 'free', maxAgents: 3, maxRunners: 1, maxUsers: 1, features: [], validUntil: null, activated: false }
};

beforeEach(() => {
  window.commandCenter = {
    getSnapshot: vi.fn(),
    createMission: vi.fn(),
    createTask: vi.fn(async () => ({ id: 'task_created' })),
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

describe('OneClickLaunchers', () => {
  it('creates a task and launches a run', async () => {
    render(<ToastProvider><OneClickLaunchers snapshot={snapshot} onRefresh={vi.fn()} /></ToastProvider>);

    fireEvent.click(screen.getByText('Review this repo'));

    await waitFor(() => expect(window.commandCenter.createTask).toHaveBeenCalled());
    expect(window.commandCenter.launchRun).toHaveBeenCalledWith(
      'task_created',
      'agent_builder',
      expect.stringContaining('Review the repository')
    );
  });
});
