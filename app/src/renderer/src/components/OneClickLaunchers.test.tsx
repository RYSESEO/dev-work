import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSnapshot } from '../../../shared/domain';
import { OneClickLaunchers } from './OneClickLaunchers';

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
  } as unknown as typeof window.commandCenter;
});

describe('OneClickLaunchers', () => {
  it('creates a task and launches a run', async () => {
    render(<OneClickLaunchers snapshot={snapshot} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByText('Review this repo'));

    await waitFor(() => expect(window.commandCenter.createTask).toHaveBeenCalled());
    expect(window.commandCenter.launchRun).toHaveBeenCalledWith(
      'task_created',
      'agent_builder',
      expect.stringContaining('Review the repository')
    );
  });
});
