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
  type AnalyticsSnapshot,
  type Artifact,
  type ApprovalGrant,
  type ApprovalRequest,
  type DashboardSnapshot,
  type MarketplaceEntry,
  type Mission,
  type PluginDefinition,
  type Run,
  type RunnerProfile,
  type SandboxConfig,
  type SignificantEvent,
  type Task,
  type User,
  type UsageEvent,
  type WorkflowRun,
  type WorkflowStep,
  type WorkflowStepResult,
  type WorkflowTemplate
} from '../../shared/domain.js';

export interface Orchestrator {
  getSnapshot(): DashboardSnapshot;
  createMission(title: string, goal: string): Mission;
  createTask(missionId: string | null, title: string, description: string, priority?: Task['priority']): Task;
  launchRun(taskId: string, agentProfileId: string, prompt: string): Promise<Run>;
  approveRequest(approvalRequestId: string): void;
  rejectRequest(approvalRequestId: string, reason: string): void;
  waitForRunEvent(runId: string, eventType: string, timeoutMs: number): Promise<void>;
  installMarketplaceEntry(entryId: string): void;
  uninstallMarketplaceEntry(entryId: string): void;
  togglePlugin(pluginId: string, enabled: boolean): void;
  addRunnerProfile(profile: RunnerProfile): void;
  removeRunnerProfile(profileId: string): void;
  createUser(name: string, email: string, role: User['role']): User;
  updateUserRole(userId: string, role: User['role']): void;
  createWorkflow(name: string, description: string, steps: WorkflowStep[]): WorkflowTemplate;
  launchWorkflow(workflowId: string, missionId: string | null): Promise<WorkflowRun>;
  updateSandboxConfig(config: Partial<SandboxConfig>): SandboxConfig;
  getAnalytics(): AnalyticsSnapshot;
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
        artifacts: store.getAll<Artifact>('artifacts'),
        marketplace: store.getAll<MarketplaceEntry>('marketplace'),
        plugins: store.getAll<PluginDefinition>('plugins'),
        users: store.getAll<User>('users'),
        workflows: store.getAll<WorkflowTemplate>('workflows'),
        workflowRuns: store.getAll<WorkflowRun>('workflowRuns'),
        currentUser: store.getAll<User>('users')[0] ?? null,
        analytics: null,
        sandboxConfig: getSandboxConfig()
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
    },
    installMarketplaceEntry(entryId: string): void {
      const entry = store.getById<MarketplaceEntry>('marketplace', entryId);
      if (!entry) throw new Error(`Marketplace entry not found: ${entryId}`);
      store.put('marketplace', entry.id, { ...entry, installed: true, updatedAt: nowIso() });
    },
    uninstallMarketplaceEntry(entryId: string): void {
      const entry = store.getById<MarketplaceEntry>('marketplace', entryId);
      if (!entry) throw new Error(`Marketplace entry not found: ${entryId}`);
      store.put('marketplace', entry.id, { ...entry, installed: false, updatedAt: nowIso() });
    },
    togglePlugin(pluginId: string, enabled: boolean): void {
      const plugin = store.getById<PluginDefinition>('plugins', pluginId);
      if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
      store.put('plugins', plugin.id, { ...plugin, enabled });
    },
    addRunnerProfile(profile: RunnerProfile): void {
      store.put('runnerProfiles', profile.id, profile);
    },
    removeRunnerProfile(profileId: string): void {
      store.remove('runnerProfiles', profileId);
    },
    createUser(name: string, email: string, role: User['role']): User {
      if (!name.trim()) throw new Error('User name is required.');
      if (!email.trim()) throw new Error('User email is required.');
      const at = nowIso();
      const user: User = {
        id: createId('user'),
        name: name.trim(),
        email: email.trim(),
        role,
        avatar: null,
        createdAt: at,
        lastActiveAt: at
      };
      store.put('users', user.id, user);
      return user;
    },
    updateUserRole(userId: string, role: User['role']): void {
      const user = store.getById<User>('users', userId);
      if (!user) throw new Error(`User not found: ${userId}`);
      store.put('users', user.id, { ...user, role });
    },
    createWorkflow(name: string, description: string, steps: WorkflowStep[]): WorkflowTemplate {
      if (!name.trim()) throw new Error('Workflow name is required.');
      const at = nowIso();
      const workflow: WorkflowTemplate = {
        id: createId('workflow'),
        name: name.trim(),
        description: description.trim(),
        steps,
        createdAt: at,
        updatedAt: at
      };
      store.put('workflows', workflow.id, workflow);
      return workflow;
    },
    async launchWorkflow(workflowId: string, missionId: string | null): Promise<WorkflowRun> {
      const workflow = store.getById<WorkflowTemplate>('workflows', workflowId);
      if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

      const at = nowIso();
      const stepResults: WorkflowStepResult[] = workflow.steps.map((step) => ({
        stepId: step.id,
        runId: null,
        status: 'pending' as const,
        startedAt: null,
        completedAt: null
      }));

      const workflowRun: WorkflowRun = {
        id: createId('run'),
        workflowId,
        missionId,
        status: 'running',
        currentStepIndex: 0,
        stepResults,
        startedAt: at,
        completedAt: null
      };
      store.put('workflowRuns', workflowRun.id, workflowRun);
      addEvent(null, null, 'Workflow started', `Workflow "${workflow.name}" started with ${workflow.steps.length} steps.`);

      void executeWorkflowSteps(workflowRun, workflow);
      return workflowRun;
    },
    updateSandboxConfig(config: Partial<SandboxConfig>): SandboxConfig {
      const current = getSandboxConfig();
      const updated: SandboxConfig = { ...current, ...config };
      store.put('sandboxConfig', 'default', { id: 'default', ...updated });
      return updated;
    },
    getAnalytics(): AnalyticsSnapshot {
      return computeAnalytics();
    }
  };

  function getSandboxConfig(): SandboxConfig {
    const stored = store.getById<SandboxConfig & { id: string }>('sandboxConfig', 'default');
    if (stored) {
      const { id: _id, ...config } = stored;
      void _id;
      return config;
    }
    return {
      enabled: false,
      runtime: 'none',
      image: '',
      memoryLimitMb: 512,
      cpuLimit: 1,
      networkAccess: false,
      mountPaths: [],
      timeoutSeconds: 300
    };
  }

  function computeAnalytics(): AnalyticsSnapshot {
    const allRuns = store.getAll<Run>('runs');
    const successfulRuns = allRuns.filter((r) => r.status === 'completed');
    const failedRuns = allRuns.filter((r) => r.status === 'failed');
    const totalTokens = allRuns.reduce((sum, r) => sum + r.estimatedTokens, 0);
    const totalCostUsd = allRuns.reduce((sum, r) => sum + r.estimatedCostUsd, 0);

    const durations = allRuns
      .filter((r) => r.startedAt && r.completedAt)
      .map((r) => new Date(r.completedAt!).getTime() - new Date(r.startedAt!).getTime());
    const averageRunDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const estimatedTimeSavedHours = successfulRuns.length * 0.5;
    const costSavingsUsd = estimatedTimeSavedHours * 75 - totalCostUsd;

    const runsByDayMap = new Map<string, { count: number; cost: number }>();
    for (const run of allRuns) {
      const date = (run.startedAt ?? run.completedAt ?? '').slice(0, 10);
      if (!date) continue;
      const entry = runsByDayMap.get(date) ?? { count: 0, cost: 0 };
      entry.count++;
      entry.cost += run.estimatedCostUsd;
      runsByDayMap.set(date, entry);
    }
    const runsByDay = [...runsByDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    const agents = store.getAll<AgentProfile>('agents');
    const topAgents = agents.map((agent) => {
      const agentRuns = allRuns.filter((r) => r.agentProfileId === agent.id);
      const agentSuccess = agentRuns.filter((r) => r.status === 'completed').length;
      return {
        agentId: agent.id,
        name: agent.name,
        runs: agentRuns.length,
        successRate: agentRuns.length > 0 ? agentSuccess / agentRuns.length : 0
      };
    }).sort((a, b) => b.runs - a.runs);

    return {
      totalRuns: allRuns.length,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      totalTokens,
      totalCostUsd,
      averageRunDurationMs,
      estimatedTimeSavedHours,
      costSavingsUsd,
      runsByDay,
      topAgents
    };
  }

  async function executeWorkflowSteps(workflowRun: WorkflowRun, workflow: WorkflowTemplate): Promise<void> {
    let current = workflowRun;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const agents = store.getAll<AgentProfile>('agents');
      const agent = agents.find((a) => a.role === step.agentRole) ?? agents[0];
      if (!agent) {
        current = { ...current, status: 'failed', completedAt: nowIso() };
        store.put('workflowRuns', current.id, current);
        return;
      }

      current.stepResults[i] = { ...current.stepResults[i], status: 'running', startedAt: nowIso() };
      current = { ...current, currentStepIndex: i, stepResults: [...current.stepResults] };
      store.put('workflowRuns', current.id, current);

      try {
        const missionId = current.missionId;
        const task = store.getById<Task>('tasks', '') ?? {
          id: createId('task'),
          missionId,
          title: step.name,
          description: step.promptTemplate,
          status: 'queued' as const,
          priority: 'normal' as const,
          assigneeAgentId: null,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        store.put('tasks', task.id, task);

        const profile = store.getById<RunnerProfile>('runnerProfiles', agent.runnerProfileId);
        if (!profile) throw new Error(`Runner profile not found: ${agent.runnerProfileId}`);

        const prompt = step.promptTemplate.replaceAll('{{workspacePath}}', profile.workspacePath);
        const at = nowIso();
        const run: Run = {
          id: createId('run'),
          taskId: task.id,
          agentProfileId: agent.id,
          runnerProfileId: profile.id,
          status: 'running',
          startedAt: at,
          completedAt: null,
          estimatedCostUsd: 0,
          estimatedTokens: 0
        };
        store.put('runs', run.id, run);

        const selectedRunner = runners[profile.type];
        if (!selectedRunner) throw new Error(`No runner for type: ${profile.type}`);

        const handle = await selectedRunner.start({
          runId: run.id,
          prompt,
          profile,
          onMessage: (message) => handleRunnerMessage(run.id, message)
        });
        handles.set(run.id, handle);

        const result = await handle.done;
        const finalRun = store.getById<Run>('runs', run.id);
        const stepStatus = (finalRun?.status === 'completed' || result.exitCode === 0) ? 'completed' as const : 'failed' as const;

        current.stepResults[i] = { ...current.stepResults[i], runId: run.id, status: stepStatus, completedAt: nowIso() };
        current = { ...current, stepResults: [...current.stepResults] };
        store.put('workflowRuns', current.id, current);

        if (stepStatus === 'failed') {
          if (step.onFailure === 'stop') {
            current = { ...current, status: 'failed', completedAt: nowIso() };
            store.put('workflowRuns', current.id, current);
            return;
          }
          if (step.onFailure === 'skip') continue;
        }
      } catch {
        current.stepResults[i] = { ...current.stepResults[i], status: 'failed', completedAt: nowIso() };
        current = { ...current, stepResults: [...current.stepResults] };
        if (step.onFailure === 'stop') {
          current = { ...current, status: 'failed', completedAt: nowIso() };
          store.put('workflowRuns', current.id, current);
          return;
        }
      }
    }

    current = { ...current, status: 'completed', completedAt: nowIso() };
    store.put('workflowRuns', current.id, current);
    addEvent(null, null, 'Workflow completed', `Workflow finished all ${workflow.steps.length} steps.`, 'success');
  }
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

  if (store.getAll<MarketplaceEntry>('marketplace').length === 0) {
    const entries: MarketplaceEntry[] = [
      {
        id: 'mkt_openai_runner',
        name: 'OpenAI GPT Runner',
        description: 'Run agent tasks using OpenAI Chat Completions API. Supports GPT-4o, GPT-4, and GPT-3.5.',
        version: '1.0.0',
        author: 'Command Center',
        category: 'runner',
        runnerType: 'openai',
        tags: ['ai', 'openai', 'gpt', 'cloud'],
        installed: true,
        rating: 4.8,
        downloads: 1250,
        config: {},
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 'mkt_anthropic_runner',
        name: 'Anthropic Claude Runner',
        description: 'Execute tasks using Anthropic Claude models. Supports Claude 3.5 Sonnet, Opus, and Haiku.',
        version: '0.9.0',
        author: 'Community',
        category: 'runner',
        runnerType: 'anthropic',
        tags: ['ai', 'anthropic', 'claude', 'cloud'],
        installed: false,
        rating: 4.6,
        downloads: 830,
        config: {},
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 'mkt_ollama_runner',
        name: 'Ollama Local Runner',
        description: 'Run models locally via Ollama. Zero cloud cost, full privacy. Supports Llama, Mistral, CodeLlama.',
        version: '0.8.0',
        author: 'Community',
        category: 'runner',
        runnerType: 'ollama',
        tags: ['ai', 'local', 'ollama', 'privacy'],
        installed: false,
        rating: 4.3,
        downloads: 560,
        config: {},
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 'mkt_slack_plugin',
        name: 'Slack Notifications',
        description: 'Send run completions, approval requests, and workflow updates to Slack channels.',
        version: '1.1.0',
        author: 'Command Center',
        category: 'plugin',
        runnerType: null,
        tags: ['notifications', 'slack', 'integration'],
        installed: false,
        rating: 4.5,
        downloads: 920,
        config: {},
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 'mkt_github_plugin',
        name: 'GitHub Integration',
        description: 'Auto-create PRs, issues, and comments from agent artifacts and run results.',
        version: '1.0.0',
        author: 'Command Center',
        category: 'plugin',
        runnerType: null,
        tags: ['github', 'git', 'integration', 'ci'],
        installed: false,
        rating: 4.7,
        downloads: 1100,
        config: {},
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 'mkt_metrics_plugin',
        name: 'Advanced Metrics',
        description: 'Detailed analytics dashboards with export to CSV, time-series charts, and custom reports.',
        version: '0.7.0',
        author: 'Community',
        category: 'plugin',
        runnerType: null,
        tags: ['analytics', 'metrics', 'reporting'],
        installed: false,
        rating: 4.1,
        downloads: 340,
        config: {},
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ];
    for (const entry of entries) store.put('marketplace', entry.id, entry);
  }

  if (store.getAll<User>('users').length === 0) {
    const user: User = {
      id: 'user_admin',
      name: 'Admin',
      email: 'admin@localhost',
      role: 'admin',
      avatar: null,
      createdAt: nowIso(),
      lastActiveAt: nowIso()
    };
    store.put('users', user.id, user);
  }
}

function appendRunLog(runId: string | null, line: string): void {
  if (!runId || process.env.VITEST) return;

  const logDir = path.join(process.cwd(), 'logs');
  void fs.promises.mkdir(logDir, { recursive: true }).then(() =>
    fs.promises.appendFile(path.join(logDir, `${runId}.log`), `${new Date().toISOString()} ${line}\n`)
  );
}
