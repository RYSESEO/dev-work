import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

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
