import type {
  Mission, RunnerProfile, SandboxConfig, Task, User, WorkflowStep, WorkflowTemplate,
  ApiScope, ExternalIntegration, WebhookServerConfig,
  BudgetPeriod, BudgetAction, Budget,
  CollaborationSession, SubTask, SubTaskStatus, AgentMessageType, ConflictRecord
} from '../../../shared/domain';

export const commandCenterClient = {
  getSnapshot: (knownVersion?: number) => window.commandCenter.getSnapshot(knownVersion),

  // Auth
  login: (email: string, password: string) => window.commandCenter.login(email, password),
  logout: () => window.commandCenter.logout(),
  getCurrentUser: () => window.commandCenter.getCurrentUser(),
  requiresSetup: () => window.commandCenter.requiresSetup(),
  setupAdmin: (name: string, email: string, password: string) =>
    window.commandCenter.setupAdmin(name, email, password),

  // Missions
  createMission: (title: string, goal: string) => window.commandCenter.createMission(title, goal),
  updateMission: (id: string, fields: Partial<Pick<Mission, 'title' | 'goal' | 'status'>>) =>
    window.commandCenter.updateMission(id, fields),
  deleteMission: (id: string) => window.commandCenter.deleteMission(id),

  // Tasks
  createTask: (missionId: string | null, title: string, description: string, priority?: 'low' | 'normal' | 'high') =>
    window.commandCenter.createTask(missionId, title, description, priority),
  updateTask: (id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>) =>
    window.commandCenter.updateTask(id, fields),
  deleteTask: (id: string) => window.commandCenter.deleteTask(id),

  // Runs
  launchRun: (taskId: string, agentProfileId: string, prompt: string) =>
    window.commandCenter.launchRun(taskId, agentProfileId, prompt),
  stopRun: (runId: string) => window.commandCenter.stopRun(runId),
  getRunLog: (runId: string) => window.commandCenter.getRunLog(runId),

  // Approvals
  approveRequest: (approvalRequestId: string) => window.commandCenter.approveRequest(approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string) => window.commandCenter.rejectRequest(approvalRequestId, reason),

  // Marketplace
  installMarketplaceEntry: (entryId: string) => window.commandCenter.installMarketplaceEntry(entryId),
  uninstallMarketplaceEntry: (entryId: string) => window.commandCenter.uninstallMarketplaceEntry(entryId),

  // Plugins
  togglePlugin: (pluginId: string, enabled: boolean) => window.commandCenter.togglePlugin(pluginId, enabled),

  // Runner profiles
  addRunnerProfile: (profile: RunnerProfile) => window.commandCenter.addRunnerProfile(profile),
  removeRunnerProfile: (profileId: string) => window.commandCenter.removeRunnerProfile(profileId),
  updateRunnerProfile: (id: string, fields: Partial<Omit<RunnerProfile, 'id'>>) =>
    window.commandCenter.updateRunnerProfile(id, fields),

  // Users
  createUser: (name: string, email: string, role: User['role'], password?: string) =>
    window.commandCenter.createUser(name, email, role, password),
  updateUserRole: (userId: string, role: User['role']) => window.commandCenter.updateUserRole(userId, role),
  deleteUser: (userId: string) => window.commandCenter.deleteUser(userId),
  setUserPassword: (userId: string, password: string) => window.commandCenter.setUserPassword(userId, password),

  // Workflows
  createWorkflow: (name: string, description: string, steps: WorkflowStep[]) =>
    window.commandCenter.createWorkflow(name, description, steps),
  updateWorkflow: (id: string, fields: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'steps'>>) =>
    window.commandCenter.updateWorkflow(id, fields),
  deleteWorkflow: (id: string) => window.commandCenter.deleteWorkflow(id),
  launchWorkflow: (workflowId: string, missionId: string | null) =>
    window.commandCenter.launchWorkflow(workflowId, missionId),

  // Sandbox
  updateSandboxConfig: (config: Partial<SandboxConfig>) => window.commandCenter.updateSandboxConfig(config),

  // Analytics
  getAnalytics: () => window.commandCenter.getAnalytics(),

  // Audit log
  getAuditLog: () => window.commandCenter.getAuditLog(),

  // Data export
  exportData: (format: 'json' | 'csv') => window.commandCenter.exportData(format),

  // License
  activateLicense: (key: string, email: string) => window.commandCenter.activateLicense(key, email),
  deactivateLicense: () => window.commandCenter.deactivateLicense(),
  getLicenseStatus: () => window.commandCenter.getLicenseStatus(),

  // Notifications
  getNotificationPrefs: () => window.commandCenter.getNotificationPrefs(),
  setNotificationPrefs: (prefs: Partial<{
    enabled: boolean;
    onApprovalRequest: boolean;
    onRunComplete: boolean;
    onRunFailed: boolean;
  }>) => window.commandCenter.setNotificationPrefs(prefs),

  // Telemetry
  getTelemetryPrefs: () => window.commandCenter.getTelemetryPrefs(),
  setTelemetryPrefs: (update: Partial<{ enabled: boolean; webhookUrl: string }>) =>
    window.commandCenter.setTelemetryPrefs(update),
  getTelemetryEvents: (limit?: number) => window.commandCenter.getTelemetryEvents(limit),
  getTelemetrySummary: () => window.commandCenter.getTelemetrySummary(),

  // Backup & restore
  createBackup: (targetPath: string) => window.commandCenter.createBackup(targetPath),
  restoreBackup: (sourcePath: string) => window.commandCenter.restoreBackup(sourcePath),
  listBackups: (directory: string) => window.commandCenter.listBackups(directory),
  autoBackup: (dataDir: string) => window.commandCenter.autoBackup(dataDir),

  // Webhook / API integration
  createApiKey: (name: string, scopes: ApiScope[]) => window.commandCenter.createApiKey(name, scopes),
  revokeApiKey: (id: string) => window.commandCenter.revokeApiKey(id),
  listApiKeys: () => window.commandCenter.listApiKeys(),
  getWebhookConfig: () => window.commandCenter.getWebhookConfig(),
  updateWebhookConfig: (update: Partial<WebhookServerConfig>) => window.commandCenter.updateWebhookConfig(update),
  getWebhookEvents: (limit?: number) => window.commandCenter.getWebhookEvents(limit),
  listIntegrations: () => window.commandCenter.listIntegrations(),
  createIntegration: (name: string, type: ExternalIntegration['type'], apiKeyId: string) =>
    window.commandCenter.createIntegration(name, type, apiKeyId),
  deleteIntegration: (id: string) => window.commandCenter.deleteIntegration(id),

  // Cost Intelligence
  getCostIntelligence: () => window.commandCenter.getCostIntelligence(),
  createBudget: (name: string, limitUsd: number, period: BudgetPeriod, action: BudgetAction) =>
    window.commandCenter.createBudget(name, limitUsd, period, action),
  updateBudget: (id: string, update: Partial<Pick<Budget, 'name' | 'limitUsd' | 'period' | 'action' | 'enabled'>>) =>
    window.commandCenter.updateBudget(id, update),
  deleteBudget: (id: string) => window.commandCenter.deleteBudget(id),

  // Collaboration
  getCollaboration: () => window.commandCenter.getCollaboration(),
  createCollabSession: (title: string, description: string, strategy: CollaborationSession['strategy'], missionId: string | null, maxConcurrency?: number) =>
    window.commandCenter.createCollabSession(title, description, strategy, missionId, maxConcurrency),
  deleteCollabSession: (id: string) => window.commandCenter.deleteCollabSession(id),
  getCollabSession: (id: string) => window.commandCenter.getCollabSession(id),
  updateCollabStatus: (id: string, status: CollaborationSession['status']) =>
    window.commandCenter.updateCollabStatus(id, status),
  addCollabSubTask: (sessionId: string, title: string, description: string, dependsOn?: string[], priority?: SubTask['priority']) =>
    window.commandCenter.addCollabSubTask(sessionId, title, description, dependsOn, priority),
  updateCollabSubTaskStatus: (sessionId: string, subTaskId: string, status: SubTaskStatus, output?: string) =>
    window.commandCenter.updateCollabSubTaskStatus(sessionId, subTaskId, status, output),
  assignCollabSubTask: (sessionId: string, subTaskId: string, agentId: string) =>
    window.commandCenter.assignCollabSubTask(sessionId, subTaskId, agentId),
  deleteCollabSubTask: (sessionId: string, subTaskId: string) =>
    window.commandCenter.deleteCollabSubTask(sessionId, subTaskId),
  assignCollabAgent: (sessionId: string, agentId: string, role: string) =>
    window.commandCenter.assignCollabAgent(sessionId, agentId, role),
  removeCollabAgent: (sessionId: string, agentId: string) =>
    window.commandCenter.removeCollabAgent(sessionId, agentId),
  setCollabContext: (sessionId: string, key: string, value: string, setBy: string) =>
    window.commandCenter.setCollabContext(sessionId, key, value, setBy),
  sendCollabMessage: (sessionId: string, fromAgentId: string, toAgentId: string | null, type: AgentMessageType, subject: string, body: string) =>
    window.commandCenter.sendCollabMessage(sessionId, fromAgentId, toAgentId, type, subject, body),
  reportCollabConflict: (sessionId: string, type: ConflictRecord['type'], description: string, involvedAgentIds: string[]) =>
    window.commandCenter.reportCollabConflict(sessionId, type, description, involvedAgentIds),
  resolveCollabConflict: (sessionId: string, conflictId: string, resolution: string) =>
    window.commandCenter.resolveCollabConflict(sessionId, conflictId, resolution),
  executeCollabSession: (sessionId: string) => window.commandCenter.executeCollabSession(sessionId)
};
