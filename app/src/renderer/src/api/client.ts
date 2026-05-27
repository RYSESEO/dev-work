import type { Mission, RunnerProfile, SandboxConfig, Task, User, WorkflowStep, WorkflowTemplate } from '../../../shared/domain';

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
  }>) => window.commandCenter.setNotificationPrefs(prefs)
};
