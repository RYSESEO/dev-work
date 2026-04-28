import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

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
