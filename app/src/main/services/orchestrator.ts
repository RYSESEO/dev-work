import fs from 'node:fs';
import path from 'node:path';
import type { AppStore } from '../db/appStore.js';
import { CommandRunner } from '../runners/commandRunner.js';
import { OpenAIRunner } from '../runners/openaiRunner.js';
import type { Runner, RunnerHandle } from '../runners/types.js';
import type { RunnerToHostMessage } from '../../shared/runnerProtocol.js';
import { findMatchingGrant } from './approvalPolicy.js';
import {
  createId,
  isTerminalRunStatus,
  nowIso,
  type AgentProfile,
  type Artifact,
  type ApprovalGrant,
  type ApprovalRequest,
  type DashboardSnapshot,
  type Mission,
  type Run,
  type RunnerProfile,
  type SignificantEvent,
  type Task,
  type UsageEvent
} from '../../shared/domain.js';

export interface Orchestrator {
  getSnapshot(): DashboardSnapshot;
  createMission(title: string, goal: string): Mission;
  createTask(missionId: string | null, title: string, description: string, priority?: Task['priority']): Task;
  launchRun(taskId: string, agentProfileId: string, prompt: string): Promise<Run>;
  approveRequest(approvalRequestId: string): void;
  rejectRequest(approvalRequestId: string, reason: string): void;
  waitForRunEvent(runId: string, eventType: string, timeoutMs: number): Promise<void>;
}

