import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

describe('analytics', () => {
  it('returns analytics with zero runs', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const analytics = orchestrator.getAnalytics();

    expect(analytics.totalRuns).toBe(0);
    expect(analytics.successfulRuns).toBe(0);
    expect(analytics.failedRuns).toBe(0);
    expect(analytics.totalTokens).toBe(0);
    expect(analytics.totalCostUsd).toBe(0);
    expect(analytics.averageRunDurationMs).toBe(0);
    expect(analytics.runsByDay).toEqual([]);
    expect(analytics.topAgents.length).toBeGreaterThanOrEqual(3);
  });

  it('computes analytics after a run completes', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);
    const task = orchestrator.createTask(null, 'Test task', 'Test');

    const run = await orchestrator.launchRun(task.id, 'agent_builder', 'prompt');
    await orchestrator.waitForRunEvent(run.id, 'approval_request', 5000);
    const approval = orchestrator.getSnapshot().approvals[0];
    orchestrator.approveRequest(approval.id);
    await orchestrator.waitForRunEvent(run.id, 'complete', 5000);

    const analytics = orchestrator.getAnalytics();
    expect(analytics.totalRuns).toBe(1);
    expect(analytics.successfulRuns).toBe(1);
    expect(analytics.estimatedTimeSavedHours).toBe(0.5);
    expect(analytics.topAgents.some((a) => a.runs > 0)).toBe(true);
  }, 10000);
});
