import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createAuthService } from '../../src/main/services/auth.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

describe('CRUD integration', () => {
  async function createTestOrchestrator() {
    const store = await createAppStore(':memory:');
    const auth = createAuthService(store);
    const orch = await createOrchestrator(store, auth);
    orch.setupAdmin('Admin', 'admin@test.com', 'password');
    orch.login('admin@test.com', 'password');
    return orch;
  }

  it('creates, updates, and deletes a mission', async () => {
    const orch = await createTestOrchestrator();
    const mission = orch.createMission('Test mission', 'Test goal');
    expect(mission.title).toBe('Test mission');

    const updated = orch.updateMission(mission.id, { title: 'Updated' });
    expect(updated.title).toBe('Updated');

    orch.deleteMission(mission.id);
    const snapshot = orch.getSnapshot();
    expect(snapshot.missions.find((m) => m.id === mission.id)).toBeUndefined();
  });

  it('creates, updates, and deletes a task', async () => {
    const orch = await createTestOrchestrator();
    const mission = orch.createMission('Mission', 'Goal');
    const task = orch.createTask(mission.id, 'Task 1', 'Description');
    expect(task.title).toBe('Task 1');

    const updated = orch.updateTask(task.id, { title: 'Updated task' });
    expect(updated.title).toBe('Updated task');

    orch.deleteTask(task.id);
    const snapshot = orch.getSnapshot();
    expect(snapshot.tasks.find((t) => t.id === task.id)).toBeUndefined();
  });

  it('creates and manages users with roles', async () => {
    const orch = await createTestOrchestrator();
    const user = orch.createUser('Operator', 'op@test.com', 'operator');
    expect(user.role).toBe('operator');

    orch.updateUserRole(user.id, 'viewer');
    const snapshot = orch.getSnapshot();
    const updated = snapshot.users.find((u) => u.id === user.id);
    expect(updated?.role).toBe('viewer');

    orch.deleteUser(user.id);
    const snapshot2 = orch.getSnapshot();
    expect(snapshot2.users.find((u) => u.id === user.id)).toBeUndefined();
  });

  it('creates and deletes a workflow', async () => {
    const orch = await createTestOrchestrator();
    const workflow = orch.createWorkflow('CI Pipeline', 'Automated testing', [
      { id: 'step1', name: 'Lint', agentRole: 'linter', promptTemplate: 'Run linter', dependsOn: [], onFailure: 'stop', maxRetries: 0 },
      { id: 'step2', name: 'Test', agentRole: 'tester', promptTemplate: 'Run tests', dependsOn: ['step1'], onFailure: 'stop', maxRetries: 0 }
    ]);
    expect(workflow.name).toBe('CI Pipeline');
    expect(workflow.steps).toHaveLength(2);

    orch.deleteWorkflow(workflow.id);
    const snapshot = orch.getSnapshot();
    expect(snapshot.workflows.find((w) => w.id === workflow.id)).toBeUndefined();
  });

  it('records audit log entries for mutations', async () => {
    const orch = await createTestOrchestrator();
    orch.createMission('Audited mission', 'Test');
    const auditLog = orch.getAuditLog();
    const missionAudit = auditLog.find((e) => e.action === 'create' && e.targetType === 'mission');
    expect(missionAudit).toBeTruthy();
  });

  it('exports data as JSON', async () => {
    const orch = await createTestOrchestrator();
    orch.createMission('Export test', 'Goal');
    const exported = orch.exportData('json');
    const parsed = JSON.parse(exported);
    expect(parsed.missions).toBeInstanceOf(Array);
    expect(parsed.missions.length).toBeGreaterThanOrEqual(1);
  });
});
