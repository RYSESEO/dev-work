import type { AppStore } from '../db/appStore.js';
import {
  createId,
  nowIso,
  type AgentMessage,
  type AgentMessageType,
  type AgentProfile,
  type CollaborationSession,
  type CollaborationSnapshot,
  type CollaborationStatus,
  type ConflictRecord,
  type Run,
  type SubTask,
  type SubTaskStatus
} from '../../shared/domain.js';
import { logger } from '../logger.js';

export interface CollaborationService {
  createSession(
    title: string,
    description: string,
    strategy: CollaborationSession['strategy'],
    missionId: string | null,
    maxConcurrency?: number
  ): CollaborationSession;
  getSession(id: string): CollaborationSession;
  getSessions(): CollaborationSession[];
  deleteSession(id: string): void;
  updateSessionStatus(id: string, status: CollaborationStatus): CollaborationSession;

  addSubTask(
    sessionId: string,
    title: string,
    description: string,
    dependsOn?: string[],
    priority?: SubTask['priority']
  ): SubTask;
  updateSubTaskStatus(sessionId: string, subTaskId: string, status: SubTaskStatus, output?: string): SubTask;
  assignSubTask(sessionId: string, subTaskId: string, agentId: string): SubTask;
  deleteSubTask(sessionId: string, subTaskId: string): void;

  assignAgent(sessionId: string, agentId: string, role: string): void;
  removeAgent(sessionId: string, agentId: string): void;

  setContext(sessionId: string, key: string, value: string, setBy: string): void;
  getContext(sessionId: string, key: string): string | null;

  sendMessage(
    sessionId: string,
    fromAgentId: string,
    toAgentId: string | null,
    type: AgentMessageType,
    subject: string,
    body: string,
    metadata?: Record<string, string>
  ): AgentMessage;
  getMessages(sessionId: string, limit?: number): AgentMessage[];

  reportConflict(
    sessionId: string,
    type: ConflictRecord['type'],
    description: string,
    involvedAgentIds: string[]
  ): ConflictRecord;
  resolveConflict(sessionId: string, conflictId: string, resolution: string): ConflictRecord;

  getReadySubTasks(sessionId: string): SubTask[];
  executeSession(sessionId: string, launchRun: (taskId: string, agentId: string, prompt: string) => Promise<Run>): Promise<void>;

  getSnapshot(): CollaborationSnapshot;
}

