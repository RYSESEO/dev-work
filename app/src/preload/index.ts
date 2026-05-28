import { contextBridge, ipcRenderer } from 'electron';
import type {
  AnalyticsSnapshot,
  ApiKey,
  ApiScope,
  AuditLogEntry,
  DashboardSnapshot,
  ExternalIntegration,
  LicenseStatus,
  Mission,
  Run,
  RunnerProfile,
  SafeUser,
  SandboxConfig,
  Task,
  User,
  WebhookEvent,
  WebhookServerConfig,
  WorkflowRun,
  WorkflowStep,
  WorkflowTemplate,
  Budget,
  BudgetPeriod,
  BudgetAction,
  CostIntelligenceSnapshot
} from '../shared/domain.js';

const commandCenter = {
  getSnapshot: (knownVersion?: number): Promise<DashboardSnapshot | null> =>
    ipcRenderer.invoke('dashboard:getSnapshot', knownVersion),

  // Auth
  login: (email: string, password: string): Promise<SafeUser> => ipcRenderer.invoke('auth:login', email, password),
  logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: (): Promise<SafeUser | null> => ipcRenderer.invoke('auth:currentUser'),
  requiresSetup: (): Promise<boolean> => ipcRenderer.invoke('auth:requiresSetup'),
  setupAdmin: (name: string, email: string, password: string): Promise<SafeUser> =>
    ipcRenderer.invoke('auth:setupAdmin', name, email, password),

  // Missions
  createMission: (title: string, goal: string): Promise<Mission> => ipcRenderer.invoke('mission:create', title, goal),
  updateMission: (id: string, fields: Partial<Pick<Mission, 'title' | 'goal' | 'status'>>): Promise<Mission> =>
    ipcRenderer.invoke('mission:update', id, fields),
  deleteMission: (id: string): Promise<void> => ipcRenderer.invoke('mission:delete', id),

  // Tasks
  createTask: (
    missionId: string | null,
    title: string,
    description: string,
    priority?: Task['priority']
  ): Promise<Task> => ipcRenderer.invoke('task:create', missionId, title, description, priority),
  updateTask: (id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>): Promise<Task> =>
    ipcRenderer.invoke('task:update', id, fields),
  deleteTask: (id: string): Promise<void> => ipcRenderer.invoke('task:delete', id),

  // Runs
  launchRun: (taskId: string, agentProfileId: string, prompt: string): Promise<Run> =>
    ipcRenderer.invoke('run:launch', taskId, agentProfileId, prompt),
  stopRun: (runId: string): Promise<void> => ipcRenderer.invoke('run:stop', runId),
  getRunLog: (runId: string): Promise<string> => ipcRenderer.invoke('run:log', runId),

  // Approvals
  approveRequest: (approvalRequestId: string): Promise<void> => ipcRenderer.invoke('approval:approve', approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string): Promise<void> =>
    ipcRenderer.invoke('approval:reject', approvalRequestId, reason),

  // Marketplace
  installMarketplaceEntry: (entryId: string): Promise<void> => ipcRenderer.invoke('marketplace:install', entryId),
  uninstallMarketplaceEntry: (entryId: string): Promise<void> => ipcRenderer.invoke('marketplace:uninstall', entryId),

  // Plugins
  togglePlugin: (pluginId: string, enabled: boolean): Promise<void> => ipcRenderer.invoke('plugin:toggle', pluginId, enabled),

  // Runner profiles
  addRunnerProfile: (profile: RunnerProfile): Promise<void> => ipcRenderer.invoke('runner:add', profile),
  removeRunnerProfile: (profileId: string): Promise<void> => ipcRenderer.invoke('runner:remove', profileId),
  updateRunnerProfile: (id: string, fields: Partial<Omit<RunnerProfile, 'id'>>): Promise<RunnerProfile> =>
    ipcRenderer.invoke('runner:update', id, fields),

  // Users
  createUser: (name: string, email: string, role: User['role'], password?: string): Promise<SafeUser> =>
    ipcRenderer.invoke('user:create', name, email, role, password),
  updateUserRole: (userId: string, role: User['role']): Promise<void> =>
    ipcRenderer.invoke('user:updateRole', userId, role),
  deleteUser: (userId: string): Promise<void> => ipcRenderer.invoke('user:delete', userId),
  setUserPassword: (userId: string, password: string): Promise<void> =>
    ipcRenderer.invoke('user:setPassword', userId, password),

  // Workflows
  createWorkflow: (name: string, description: string, steps: WorkflowStep[]): Promise<WorkflowTemplate> =>
    ipcRenderer.invoke('workflow:create', name, description, steps),
  updateWorkflow: (id: string, fields: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'steps'>>): Promise<WorkflowTemplate> =>
    ipcRenderer.invoke('workflow:update', id, fields),
  deleteWorkflow: (id: string): Promise<void> => ipcRenderer.invoke('workflow:delete', id),
  launchWorkflow: (workflowId: string, missionId: string | null): Promise<WorkflowRun> =>
    ipcRenderer.invoke('workflow:launch', workflowId, missionId),

  // Sandbox
  updateSandboxConfig: (config: Partial<SandboxConfig>): Promise<SandboxConfig> =>
    ipcRenderer.invoke('sandbox:update', config),

  // Analytics
  getAnalytics: (): Promise<AnalyticsSnapshot> => ipcRenderer.invoke('analytics:get'),

  // Audit log
  getAuditLog: (): Promise<AuditLogEntry[]> => ipcRenderer.invoke('audit:get'),

  // Data export
  exportData: (format: 'json' | 'csv'): Promise<string> => ipcRenderer.invoke('data:export', format),

  // License
  activateLicense: (key: string, email: string): Promise<LicenseStatus> =>
    ipcRenderer.invoke('license:activate', key, email),
  deactivateLicense: (): Promise<void> => ipcRenderer.invoke('license:deactivate'),
  getLicenseStatus: (): Promise<LicenseStatus> => ipcRenderer.invoke('license:status'),

  // Notifications
  getNotificationPrefs: (): Promise<{
    enabled: boolean;
    onApprovalRequest: boolean;
    onRunComplete: boolean;
    onRunFailed: boolean;
  }> => ipcRenderer.invoke('notifications:get'),
  setNotificationPrefs: (prefs: Partial<{
    enabled: boolean;
    onApprovalRequest: boolean;
    onRunComplete: boolean;
    onRunFailed: boolean;
  }>): Promise<{
    enabled: boolean;
    onApprovalRequest: boolean;
    onRunComplete: boolean;
    onRunFailed: boolean;
  }> => ipcRenderer.invoke('notifications:set', prefs),

  // Telemetry
  getTelemetryPrefs: (): Promise<{ enabled: boolean; webhookUrl: string }> =>
    ipcRenderer.invoke('telemetry:getPrefs'),
  setTelemetryPrefs: (update: Partial<{ enabled: boolean; webhookUrl: string }>): Promise<{ enabled: boolean; webhookUrl: string }> =>
    ipcRenderer.invoke('telemetry:setPrefs', update),
  getTelemetryEvents: (limit?: number): Promise<Array<{ id: string; event: string; properties: Record<string, string | number | boolean>; timestamp: string }>> =>
    ipcRenderer.invoke('telemetry:getEvents', limit),
  getTelemetrySummary: (): Promise<{ totalEvents: number; eventCounts: Record<string, number>; lastEvent: string | null }> =>
    ipcRenderer.invoke('telemetry:getSummary'),

  // Backup & restore
  createBackup: (targetPath: string): Promise<{ version: string; createdAt: string; collections: number; totalRecords: number }> =>
    ipcRenderer.invoke('backup:create', targetPath),
  restoreBackup: (sourcePath: string): Promise<{ version: string; createdAt: string; collections: number; totalRecords: number }> =>
    ipcRenderer.invoke('backup:restore', sourcePath),
  listBackups: (directory: string): Promise<Array<{ version: string; createdAt: string; collections: number; totalRecords: number }>> =>
    ipcRenderer.invoke('backup:list', directory),
  autoBackup: (dataDir: string): Promise<string> =>
    ipcRenderer.invoke('backup:auto', dataDir),

  // Webhook / API integration
  createApiKey: (name: string, scopes: ApiScope[]): Promise<{ key: Omit<ApiKey, 'keyHash'>; rawKey: string }> =>
    ipcRenderer.invoke('apiKey:create', name, scopes),
  revokeApiKey: (id: string): Promise<void> => ipcRenderer.invoke('apiKey:revoke', id),
  listApiKeys: (): Promise<Array<Omit<ApiKey, 'keyHash'>>> => ipcRenderer.invoke('apiKey:list'),
  getWebhookConfig: (): Promise<WebhookServerConfig> => ipcRenderer.invoke('webhook:getConfig'),
  updateWebhookConfig: (update: Partial<WebhookServerConfig>): Promise<WebhookServerConfig> =>
    ipcRenderer.invoke('webhook:updateConfig', update),
  getWebhookEvents: (limit?: number): Promise<WebhookEvent[]> => ipcRenderer.invoke('webhook:getEvents', limit),
  listIntegrations: (): Promise<ExternalIntegration[]> => ipcRenderer.invoke('integration:list'),
  createIntegration: (name: string, type: ExternalIntegration['type'], apiKeyId: string): Promise<ExternalIntegration> =>
    ipcRenderer.invoke('integration:create', name, type, apiKeyId),
  deleteIntegration: (id: string): Promise<void> => ipcRenderer.invoke('integration:delete', id),

  // Cost Intelligence
  getCostIntelligence: (): Promise<CostIntelligenceSnapshot> => ipcRenderer.invoke('cost:intelligence'),
  createBudget: (name: string, limitUsd: number, period: BudgetPeriod, action: BudgetAction): Promise<Budget> =>
    ipcRenderer.invoke('budget:create', name, limitUsd, period, action),
  updateBudget: (id: string, update: Partial<Pick<Budget, 'name' | 'limitUsd' | 'period' | 'action' | 'enabled'>>): Promise<Budget> =>
    ipcRenderer.invoke('budget:update', id, update),
  deleteBudget: (id: string): Promise<void> => ipcRenderer.invoke('budget:delete', id)
};

contextBridge.exposeInMainWorld('commandCenter', commandCenter);

export type CommandCenterApi = typeof commandCenter;