export async function createOrchestrator(store: AppStore): Promise<Orchestrator> {
  seedDefaults(store);
  const runners: Record<string, Runner> = {
    command: new CommandRunner(),
    openai: new OpenAIRunner()
  };
  const handles = new Map<string, RunnerHandle>();
  const seenRunEvents = new Map<string, Set<string>>();
  const waiters = new Map<
    string,
    Array<{ type: string; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>
  >();

  function emitRunEvent(runId: string, type: string): void {
    const seen = seenRunEvents.get(runId) ?? new Set<string>();
    seen.add(type);
    seenRunEvents.set(runId, seen);

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

  function addEvent(
    runId: string | null,
    taskId: string | null,
    title: string,
    body: string,
    level: SignificantEvent['level'] = 'info'
  ): void {
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
    appendRunLog(runId, `${title}: ${body}`);
  }

  function finalizeRun(runId: string, status: 'completed' | 'failed' | 'stopped', body: string): void {
    const run = store.getById<Run>('runs', runId);
    if (!run || isTerminalRunStatus(run.status)) return;

    const at = nowIso();
    store.put('runs', run.id, { ...run, status, completedAt: at });

    const task = store.getById<Task>('tasks', run.taskId);
    if (task) {
      const taskStatus = status === 'completed' ? 'completed' : status === 'stopped' ? 'cancelled' : 'failed';
      store.put('tasks', task.id, { ...task, status: taskStatus, updatedAt: at });
    }

    const agent = store.getById<AgentProfile>('agents', run.agentProfileId);
    if (agent) {
      store.put('agents', agent.id, {
        ...agent,
        status: 'idle',
        successCount: agent.successCount + (status === 'completed' ? 1 : 0),
        failureCount: agent.failureCount + (status === 'failed' ? 1 : 0)
      });
    }

    const title = status === 'completed' ? 'Run completed' : status === 'stopped' ? 'Run stopped' : 'Run failed';
    const level = status === 'completed' ? 'success' : status === 'stopped' ? 'warning' : 'error';
    addEvent(run.id, run.taskId, title, body, level);
    handles.delete(run.id);
    emitRunEvent(run.id, status === 'completed' ? 'complete' : status);
  }

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
      const grant = findMatchingGrant(store.getAll<ApprovalGrant>('grants'), request);
      if (grant) {
        handles.get(runId)?.send({ type: 'approval_result', requestId: request.id, approved: true, grantId: grant.id });
        addEvent(runId, run.taskId, 'Approval grant reused', request.title, 'info');
        return;
      }

      store.put('approvals', request.id, request);
      store.put('runs', run.id, { ...run, status: 'paused_for_approval' });
      addEvent(runId, run.taskId, 'Approval requested', request.title, 'warning');
      emitRunEvent(runId, 'approval_request');
      return;
    }

    if (message.type === 'usage') {
      const profile = store.getById<RunnerProfile>('runnerProfiles', run.runnerProfileId);
      const estimatedCostUsd = (message.estimatedTokens / 1000) * (profile?.costPerThousandTokensUsd ?? 0);
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
      store.put('runs', run.id, {
        ...run,
        estimatedTokens: run.estimatedTokens + message.estimatedTokens,
        estimatedCostUsd: run.estimatedCostUsd + estimatedCostUsd
      });
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
      addEvent(runId, run.taskId, message.message, message.message, message.level === 'error' ? 'error' : 'info');
      return;
    }

    if (message.type === 'complete') {
      finalizeRun(runId, 'completed', message.summary);
      return;
    }

    if (message.type === 'failed') {
      finalizeRun(runId, 'failed', message.message);
    }
  }

  return {
    getSnapshot(): DashboardSnapshot {
      return {
        missions: store.getAll<Mission>('missions'),
        tasks: store.getAll<Task>('tasks'),
        agents: store.getAll<AgentProfile>('agents'),
        runnerProfiles: store.getAll<RunnerProfile>('runnerProfiles'),
        runs: store.getAll<Run>('runs'),
        approvals: store.getAll<ApprovalRequest>('approvals'),
        grants: store.getAll<ApprovalGrant>('grants'),
        usage: store.getAll<UsageEvent>('usage'),
        events: store.getAll<SignificantEvent>('events'),
        artifacts: store.getAll<Artifact>('artifacts')
      };
    },
    createMission(title: string, goal: string): Mission {
      if (!title.trim()) throw new Error('Mission title is required.');
      if (!goal.trim()) throw new Error('Mission goal is required.');
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
      if (!title.trim()) throw new Error('Task title is required.');
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
    },
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

      const selectedRunner = runners[profile.type];
      if (!selectedRunner) throw new Error(`No runner available for type: ${profile.type}`);

      const handle = await selectedRunner.start({
        runId: run.id,
        prompt,
        profile,
        onMessage: (message) => handleRunnerMessage(run.id, message)
      });

      handles.set(run.id, handle);
      void handle.done.then((result) => {
        const current = store.getById<Run>('runs', run.id);
        if (!current || isTerminalRunStatus(current.status)) return;

        const failed = result.exitCode !== 0;
        const reason = failed
          ? `Runner exited with code ${result.exitCode ?? 'null'}${result.signal ? ` and signal ${result.signal}` : ''}.`
          : 'Runner exited without a completion message.';
        finalizeRun(run.id, failed ? 'failed' : 'completed', reason);
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
      const run = store.getById<Run>('runs', approval.runId);
      addEvent(approval.runId, run?.taskId ?? null, 'Approval rejected', reason, 'warning');
    },
    waitForRunEvent(runId: string, eventType: string, timeoutMs: number): Promise<void> {
      if (seenRunEvents.get(runId)?.has(eventType)) return Promise.resolve();

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const runWaiters = waiters.get(runId) ?? [];
          waiters.set(
            runId,
            runWaiters.filter((waiter) => waiter.type !== eventType)
          );
          reject(new Error(`Timed out waiting for ${eventType}`));
        }, timeoutMs);
        const runWaiters = waiters.get(runId) ?? [];
        runWaiters.push({ type: eventType, resolve, reject, timer });
        waiters.set(runId, runWaiters);
      });
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
      {
        id: 'agent_planner',
        name: 'Planner',
        role: 'Planner',
        runnerProfileId: 'runner_demo_command',
        status: 'idle',
        successCount: 0,
        failureCount: 0
      },
      {
        id: 'agent_builder',
        name: 'Builder',
        role: 'Builder',
        runnerProfileId: 'runner_demo_command',
        status: 'idle',
        successCount: 0,
        failureCount: 0
      },
      {
        id: 'agent_reviewer',
        name: 'Reviewer',
        role: 'Reviewer',
        runnerProfileId: 'runner_demo_command',
        status: 'idle',
        successCount: 0,
        failureCount: 0
      }
    ];
    for (const agent of agents) store.put('agents', agent.id, agent);
  }
}

function appendRunLog(runId: string | null, line: string): void {
  if (!runId || process.env.VITEST) return;

  const logDir = path.join(process.cwd(), 'logs');
  void fs.promises.mkdir(logDir, { recursive: true }).then(() =>
    fs.promises.appendFile(path.join(logDir, `${runId}.log`), `${new Date().toISOString()} ${line}\n`)
  );
}
