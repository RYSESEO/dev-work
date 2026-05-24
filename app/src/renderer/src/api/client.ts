import type { RunnerProfile, SandboxConfig, User, WorkflowStep } from '../../../shared/domain';

export const commandCenterClient = {
  getSnapshot: () => window.commandCenter.getSnapshot(),
  createMission: (title: string, goal: string) => window.commandCenter.createMission(title, goal),
  createTask: (missionId: string | null, title: string, description: string, priority?: 'low' | 'normal' | 'high') =>
    window.commandCenter.createTask(missionId, title, description, priority),
  launchRun: (taskId: string, agentProfileId: string, prompt: string) =>
    window.commandCenter.launchRun(taskId, agentProfileId, prompt),
  approveRequest: (approvalRequestId: string) => window.commandCenter.approveRequest(approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string) => window.commandCenter.rejectRequest(approvalRequestId, reason),
  installMarketplaceEntry: (entryId: string) => window.commandCenter.installMarketplaceEntry(entryId),
  uninstallMarketplaceEntry: (entryId: string) => window.commandCenter.uninstallMarketplaceEntry(entryId),
  togglePlugin: (pluginId: string, enabled: boolean) => window.commandCenter.togglePlugin(pluginId, enabled),
  addRunnerProfile: (profile: RunnerProfile) => window.commandCenter.addRunnerProfile(profile),
  removeRunnerProfile: (profileId: string) => window.commandCenter.removeRunnerProfile(profileId),
  createUser: (name: string, email: string, role: User['role']) => window.commandCenter.createUser(name, email, role),
  updateUserRole: (userId: string, role: User['role']) => window.commandCenter.updateUserRole(userId, role),
  createWorkflow: (name: string, description: string, steps: WorkflowStep[]) =>
    window.commandCenter.createWorkflow(name, description, steps),
  launchWorkflow: (workflowId: string, missionId: string | null) =>
    window.commandCenter.launchWorkflow(workflowId, missionId),
  updateSandboxConfig: (config: Partial<SandboxConfig>) => window.commandCenter.updateSandboxConfig(config),
  getAnalytics: () => window.commandCenter.getAnalytics()
};
