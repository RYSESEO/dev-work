import fs from 'node:fs';
import path from 'node:path';
import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';
import { CommandRunner } from '../runners/commandRunner.js';
import { OpenAIRunner } from '../runners/openaiRunner.js';
import { AnthropicRunner } from '../runners/anthropicRunner.js';
import { OllamaRunner } from '../runners/ollamaRunner.js';
import { CustomHttpRunner } from '../runners/customHttpRunner.js';
import type { Runner, RunnerHandle } from '../runners/types.js';
import type { RunnerToHostMessage } from '../../shared/runnerProtocol.js';
import { notifyApprovalRequest, notifyRunComplete, notifyRunFailed } from '../notifications.js';
import { findMatchingGrant } from './approvalPolicy.js';
import { type AuthService, hashPassword, stripPasswordHash } from './auth.js';
import { createLicenseService } from './license.js';
import { createBillingService, type BillingService } from './billing.js';
import { createMarketplaceService } from './marketplace.js';
import { createPluginRuntime } from './pluginRuntime.js';
import { createTelemetryService, type TelemetryEvent, type TelemetryPreferences, type TelemetryService } from './telemetry.js';
import { createBackupService, type BackupMetadata, type BackupService } from './backup.js';
import { createApiKeyService, type ApiKeyService } from './apiKeys.js';
import { createWebhookServer, type WebhookServer } from './webhookServer.js';
import { createCostIntelligenceService, type CostIntelligenceService } from './costIntelligence.js';
import { createCollaborationService, type CollaborationService } from './collaboration.js';
import { createEnterpriseService, type EnterpriseService } from './enterprise.js';
import {
  createId,
  isTerminalRunStatus,
  nowIso,
  type AgentProfile,
  type AnalyticsSnapshot,
  type AuditLogEntry,
  type Artifact,
  type ApprovalGrant,
  type ApprovalRequest,
  type DashboardSnapshot,
  type LicenseStatus,
  type BillingConfig,
  type CheckoutSession,
  type PaidTier,
  type MarketplaceEntry,
  type Mission,
  type PluginDefinition,
  type Run,
  type RunnerProfile,
  type SafeUser,
  type SandboxConfig,
  type SignificantEvent,
  type Task,
  type User,
  type UsageEvent,
  type WorkflowRun,
  type WorkflowStep,
  type WorkflowStepResult,
  type WorkflowTemplate,
  type ApiKey,
  type ApiScope,
  type ExternalIntegration,
  type WebhookServerConfig,
  type WebhookEvent,
  type Budget,
  type BudgetPeriod,
  type BudgetAction,
  type CostIntelligenceSnapshot,
  type CollaborationSession,
  type CollaborationSnapshot,
  type SubTask,
  type SubTaskStatus,
  type AgentMessage,
  type AgentMessageType,
  type ConflictRecord,
  type CloudSyncConfig,
  type SyncRecord,
  type SsoConfig,
  type SandboxExecution,
  type ComplianceReport,
  type RestApiConfig,
  type RestApiStatus,
  type EnterpriseSnapshot
} from '../../shared/domain.js';