export function createCollaborationService(store: AppStore): CollaborationService {
  const log = logger.child('collaboration');

  function loadSession(id: string): CollaborationSession {
    const session = store.getById<CollaborationSession>('collaborations', id);
    if (!session) throw new Error(`Collaboration session not found: ${id}`);
    return session;
  }

  function saveSession(session: CollaborationSession): void {
    session.updatedAt = nowIso();
    store.put('collaborations', session.id, session);
  }

  return {
    createSession(title, description, strategy, missionId, maxConcurrency = 3): CollaborationSession {
      if (!title.trim()) throw new Error('Session title is required.');
      const at = nowIso();
      const session: CollaborationSession = {
        id: createId('collab'),
        missionId,
        title: title.trim(),
        description: description.trim(),
        status: 'planning',
        strategy,
        maxConcurrency,
        subTasks: [],
        agentAssignments: [],
        sharedContext: [],
        messages: [],
        conflicts: [],
        createdAt: at,
        updatedAt: at,
        completedAt: null
      };
      store.put('collaborations', session.id, session);
      log.info('Collaboration session created', { id: session.id, title, strategy });
      return session;
    },

    getSession(id: string): CollaborationSession {
      return loadSession(id);
    },

    getSessions(): CollaborationSession[] {
      return store.getAll<CollaborationSession>('collaborations');
    },

    deleteSession(id: string): void {
      const session = loadSession(id);
      if (session.status === 'running') throw new Error('Cannot delete a running session.');
      store.remove('collaborations', id);
      log.info('Collaboration session deleted', { id });
    },

    updateSessionStatus(id: string, status: CollaborationStatus): CollaborationSession {
      const session = loadSession(id);
      session.status = status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        session.completedAt = nowIso();
      }
      saveSession(session);
      log.info('Session status updated', { id, status });
      return session;
    },

    addSubTask(sessionId, title, description, dependsOn = [], priority = 'normal'): SubTask {
      const session = loadSession(sessionId);
      if (!title.trim()) throw new Error('Sub-task title is required.');
      const subTask: SubTask = {
        id: createId('subtask'),
        sessionId,
        parentTaskId: null,
        title: title.trim(),
        description: description.trim(),
        status: 'pending',
        assignedAgentId: null,
        runId: null,
        dependsOn,
        priority,
        output: null,
        createdAt: nowIso(),
        completedAt: null
      };
      session.subTasks.push(subTask);
      saveSession(session);
      log.info('Sub-task added', { sessionId, subTaskId: subTask.id, title });
      return subTask;
    },

    updateSubTaskStatus(sessionId, subTaskId, status, output): SubTask {
      const session = loadSession(sessionId);
      const st = session.subTasks.find((s) => s.id === subTaskId);
      if (!st) throw new Error(`Sub-task not found: ${subTaskId}`);
      st.status = status;
      if (output !== undefined) st.output = output;
      if (status === 'completed' || status === 'failed' || status === 'skipped') {
        st.completedAt = nowIso();
      }
      // Update agent assignment status
      if (st.assignedAgentId) {
        const assignment = session.agentAssignments.find((a) => a.agentId === st.assignedAgentId);
        if (assignment) {
          const agentSubTasks = session.subTasks.filter((s) => s.assignedAgentId === st.assignedAgentId);
          const allDone = agentSubTasks.every((s) =>
            s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
          );
          if (allDone) {
            assignment.status = agentSubTasks.some((s) => s.status === 'failed') ? 'failed' : 'done';
          }
        }
      }
      saveSession(session);
      return st;
    },

    assignSubTask(sessionId, subTaskId, agentId): SubTask {
      const session = loadSession(sessionId);
      const st = session.subTasks.find((s) => s.id === subTaskId);
      if (!st) throw new Error(`Sub-task not found: ${subTaskId}`);
      st.assignedAgentId = agentId;
      st.status = 'assigned';

      // Ensure agent is in assignments
      let assignment = session.agentAssignments.find((a) => a.agentId === agentId);
      if (!assignment) {
        const agent = store.getById<AgentProfile>('agents', agentId);
        assignment = {
          agentId,
          role: agent?.role ?? 'worker',
          subTaskIds: [],
          status: 'idle'
        };
        session.agentAssignments.push(assignment);
      }
      if (!assignment.subTaskIds.includes(subTaskId)) {
        assignment.subTaskIds.push(subTaskId);
      }
      saveSession(session);
      log.info('Sub-task assigned', { sessionId, subTaskId, agentId });
      return st;
    },

    deleteSubTask(sessionId, subTaskId): void {
      const session = loadSession(sessionId);
      const idx = session.subTasks.findIndex((s) => s.id === subTaskId);
      if (idx === -1) throw new Error(`Sub-task not found: ${subTaskId}`);
      session.subTasks.splice(idx, 1);
      // Remove from agent assignments
      for (const a of session.agentAssignments) {
        a.subTaskIds = a.subTaskIds.filter((id) => id !== subTaskId);
      }
      // Remove from dependsOn references
      for (const s of session.subTasks) {
        s.dependsOn = s.dependsOn.filter((id) => id !== subTaskId);
      }
      saveSession(session);
    },

    assignAgent(sessionId, agentId, role): void {
      const session = loadSession(sessionId);
      const existing = session.agentAssignments.find((a) => a.agentId === agentId);
      if (existing) {
        existing.role = role;
      } else {
        session.agentAssignments.push({
          agentId,
          role,
          subTaskIds: [],
          status: 'idle'
        });
      }
      saveSession(session);
      log.info('Agent assigned to session', { sessionId, agentId, role });
    },

    removeAgent(sessionId, agentId): void {
      const session = loadSession(sessionId);
      session.agentAssignments = session.agentAssignments.filter((a) => a.agentId !== agentId);
      for (const st of session.subTasks) {
        if (st.assignedAgentId === agentId) {
          st.assignedAgentId = null;
          if (st.status === 'assigned') st.status = 'pending';
        }
      }
      saveSession(session);
      log.info('Agent removed from session', { sessionId, agentId });
    },

    setContext(sessionId, key, value, setBy): void {
      const session = loadSession(sessionId);
      const existing = session.sharedContext.find((c) => c.key === key);
      if (existing) {
        existing.value = value;
        existing.setBy = setBy;
        existing.setAt = nowIso();
      } else {
        session.sharedContext.push({ key, value, setBy, setAt: nowIso() });
      }
      saveSession(session);
    },

    getContext(sessionId, key): string | null {
      const session = loadSession(sessionId);
      return session.sharedContext.find((c) => c.key === key)?.value ?? null;
    },

    sendMessage(sessionId, fromAgentId, toAgentId, type, subject, body, metadata = {}): AgentMessage {
      const session = loadSession(sessionId);
      const msg: AgentMessage = {
        id: createId('message'),
        sessionId,
        fromAgentId,
        toAgentId,
        type,
        subject,
        body,
        metadata,
        createdAt: nowIso()
      };
      session.messages.push(msg);
      saveSession(session);
      log.info('Agent message sent', { sessionId, msgId: msg.id, type, from: fromAgentId });
      return msg;
    },

    getMessages(sessionId, limit = 50): AgentMessage[] {
      const session = loadSession(sessionId);
      return session.messages.slice(-limit);
    },

    reportConflict(sessionId, type, description, involvedAgentIds): ConflictRecord {
      const session = loadSession(sessionId);
      const conflict: ConflictRecord = {
        id: createId('collab'),
        sessionId,
        type,
        description,
        involvedAgentIds,
        resolution: null,
        resolvedAt: null,
        createdAt: nowIso()
      };
      session.conflicts.push(conflict);
      saveSession(session);
      log.warn('Conflict reported', { sessionId, conflictId: conflict.id, type });
      return conflict;
    },

    resolveConflict(sessionId, conflictId, resolution): ConflictRecord {
      const session = loadSession(sessionId);
      const conflict = session.conflicts.find((c) => c.id === conflictId);
      if (!conflict) throw new Error(`Conflict not found: ${conflictId}`);
      conflict.resolution = resolution;
      conflict.resolvedAt = nowIso();
      saveSession(session);
      log.info('Conflict resolved', { sessionId, conflictId });
      return conflict;
    },

    getReadySubTasks(sessionId): SubTask[] {
      const session = loadSession(sessionId);
      return session.subTasks.filter((st) => {
        if (st.status !== 'pending' && st.status !== 'assigned') return false;
        // All dependencies must be completed
        return st.dependsOn.every((depId) => {
          const dep = session.subTasks.find((s) => s.id === depId);
          return dep?.status === 'completed';
        });
      });
    },

    async executeSession(sessionId, launchRun): Promise<void> {
      const session = loadSession(sessionId);
      if (session.status !== 'planning' && session.status !== 'running') {
        throw new Error(`Cannot execute session in ${session.status} status.`);
      }

      session.status = 'running';
      saveSession(session);

      const readyTasks = this.getReadySubTasks(sessionId);
      const concurrencySlots = session.maxConcurrency;
      const runningCount = session.subTasks.filter((s) => s.status === 'running').length;
      const available = Math.max(0, concurrencySlots - runningCount);
      const toRun = readyTasks
        .filter((st) => st.assignedAgentId !== null)
        .slice(0, available);

      for (const st of toRun) {
        try {
          st.status = 'running';

          // Build prompt with shared context
          let prompt = st.description;
          const freshSession = loadSession(sessionId);
          if (freshSession.sharedContext.length > 0) {
            const contextStr = freshSession.sharedContext
              .map((c) => `${c.key}: ${c.value}`)
              .join('\n');
            prompt = `Context:\n${contextStr}\n\nTask: ${prompt}`;
          }

          const run = await launchRun(st.id, st.assignedAgentId!, prompt);
          st.runId = run.id;
          saveSession(loadSession(sessionId));

          // Update the sub-task in the session
          const updatedSession = loadSession(sessionId);
          const updSt = updatedSession.subTasks.find((s) => s.id === st.id);
          if (updSt) {
            updSt.status = 'running';
            updSt.runId = run.id;
            saveSession(updatedSession);
          }

          // Mark agent as working
          const asgn = updatedSession.agentAssignments.find((a) => a.agentId === st.assignedAgentId);
          if (asgn) {
            asgn.status = 'working';
            saveSession(updatedSession);
          }

          log.info('Sub-task execution started', { sessionId, subTaskId: st.id, runId: run.id });
        } catch (err) {
          st.status = 'failed';
          st.completedAt = nowIso();
          const errSession = loadSession(sessionId);
          const errSt = errSession.subTasks.find((s) => s.id === st.id);
          if (errSt) {
            errSt.status = 'failed';
            errSt.completedAt = nowIso();
            saveSession(errSession);
          }
          log.error('Sub-task execution failed', { sessionId, subTaskId: st.id, error: String(err) });
        }
      }

      // Check if all sub-tasks are complete
      const finalSession = loadSession(sessionId);
      const allDone = finalSession.subTasks.every((s) =>
        s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
      );
      if (allDone && finalSession.subTasks.length > 0) {
        const anyFailed = finalSession.subTasks.some((s) => s.status === 'failed');
        finalSession.status = anyFailed ? 'failed' : 'completed';
        finalSession.completedAt = nowIso();
        saveSession(finalSession);
        log.info('Session completed', { sessionId, status: finalSession.status });
      }
    },

    getSnapshot(): CollaborationSnapshot {
      const sessions = store.getAll<CollaborationSession>('collaborations');
      const activeSessions = sessions.filter((s) => s.status === 'running' || s.status === 'planning').length;
      const totalCompleted = sessions.filter((s) => s.status === 'completed').length;

      let totalSubTasks = 0;
      let completedSubTasks = 0;
      const completionTimes: number[] = [];

      for (const s of sessions) {
        totalSubTasks += s.subTasks.length;
        for (const st of s.subTasks) {
          if (st.status === 'completed') {
            completedSubTasks++;
            if (st.completedAt && st.createdAt) {
              completionTimes.push(new Date(st.completedAt).getTime() - new Date(st.createdAt).getTime());
            }
          }
        }
      }

      const avgCompletionTimeMs = completionTimes.length > 0
        ? completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length
        : 0;

      return {
        sessions,
        activeSessions,
        totalCompleted,
        totalSubTasks,
        completedSubTasks,
        avgCompletionTimeMs
      };
    }
  };
}
