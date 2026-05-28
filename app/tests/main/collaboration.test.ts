import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createCollaborationService } from '../../src/main/services/collaboration.js';
import type { AgentProfile } from '../../src/shared/domain.js';
import { createId } from '../../src/shared/domain.js';

describe('collaboration service', () => {
  it('creates and retrieves sessions', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const session = svc.createSession('Test Session', 'A test', 'parallel', null, 3);
    expect(session.title).toBe('Test Session');
    expect(session.strategy).toBe('parallel');
    expect(session.status).toBe('planning');
    expect(session.maxConcurrency).toBe(3);
    const all = svc.getSessions();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(session.id);
  });

  it('deletes sessions', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const s = svc.createSession('Del', '', 'pipeline', null);
    svc.deleteSession(s.id);
    expect(svc.getSessions().length).toBe(0);
  });

  it('cannot delete a running session', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const s = svc.createSession('Running', '', 'parallel', null);
    svc.updateSessionStatus(s.id, 'running');
    expect(() => svc.deleteSession(s.id)).toThrow('Cannot delete a running session.');
  });

  it('adds and manages sub-tasks', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const session = svc.createSession('Sub', '', 'parallel', null);

    const st1 = svc.addSubTask(session.id, 'Task A', 'Do A');
    const st2 = svc.addSubTask(session.id, 'Task B', 'Do B', [st1.id]);
    expect(st1.status).toBe('pending');
    expect(st2.dependsOn).toEqual([st1.id]);

    const updated = svc.getSession(session.id);
    expect(updated.subTasks.length).toBe(2);

    svc.deleteSubTask(session.id, st1.id);
    const afterDelete = svc.getSession(session.id);
    expect(afterDelete.subTasks.length).toBe(1);
    expect(afterDelete.subTasks[0].dependsOn).toEqual([]);
  });

  it('assigns sub-tasks to agents', async () => {
    const store = await createAppStore(':memory:');
    const agent: AgentProfile = {
      id: createId('agent'), name: 'Bot 1', role: 'builder',
      runnerProfileId: 'r1', status: 'idle', successCount: 0, failureCount: 0
    };
    store.put('agents', agent.id, agent);

    const svc = createCollaborationService(store);
    const session = svc.createSession('Assign', '', 'parallel', null);
    const st = svc.addSubTask(session.id, 'Build', 'Build module');

    const assigned = svc.assignSubTask(session.id, st.id, agent.id);
    expect(assigned.assignedAgentId).toBe(agent.id);
    expect(assigned.status).toBe('assigned');

    const s = svc.getSession(session.id);
    expect(s.agentAssignments.length).toBe(1);
    expect(s.agentAssignments[0].subTaskIds).toContain(st.id);
  });

  it('manages shared context', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const session = svc.createSession('Ctx', '', 'parallel', null);

    svc.setContext(session.id, 'repo', 'https://github.com/test/repo', 'agent-1');
    expect(svc.getContext(session.id, 'repo')).toBe('https://github.com/test/repo');

    svc.setContext(session.id, 'repo', 'https://github.com/test/repo2', 'agent-2');
    expect(svc.getContext(session.id, 'repo')).toBe('https://github.com/test/repo2');
    expect(svc.getContext(session.id, 'nonexistent')).toBeNull();
  });

  it('sends and retrieves messages', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const session = svc.createSession('Msg', '', 'parallel', null);

    const msg = svc.sendMessage(session.id, 'agent-1', 'agent-2', 'data_share', 'Results', 'Here are the results');
    expect(msg.type).toBe('data_share');
    expect(msg.fromAgentId).toBe('agent-1');
    expect(msg.toAgentId).toBe('agent-2');

    const msgs = svc.getMessages(session.id);
    expect(msgs.length).toBe(1);
    expect(msgs[0].subject).toBe('Results');
  });

  it('reports and resolves conflicts', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const session = svc.createSession('Conflict', '', 'parallel', null);

    const conflict = svc.reportConflict(session.id, 'resource_contention', 'Both agents editing same file', ['a1', 'a2']);
    expect(conflict.type).toBe('resource_contention');
    expect(conflict.resolution).toBeNull();

    const resolved = svc.resolveConflict(session.id, conflict.id, 'Agent a1 takes priority');
    expect(resolved.resolution).toBe('Agent a1 takes priority');
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('identifies ready sub-tasks with dependency resolution', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);
    const session = svc.createSession('Deps', '', 'parallel', null);

    const st1 = svc.addSubTask(session.id, 'Task 1', 'First');
    const st2 = svc.addSubTask(session.id, 'Task 2', 'Depends on 1', [st1.id]);
    const st3 = svc.addSubTask(session.id, 'Task 3', 'Independent');

    // Initially st1 and st3 are ready (no deps), st2 is blocked
    let ready = svc.getReadySubTasks(session.id);
    expect(ready.map((s) => s.id).sort()).toEqual([st1.id, st3.id].sort());

    // Complete st1 → st2 becomes ready
    svc.updateSubTaskStatus(session.id, st1.id, 'completed');
    ready = svc.getReadySubTasks(session.id);
    expect(ready.map((s) => s.id)).toContain(st2.id);
  });

  it('computes snapshot with metrics', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCollaborationService(store);

    const s1 = svc.createSession('Done', '', 'parallel', null);
    svc.addSubTask(s1.id, 'A', '');
    svc.updateSubTaskStatus(s1.id, svc.getSession(s1.id).subTasks[0].id, 'completed');
    svc.updateSessionStatus(s1.id, 'completed');

    const s2 = svc.createSession('Active', '', 'pipeline', null);
    svc.addSubTask(s2.id, 'B', '');
    svc.addSubTask(s2.id, 'C', '');
    svc.updateSessionStatus(s2.id, 'running');

    const snap = svc.getSnapshot();
    expect(snap.sessions.length).toBe(2);
    expect(snap.activeSessions).toBe(1);
    expect(snap.totalCompleted).toBe(1);
    expect(snap.totalSubTasks).toBe(3);
    expect(snap.completedSubTasks).toBe(1);
  });

  it('updates agent assignment status when sub-tasks complete', async () => {
    const store = await createAppStore(':memory:');
    const agent: AgentProfile = {
      id: createId('agent'), name: 'Bot', role: 'worker',
      runnerProfileId: 'r1', status: 'idle', successCount: 0, failureCount: 0
    };
    store.put('agents', agent.id, agent);

    const svc = createCollaborationService(store);
    const session = svc.createSession('Status', '', 'parallel', null);
    const st = svc.addSubTask(session.id, 'Work', 'Do work');
    svc.assignSubTask(session.id, st.id, agent.id);
    svc.updateSubTaskStatus(session.id, st.id, 'completed');

    const s = svc.getSession(session.id);
    expect(s.agentAssignments[0].status).toBe('done');
  });
});