export interface Orchestrator {
  getSnapshot(): DashboardSnapshot;
  getStoreVersion(): number;
  // Auth
  login(email: string, password: string): SafeUser;
  logout(): void;
  getCurrentUser(): SafeUser | null;
  setupAdmin(name: string, email: string, password: string): SafeUser;
  requiresSetup(): boolean;
  // Missions
  createMission(title: string, goal: string): Mission;
  updateMission(id: string, fields: Partial<Pick<Mission, 'title' | 'goal' | 'status'>>): Mission;
  deleteMission(id: string): void;
  // Tasks
  createTask(missionId: string | null, title: string, description: string, priority?: Task['priority']): Task;
  updateTask(id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>): Task;
  deleteTask(id: string): void;
  // Runs
  launchRun(taskId: string, agentProfileId: string, prompt: string): Promise<Run>;
  stopRun(runId: string): void;
  getRunLog(runId: string): Promise<string>;
  // Approvals
  approveRequest(approvalRequestId: string): void;
  rejectRequest(approvalRequestId: string, reason: string): void;
  waitForRunEvent(runId: string, eventType: string, timeoutMs: number): Promise<void>;
  // Marketplace
  installMarketplaceEntry(entryId: string): void;
  uninstallMarketplaceEntry(entryId: string): void;
  togglePlugin(pluginId: string, enabled: boolean): void;
  // Runner profiles
  addRunnerProfile(profile: RunnerProfile): void;
  removeRunnerProfile(profileId: string): void;
  updateRunnerProfile(id: string, fields: Partial<Omit<RunnerProfile, 'id'>>): RunnerProfile;
  // Users
  createUser(name: string, email: string, role: User['role'], password?: string): SafeUser;
  updateUserRole(userId: string, role: User['role']): void;
  deleteUser(userId: string): void;
  setUserPassword(userId: string, password: string): void;
  // Workflows
  createWorkflow(name: string, description: string, steps: WorkflowStep[]): WorkflowTemplate;
  updateWorkflow(id: string, fields: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'steps'>>): WorkflowTemplate;
  deleteWorkflow(id: string): void;
  launchWorkflow(workflowId: string, missionId: string | null): Promise<WorkflowRun>;
  // Config
  updateSandboxConfig(config: Partial<SandboxConfig>): SandboxConfig;
  getAnalytics(): AnalyticsSnapshot;
  // Audit
  getAuditLog(): AuditLogEntry[];
  // Export
  exportData(format: 'json' | 'csv'): string;
  // License
  activateLicense(key: string, email: string): LicenseStatus;
  deactivateLicense(): void;
  getLicenseStatus(): LicenseStatus;
  // Billing
  getBillingConfig(): BillingConfig;
  updateBillingConfig(update: Partial<BillingConfig>): BillingConfig;
  createCheckoutSession(tier: PaidTier, email: string): CheckoutSession;
  // Telemetry
  getTelemetryPrefs(): TelemetryPreferences;
  setTelemetryPrefs(update: Partial<TelemetryPreferences>): TelemetryPreferences;
  getTelemetryEvents(limit?: number): TelemetryEvent[];
  getTelemetrySummary(): { totalEvents: number; eventCounts: Record<string, number>; lastEvent: string | null };
  // Backup & restore
  createBackup(targetPath: string): Promise<BackupMetadata>;
  restoreBackup(sourcePath: string): Promise<BackupMetadata>;
  listBackups(directory: string): Promise<BackupMetadata[]>;
  autoBackup(dataDir: string): Promise<string>;
  // Webhook / API integration
  createApiKey(name: string, scopes: ApiScope[]): { key: Omit<ApiKey, 'keyHash'>; rawKey: string };
  revokeApiKey(id: string): void;
  listApiKeys(): Array<Omit<ApiKey, 'keyHash'>>;
  getWebhookConfig(): WebhookServerConfig;
  updateWebhookConfig(update: Partial<WebhookServerConfig>): Promise<WebhookServerConfig>;
  getWebhookEvents(limit?: number): WebhookEvent[];
  getIntegrations(): ExternalIntegration[];
  createIntegration(name: string, type: ExternalIntegration['type'], apiKeyId: string): ExternalIntegration;
  deleteIntegration(id: string): void;
  // Cost Intelligence
  getCostIntelligence(): CostIntelligenceSnapshot;
  createBudget(name: string, limitUsd: number, period: BudgetPeriod, action: BudgetAction): Budget;
  updateBudget(id: string, update: Partial<Pick<Budget, 'name' | 'limitUsd' | 'period' | 'action' | 'enabled'>>): Budget;
  deleteBudget(id: string): void;
  // Collaboration
  getCollaboration(): CollaborationSnapshot;
  createCollabSession(title: string, description: string, strategy: CollaborationSession['strategy'], missionId: string | null, maxConcurrency?: number): CollaborationSession;
  deleteCollabSession(id: string): void;
  getCollabSession(id: string): CollaborationSession;
  updateCollabStatus(id: string, status: CollaborationSession['status']): CollaborationSession;
  addCollabSubTask(sessionId: string, title: string, description: string, dependsOn?: string[], priority?: SubTask['priority']): SubTask;
  updateCollabSubTaskStatus(sessionId: string, subTaskId: string, status: SubTaskStatus, output?: string): SubTask;
  assignCollabSubTask(sessionId: string, subTaskId: string, agentId: string): SubTask;
  deleteCollabSubTask(sessionId: string, subTaskId: string): void;
  assignCollabAgent(sessionId: string, agentId: string, role: string): void;
  removeCollabAgent(sessionId: string, agentId: string): void;
  setCollabContext(sessionId: string, key: string, value: string, setBy: string): void;
  sendCollabMessage(sessionId: string, fromAgentId: string, toAgentId: string | null, type: AgentMessageType, subject: string, body: string): AgentMessage;
  reportCollabConflict(sessionId: string, type: ConflictRecord['type'], description: string, involvedAgentIds: string[]): ConflictRecord;
  resolveCollabConflict(sessionId: string, conflictId: string, resolution: string): ConflictRecord;
  executeCollabSession(sessionId: string): Promise<void>;
  // Enterprise
  getEnterprise(): EnterpriseSnapshot;
  getCloudSyncConfig(): CloudSyncConfig;
  updateCloudSyncConfig(update: Partial<CloudSyncConfig>): CloudSyncConfig;
  triggerCloudSync(): SyncRecord[];
  getSsoConfig(): SsoConfig;
  updateSsoConfig(update: Partial<SsoConfig>): SsoConfig;
  buildSsoAuthUrl(): string;
  createSandboxExecution(runId: string, image: string, runtime: 'docker' | 'firecracker', networkPolicy: SandboxExecution['networkPolicy']): SandboxExecution;
  stopSandboxExecution(executionId: string): SandboxExecution;
  destroySandboxExecution(executionId: string): void;
  listSandboxExecutions(): SandboxExecution[];
  getComplianceReport(): ComplianceReport;
  getRestApiConfig(): RestApiConfig;
  updateRestApiConfig(update: Partial<RestApiConfig>): RestApiConfig;
  getRestApiStatus(): RestApiStatus;
  startRestApiServer(): Promise<void>;
  stopRestApiServer(): Promise<void>;
}

const noopAuth: AuthService = {
  login(): SafeUser { throw new Error('Auth not configured.'); },
  logout() {},
  getCurrentUser() { return null; },
  setPassword() { throw new Error('Auth not configured.'); },
  requiresSetup() { return true; }
};

export async function createOrchestrator(store: AppStore, auth: AuthService = noopAuth): Promise<Orchestrator> {
  const log = logger.child('orchestrator');
  const license = createLicenseService(store);
  const billing: BillingService = createBillingService(store);
  const packagesDir = path.join(process.cwd(), 'packages');
  const marketplace = createMarketplaceService(store, packagesDir);
  const pluginRuntime = createPluginRuntime(store);
  const telemetry: TelemetryService = createTelemetryService(store);
  const backup: BackupService = createBackupService(store);
  const apiKeysSvc: ApiKeyService = createApiKeyService(store);
  const webhookSrv: WebhookServer = createWebhookServer(store, apiKeysSvc);
  const costIntel: CostIntelligenceService = createCostIntelligenceService(store);
  const collab: CollaborationService = createCollaborationService(store);
  const enterprise: EnterpriseService = createEnterpriseService(store);
  seedDefaults(store);
  log.info('Orchestrator initialized');

  const whConfig = webhookSrv.getConfig();
  if (whConfig.enabled) {
    void webhookSrv.start().catch((err: unknown) =>
      log.error('Failed to auto-start webhook server', { error: err instanceof Error ? err.message : String(err) })
    );
  }

  function getLicenseStatusObj(): LicenseStatus {
    const limits = license.getLimits();
    const stored = license.getLicense();
    return {
      tier: limits.tier,
      maxAgents: limits.maxAgents,
      maxRunners: limits.maxRunners,
      maxUsers: limits.maxUsers,
      features: limits.features,
      validUntil: stored?.validUntil ?? null,
      activated: stored !== null
    };
  }

  function recordAudit(action: string, targetType: string, targetId: string, details: string): void {
    const currentUser = auth.getCurrentUser();
    const entry: AuditLogEntry = {
      id: createId('event'),
      userId: currentUser?.id ?? 'system',
      action,
      targetType,
      targetId,
      details,
      at: nowIso()
    };
    store.put('auditLog', entry.id, entry);
  }

  function requireAuth(): SafeUser | null {
    if (auth.requiresSetup()) return null;
    const user = auth.getCurrentUser();
    if (!user) throw new Error('Authentication required.');
    return user;
  }

  function requireRole(...roles: User['role'][]): SafeUser | null {
    if (auth.requiresSetup()) return null;
    const user = requireAuth();
    if (!user) throw new Error('Authentication required.');
    if (!roles.includes(user.role)) {
      throw new Error(`Insufficient permissions. Requires: ${roles.join(' or ')}`);
    }
    return user;
  }

  function requireFeature(feature: import('./license.js').LicenseFeature): void {
    if (!license.checkFeature(feature)) {
      throw new Error(`This feature requires a Pro or Team license. Please upgrade to access ${feature.replace(/_/g, ' ')}.`);
    }
  }

  const runners: Record<string, Runner> = {
    command: new CommandRunner(),
    openai: new OpenAIRunner(),
    anthropic: new AnthropicRunner(),
    ollama: new OllamaRunner(),
    'custom-http': new CustomHttpRunner()
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
    log.info(`Run finalized: ${status}`, { runId, body });

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
    void pluginRuntime.invokeHook('afterRunComplete', { runId: run.id, taskId: run.taskId });
    if (status === 'completed') notifyRunComplete(run.id);
    if (status === 'failed') notifyRunFailed(run.id, body);
    telemetry.track('run_finished', { runId: run.id, status });
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
      void pluginRuntime.invokeHook('onApprovalRequest', { runId, approvalId: request.id });
      notifyApprovalRequest(request.title);
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
      void pluginRuntime.invokeHook('onArtifactCreated', { runId, artifactId: artifact.id });
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

  const orch: Orchestrator = {
    getSnapshot(): DashboardSnapshot {
      const allEvents = store.getAll<SignificantEvent>('events');
      const allUsage = store.getAll<UsageEvent>('usage');
      return {
        missions: store.getAll<Mission>('missions'),
        tasks: store.getAll<Task>('tasks'),
        agents: store.getAll<AgentProfile>('agents'),
        runnerProfiles: store.getAll<RunnerProfile>('runnerProfiles'),
        runs: store.getAll<Run>('runs'),
        approvals: store.getAll<ApprovalRequest>('approvals'),
        grants: store.getAll<ApprovalGrant>('grants'),
        usage: allUsage.slice(-100),
        events: allEvents.slice(-50),
        artifacts: store.getAll<Artifact>('artifacts'),
        marketplace: store.getAll<MarketplaceEntry>('marketplace'),
        plugins: store.getAll<PluginDefinition>('plugins'),
        users: store.getAll<User>('users').map(stripPasswordHash),
        workflows: store.getAll<WorkflowTemplate>('workflows'),
        workflowRuns: store.getAll<WorkflowRun>('workflowRuns'),
        currentUser: auth.getCurrentUser() ?? (auth.requiresSetup() ? store.getAll<User>('users').map(stripPasswordHash)[0] ?? null : null),
        analytics: null,
        sandboxConfig: getSandboxConfig(),
        license: getLicenseStatusObj(),
        billing: billing.getConfig(),
        integrations: webhookSrv.getIntegrations(),
        apiKeys: apiKeysSvc.list(),
        webhookServer: webhookSrv.getConfig(),
        costIntelligence: costIntel.getSnapshot(),
        collaboration: collab.getSnapshot(),
        enterprise: enterprise.getSnapshot(),
        storeVersion: store.getVersion()
      };
    },
    getStoreVersion(): number {
      return store.getVersion();
    },
    login(email: string, password: string): SafeUser {
      return auth.login(email, password);
    },
    logout(): void {
      auth.logout();
    },
    getCurrentUser(): SafeUser | null {
      return auth.getCurrentUser();
    },
    setupAdmin(name: string, email: string, password: string): SafeUser {
      if (!auth.requiresSetup()) throw new Error('Admin already configured.');
      const at = nowIso();
      const user: User = {
        id: createId('user'),
        name: name.trim(),
        email: email.trim(),
        role: 'admin',
        avatar: null,
        passwordHash: hashPassword(password),
        createdAt: at,
        lastActiveAt: at
      };
      store.put('users', user.id, user);
      const safeUser = auth.login(email, password);
      recordAudit('setup_admin', 'user', user.id, `Admin ${name} created during initial setup`);
      return safeUser;
    },
    requiresSetup(): boolean {
      return auth.requiresSetup();
    },
    createMission(title: string, goal: string): Mission {
      if (!title.trim()) throw new Error('Mission title is required.');
      if (!goal.trim()) throw new Error('Mission goal is required.');
      requireRole('admin', 'operator');
      log.info('Creating mission', { title });
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
      recordAudit('create', 'mission', mission.id, title);
      void pluginRuntime.invokeHook('onMissionCreated', { missionId: mission.id });
      telemetry.track('mission_created', { missionId: mission.id });
      return mission;
    },
    updateMission(id: string, fields: Partial<Pick<Mission, 'title' | 'goal' | 'status'>>): Mission {
      requireRole('admin', 'operator');
      const mission = store.getById<Mission>('missions', id);
      if (!mission) throw new Error(`Mission not found: ${id}`);
      const updated = { ...mission, ...fields, updatedAt: nowIso() };
      store.put('missions', id, updated);
      log.info('Mission updated', { id, fields });
      recordAudit('update', 'mission', id, JSON.stringify(fields));
      return updated;
    },
    deleteMission(id: string): void {
      requireRole('admin');
      const mission = store.getById<Mission>('missions', id);
      if (!mission) throw new Error(`Mission not found: ${id}`);
      store.remove('missions', id);
      log.info('Mission deleted', { id });
      recordAudit('delete', 'mission', id, mission.title);
    },
    createTask(missionId: string | null, title: string, description: string, priority: Task['priority'] = 'normal'): Task {
      if (!title.trim()) throw new Error('Task title is required.');
      requireRole('admin', 'operator');
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
      recordAudit('create', 'task', task.id, title);
      void pluginRuntime.invokeHook('onTaskCreated', { taskId: task.id, missionId: missionId ?? undefined });
      return task;
    },
    updateTask(id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>): Task {
      requireRole('admin', 'operator');
      const task = store.getById<Task>('tasks', id);
      if (!task) throw new Error(`Task not found: ${id}`);
      const updated = { ...task, ...fields, updatedAt: nowIso() };
      store.put('tasks', id, updated);
      log.info('Task updated', { id, fields });
      recordAudit('update', 'task', id, JSON.stringify(fields));
      return updated;
    },
    deleteTask(id: string): void {
      requireRole('admin');
      const task = store.getById<Task>('tasks', id);
      if (!task) throw new Error(`Task not found: ${id}`);
      store.remove('tasks', id);
      log.info('Task deleted', { id });
      recordAudit('delete', 'task', id, task.title);
    },
    async launchRun(taskId: string, agentProfileId: string, prompt: string): Promise<Run> {
      requireRole('admin', 'operator');
      log.info('Launching run', { taskId, agentProfileId });
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
      void pluginRuntime.invokeHook('beforeRunStart', { runId: run.id, taskId });
      telemetry.track('run_started', { runId: run.id, taskId, agentId: agent.id, runnerType: profile.type });

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
    stopRun(runId: string): void {
      requireRole('admin', 'operator');
      const run = store.getById<Run>('runs', runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      if (isTerminalRunStatus(run.status)) throw new Error(`Run already in terminal state: ${run.status}`);
      const handle = handles.get(runId);
      if (handle) {
        handle.stop('Stopped by user');
      }
      finalizeRun(runId, 'stopped', 'Stopped by user.');
      log.info('Run stopped by user', { runId });
    },
    async getRunLog(runId: string): Promise<string> {
      const logFile = path.join(process.cwd(), 'logs', `${runId}.log`);
      try {
        return await fs.promises.readFile(logFile, 'utf-8');
      } catch {
        return '';
      }
    },
    approveRequest(approvalRequestId: string): void {
      requireRole('admin', 'operator');
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
      requireRole('admin', 'operator');
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
      requireRole('admin');
      const entry = marketplace.installEntry(entryId);
      recordAudit('install', 'marketplace', entryId, entry.name);
    },
    uninstallMarketplaceEntry(entryId: string): void {
      requireRole('admin');
      marketplace.uninstallEntry(entryId);
      recordAudit('uninstall', 'marketplace', entryId, '');
    },
    togglePlugin(pluginId: string, enabled: boolean): void {
      requireRole('admin');
      const plugin = store.getById<PluginDefinition>('plugins', pluginId);
      if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
      store.put('plugins', plugin.id, { ...plugin, enabled });
    },
    addRunnerProfile(profile: RunnerProfile): void {
      requireRole('admin');
      store.put('runnerProfiles', profile.id, profile);
      recordAudit('create', 'runnerProfile', profile.id, profile.name);
    },
    removeRunnerProfile(profileId: string): void {
      requireRole('admin');
      store.remove('runnerProfiles', profileId);
      recordAudit('delete', 'runnerProfile', profileId, '');
    },
    updateRunnerProfile(id: string, fields: Partial<Omit<RunnerProfile, 'id'>>): RunnerProfile {
      requireRole('admin');
      const profile = store.getById<RunnerProfile>('runnerProfiles', id);
      if (!profile) throw new Error(`Runner profile not found: ${id}`);
      const updated = { ...profile, ...fields } as RunnerProfile;
      store.put('runnerProfiles', id, updated);
      log.info('Runner profile updated', { id });
      return updated;
    },
    createUser(name: string, email: string, role: User['role'], password?: string): SafeUser {
      requireRole('admin');
      if (!name.trim()) throw new Error('User name is required.');
      if (!email.trim()) throw new Error('User email is required.');
      const existing = store.getAll<User>('users').find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) throw new Error('A user with that email already exists.');
      const at = nowIso();
      const user: User = {
        id: createId('user'),
        name: name.trim(),
        email: email.trim(),
        role,
        avatar: null,
        passwordHash: password ? hashPassword(password) : null,
        createdAt: at,
        lastActiveAt: at
      };
      store.put('users', user.id, user);
      log.info('User created', { userId: user.id, email: user.email, role });
      recordAudit('create', 'user', user.id, `${name} (${role})`);
      return stripPasswordHash(user);
    },
    updateUserRole(userId: string, role: User['role']): void {
      requireRole('admin');
      const user = store.getById<User>('users', userId);
      if (!user) throw new Error(`User not found: ${userId}`);
      store.put('users', user.id, { ...user, role });
      log.info('User role updated', { userId, role });
      recordAudit('update', 'user', userId, `Role changed to ${role}`);
    },
    deleteUser(userId: string): void {
      requireRole('admin');
      const user = store.getById<User>('users', userId);
      if (!user) throw new Error(`User not found: ${userId}`);
      store.remove('users', userId);
      log.info('User deleted', { userId });
      recordAudit('delete', 'user', userId, user.name);
    },
    setUserPassword(userId: string, password: string): void {
      requireRole('admin');
      auth.setPassword(userId, password);
      recordAudit('update', 'user', userId, 'Password changed');
    },
    createWorkflow(name: string, description: string, steps: WorkflowStep[]): WorkflowTemplate {
      requireRole('admin', 'operator');
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
      recordAudit('create', 'workflow', workflow.id, name);
      return workflow;
    },
    updateWorkflow(id: string, fields: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'steps'>>): WorkflowTemplate {
      requireRole('admin', 'operator');
      const workflow = store.getById<WorkflowTemplate>('workflows', id);
      if (!workflow) throw new Error(`Workflow not found: ${id}`);
      const updated = { ...workflow, ...fields, updatedAt: nowIso() };
      store.put('workflows', id, updated);
      log.info('Workflow updated', { id });
      recordAudit('update', 'workflow', id, JSON.stringify(fields));
      return updated;
    },
    deleteWorkflow(id: string): void {
      requireRole('admin');
      const workflow = store.getById<WorkflowTemplate>('workflows', id);
      if (!workflow) throw new Error(`Workflow not found: ${id}`);
      store.remove('workflows', id);
      log.info('Workflow deleted', { id });
      recordAudit('delete', 'workflow', id, workflow.name);
    },
    async launchWorkflow(workflowId: string, missionId: string | null): Promise<WorkflowRun> {
      requireRole('admin', 'operator');
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
      recordAudit('launch', 'workflow', workflowRun.id, workflow.name);
      return workflowRun;
    },
    updateSandboxConfig(config: Partial<SandboxConfig>): SandboxConfig {
      requireRole('admin');
      const current = getSandboxConfig();
      const updated: SandboxConfig = { ...current, ...config };
      store.put('sandboxConfig', 'default', { id: 'default', ...updated });
      recordAudit('update', 'sandboxConfig', 'default', JSON.stringify(config));
      return updated;
    },
    getAnalytics(): AnalyticsSnapshot {
      return computeAnalytics();
    },
    getAuditLog(): AuditLogEntry[] {
      requireRole('admin');
      return store.getAll<AuditLogEntry>('auditLog');
    },
    exportData(format: 'json' | 'csv'): string {
      requireRole('admin');
      const missions = store.getAll<Mission>('missions');
      const tasks = store.getAll<Task>('tasks');
      const runs = store.getAll<Run>('runs');
      const analytics = computeAnalytics();

      if (format === 'json') {
        return JSON.stringify({ missions, tasks, runs, analytics }, null, 2);
      }

      const lines: string[] = [];
      lines.push('--- Missions ---');
      lines.push('id,title,goal,status,createdAt,updatedAt');
      for (const m of missions) {
        lines.push(`${m.id},"${m.title}","${m.goal}",${m.status},${m.createdAt},${m.updatedAt}`);
      }
      lines.push('');
      lines.push('--- Tasks ---');
      lines.push('id,missionId,title,status,priority,createdAt,updatedAt');
      for (const t of tasks) {
        lines.push(`${t.id},${t.missionId ?? ''},"${t.title}",${t.status},${t.priority},${t.createdAt},${t.updatedAt}`);
      }
      lines.push('');
      lines.push('--- Runs ---');
      lines.push('id,taskId,agentProfileId,status,startedAt,completedAt,estimatedCostUsd,estimatedTokens');
      for (const r of runs) {
        lines.push(`${r.id},${r.taskId},${r.agentProfileId},${r.status},${r.startedAt},${r.completedAt ?? ''},${r.estimatedCostUsd},${r.estimatedTokens}`);
      }
      lines.push('');
      lines.push('--- Analytics ---');
      lines.push(`totalRuns,${analytics.totalRuns}`);
      const rate = analytics.totalRuns > 0 ? ((analytics.successfulRuns / analytics.totalRuns) * 100).toFixed(1) : '0';
      lines.push(`successRate,${rate}%`);
      lines.push(`totalCostUsd,${analytics.totalCostUsd}`);
      lines.push(`totalTokens,${analytics.totalTokens}`);
      return lines.join('\n');
    },
    activateLicense(key: string, email: string): LicenseStatus {
      requireRole('admin');
      const info = license.activate(key, email);
      recordAudit('activate', 'license', 'license', `Tier: ${info.tier}, email: ${info.email}`);
      return getLicenseStatusObj();
    },
    deactivateLicense(): void {
      requireRole('admin');
      license.deactivate();
      recordAudit('deactivate', 'license', 'license', '');
    },
    getLicenseStatus(): LicenseStatus {
      return getLicenseStatusObj();
    },
    getBillingConfig(): BillingConfig {
      return billing.getConfig();
    },
    updateBillingConfig(update: Partial<BillingConfig>): BillingConfig {
      requireRole('admin');
      const config = billing.setConfig(update);
      recordAudit('update', 'billing', 'billing', `Provider: ${config.provider}`);
      return config;
    },
    createCheckoutSession(tier: PaidTier, email: string): CheckoutSession {
      return billing.createCheckoutSession(tier, email);
    },

    // Telemetry
    getTelemetryPrefs(): TelemetryPreferences {
      return telemetry.getPreferences();
    },
    setTelemetryPrefs(update: Partial<TelemetryPreferences>): TelemetryPreferences {
      return telemetry.setPreferences(update);
    },
    getTelemetryEvents(limit?: number): TelemetryEvent[] {
      return telemetry.getEvents(limit);
    },
    getTelemetrySummary() {
      return telemetry.getSummary();
    },
    async createBackup(targetPath: string): Promise<BackupMetadata> {
      requireRole('admin');
      return backup.createBackup(targetPath);
    },
    async restoreBackup(sourcePath: string): Promise<BackupMetadata> {
      requireRole('admin');
      return backup.restoreBackup(sourcePath);
    },
    async listBackups(directory: string): Promise<BackupMetadata[]> {
      return backup.listBackups(directory);
    },
    async autoBackup(dataDir: string): Promise<string> {
      return backup.autoBackup(dataDir);
    },
    // Webhook / API integration
    createApiKey(name: string, scopes: ApiScope[]): { key: Omit<ApiKey, 'keyHash'>; rawKey: string } {
      requireRole('admin');
      const result = apiKeysSvc.create(name, scopes);
      recordAudit('apiKey:create', 'apiKey', result.key.id, `Created API key: ${name}`);
      const { keyHash: _unused, ...safe } = result.key;
      void _unused;
      return { key: safe, rawKey: result.rawKey };
    },
    revokeApiKey(id: string): void {
      requireRole('admin');
      apiKeysSvc.revoke(id);
      recordAudit('apiKey:revoke', 'apiKey', id, 'Revoked API key');
    },
    listApiKeys(): Array<Omit<ApiKey, 'keyHash'>> {
      return apiKeysSvc.list();
    },
    getWebhookConfig(): WebhookServerConfig {
      return webhookSrv.getConfig();
    },
    async updateWebhookConfig(update: Partial<WebhookServerConfig>): Promise<WebhookServerConfig> {
      requireRole('admin');
      const config = webhookSrv.updateConfig(update);
      if (config.enabled && !webhookSrv.isRunning()) {
        await webhookSrv.start();
      } else if (!config.enabled && webhookSrv.isRunning()) {
        await webhookSrv.stop();
      }
      recordAudit('webhook:config', 'webhook', 'config', `Updated webhook config: enabled=${config.enabled}, port=${config.port}`);
      return config;
    },
    getWebhookEvents(limit?: number): WebhookEvent[] {
      return webhookSrv.getEvents(limit);
    },
    getIntegrations(): ExternalIntegration[] {
      return webhookSrv.getIntegrations();
    },
    createIntegration(name: string, type: ExternalIntegration['type'], apiKeyId: string): ExternalIntegration {
      requireRole('admin');
      const integration = webhookSrv.createIntegration(name, type, apiKeyId);
      recordAudit('integration:create', 'integration', integration.id, `Created integration: ${name} (${type})`);
      return integration;
    },
    deleteIntegration(id: string): void {
      requireRole('admin');
      webhookSrv.deleteIntegration(id);
      recordAudit('integration:delete', 'integration', id, 'Deleted integration');
    },
    getCostIntelligence(): CostIntelligenceSnapshot {
      return costIntel.getSnapshot();
    },
    createBudget(name: string, limitUsd: number, period: BudgetPeriod, action: BudgetAction): Budget {
      requireRole('admin');
      const budget = costIntel.createBudget(name, limitUsd, period, action);
      recordAudit('budget:create', 'budget', budget.id, `Created budget: ${name} ($${limitUsd}/${period})`);
      return budget;
    },
    updateBudget(id: string, update: Partial<Pick<Budget, 'name' | 'limitUsd' | 'period' | 'action' | 'enabled'>>): Budget {
      requireRole('admin');
      const budget = costIntel.updateBudget(id, update);
      recordAudit('budget:update', 'budget', id, `Updated budget: ${budget.name}`);
      return budget;
    },
    deleteBudget(id: string): void {
      requireRole('admin');
      costIntel.deleteBudget(id);
      recordAudit('budget:delete', 'budget', id, 'Deleted budget');
    },
    getCollaboration(): CollaborationSnapshot {
      return collab.getSnapshot();
    },
    createCollabSession(title, description, strategy, missionId, maxConcurrency): CollaborationSession {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      const session = collab.createSession(title, description, strategy, missionId, maxConcurrency);
      recordAudit('collab:create', 'collaboration', session.id, `Created session: ${title}`);
      return session;
    },
    deleteCollabSession(id: string): void {
      requireRole('admin');
      requireFeature('multi_agent_collaboration');
      collab.deleteSession(id);
      recordAudit('collab:delete', 'collaboration', id, 'Deleted collaboration session');
    },
    getCollabSession(id: string): CollaborationSession {
      return collab.getSession(id);
    },
    updateCollabStatus(id, status): CollaborationSession {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      const session = collab.updateSessionStatus(id, status);
      recordAudit('collab:status', 'collaboration', id, `Status changed to ${status}`);
      return session;
    },
    addCollabSubTask(sessionId, title, description, dependsOn, priority): SubTask {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      const st = collab.addSubTask(sessionId, title, description, dependsOn, priority);
      recordAudit('collab:subtask:add', 'collaboration', sessionId, `Added sub-task: ${title}`);
      return st;
    },
    updateCollabSubTaskStatus(sessionId, subTaskId, status, output): SubTask {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      return collab.updateSubTaskStatus(sessionId, subTaskId, status, output);
    },
    assignCollabSubTask(sessionId, subTaskId, agentId): SubTask {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      const st = collab.assignSubTask(sessionId, subTaskId, agentId);
      recordAudit('collab:subtask:assign', 'collaboration', sessionId, `Assigned ${subTaskId} to ${agentId}`);
      return st;
    },
    deleteCollabSubTask(sessionId, subTaskId): void {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      collab.deleteSubTask(sessionId, subTaskId);
    },
    assignCollabAgent(sessionId, agentId, role): void {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      collab.assignAgent(sessionId, agentId, role);
      recordAudit('collab:agent:assign', 'collaboration', sessionId, `Assigned agent ${agentId} as ${role}`);
    },
    removeCollabAgent(sessionId, agentId): void {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      collab.removeAgent(sessionId, agentId);
    },
    setCollabContext(sessionId, key, value, setBy): void {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      collab.setContext(sessionId, key, value, setBy);
    },
    sendCollabMessage(sessionId, fromAgentId, toAgentId, type, subject, body): AgentMessage {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      return collab.sendMessage(sessionId, fromAgentId, toAgentId, type, subject, body);
    },
    reportCollabConflict(sessionId, type, description, involvedAgentIds): ConflictRecord {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      const conflict = collab.reportConflict(sessionId, type, description, involvedAgentIds);
      recordAudit('collab:conflict', 'collaboration', sessionId, `Conflict: ${description}`);
      return conflict;
    },
    resolveCollabConflict(sessionId, conflictId, resolution): ConflictRecord {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      const conflict = collab.resolveConflict(sessionId, conflictId, resolution);
      recordAudit('collab:conflict:resolve', 'collaboration', sessionId, `Resolved conflict ${conflictId}`);
      return conflict;
    },
    async executeCollabSession(sessionId: string): Promise<void> {
      requireRole('admin', 'operator');
      requireFeature('multi_agent_collaboration');
      await collab.executeSession(sessionId, (taskId, agentId, prompt) =>
        orch.launchRun(taskId, agentId, prompt)
      );
    },
    // ── Enterprise ────────────────────────────────────────────────
    getEnterprise(): EnterpriseSnapshot {
      return enterprise.getSnapshot();
    },
    getCloudSyncConfig(): CloudSyncConfig {
      return enterprise.cloudSync.getConfig();
    },
    updateCloudSyncConfig(update: Partial<CloudSyncConfig>): CloudSyncConfig {
      requireRole('admin');
      requireFeature('cloud_sync');
      const config = enterprise.cloudSync.updateConfig(update);
      recordAudit('enterprise:cloudSync:update', 'enterprise', 'cloudSync', `Cloud sync ${config.enabled ? 'enabled' : 'disabled'}`);
      return config;
    },
    triggerCloudSync(): SyncRecord[] {
      requireRole('admin', 'operator');
      requireFeature('cloud_sync');
      const records = enterprise.cloudSync.triggerSync();
      recordAudit('enterprise:cloudSync:trigger', 'enterprise', 'cloudSync', `Synced ${records.length} records`);
      return records;
    },
    getSsoConfig(): SsoConfig {
      return enterprise.sso.getConfig();
    },
    updateSsoConfig(update: Partial<SsoConfig>): SsoConfig {
      requireRole('admin');
      requireFeature('sso_auth');
      const config = enterprise.sso.updateConfig(update);
      recordAudit('enterprise:sso:update', 'enterprise', 'sso', `SSO ${config.enabled ? 'enabled' : 'disabled'} via ${config.provider}`);
      return config;
    },
    buildSsoAuthUrl(): string {
      return enterprise.sso.buildAuthUrl();
    },
    createSandboxExecution(runId, image, runtime, networkPolicy): SandboxExecution {
      requireRole('admin', 'operator');
      requireFeature('sandbox_execution');
      const exec = enterprise.sandbox.createExecution(runId, image, runtime, networkPolicy);
      recordAudit('enterprise:sandbox:create', 'enterprise', exec.id, `Sandbox ${runtime} for run ${runId}`);
      return exec;
    },
    stopSandboxExecution(executionId): SandboxExecution {
      requireRole('admin', 'operator');
      requireFeature('sandbox_execution');
      return enterprise.sandbox.stopExecution(executionId);
    },
    destroySandboxExecution(executionId): void {
      requireRole('admin');
      requireFeature('sandbox_execution');
      enterprise.sandbox.destroyExecution(executionId);
      recordAudit('enterprise:sandbox:destroy', 'enterprise', executionId, 'Sandbox destroyed');
    },
    listSandboxExecutions(): SandboxExecution[] {
      return enterprise.sandbox.listExecutions();
    },
    getComplianceReport(): ComplianceReport {
      requireRole('admin');
      return enterprise.compliance.generateReport();
    },
    getRestApiConfig(): RestApiConfig {
      return enterprise.restApi.getConfig();
    },
    updateRestApiConfig(update: Partial<RestApiConfig>): RestApiConfig {
      requireRole('admin');
      requireFeature('rest_api_server');
      const config = enterprise.restApi.updateConfig(update);
      recordAudit('enterprise:restApi:update', 'enterprise', 'restApi', `REST API ${config.enabled ? 'enabled' : 'disabled'} on port ${config.port}`);
      return config;
    },
    getRestApiStatus(): RestApiStatus {
      return enterprise.restApi.getStatus();
    },
    async startRestApiServer(): Promise<void> {
      requireRole('admin');
      requireFeature('rest_api_server');
      await enterprise.restApi.start();
      recordAudit('enterprise:restApi:start', 'enterprise', 'restApi', 'REST API server started');
    },
    async stopRestApiServer(): Promise<void> {
      requireRole('admin');
      requireFeature('rest_api_server');
      await enterprise.restApi.stop();
      recordAudit('enterprise:restApi:stop', 'enterprise', 'restApi', 'REST API server stopped');
    }
  };

  return orch;

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
      passwordHash: null,
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
