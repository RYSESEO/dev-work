import { contextBridge, ipcRenderer } from 'electron';
import type {
  AnalyticsSnapshot,
  DashboardSnapshot,
  Mission,
  Run,
  RunnerProfile,
  SandboxConfig,
  Task,
  User,
  WorkflowRun,
  WorkflowStep,
  WorkflowTemplate
} from '../shared/domain.js';

const commandCenter = {
  getSnapshot: (): Promise<DashboardSnapshot> => ipcRenderer.invoke('dashboard:getSnapshot'),
  createMission: (title: string, goal: string): Promise<Mission> => ipcRenderer.invoke('mission:create', title, goal),
  createTask: (
    missionId: string | null,
    title: string,
    description: string,
    priority?: Task['priority']
  ): Promise<Task> => ipcRenderer.invoke('task:create', missionId, title, description, priority),
  launchRun: (taskId: string, agentProfileId: string, prompt: string): Promise<Run> =>
    ipcRenderer.invoke('run:launch', taskId, agentProfileId, prompt),
  approveRequest: (approvalRequestId: string): Promise<void> => ipcRenderer.invoke('approval:approve', approvalRequestId),
  rejectRequest: (approvalRequestId: string, reason: string): Promise<void> =>
    ipcRenderer.invoke('approval:reject', approvalRequestId, reason),
  installMarketplaceEntry: (entryId: string): Promise<void> => ipcRenderer.invoke('marketplace:install', entryId),
  uninstallMarketplaceEntry: (entryId: string): Promise<void> => ipcRenderer.invoke('marketplace:uninstall', entryId),
  togglePlugin: (pluginId: string, enabled: boolean): Promise<void> => ipcRenderer.invoke('plugin:toggle', pluginId, enabled),
  addRunnerProfile: (profile: RunnerProfile): Promise<void> => ipcRenderer.invoke('runner:add', profile),
  removeRunnerProfile: (profileId: string): Promise<void> => ipcRenderer.invoke('runner:remove', profileId),
  createUser: (name: string, email: string, role: User['role']): Promise<User> =>
    ipcRenderer.invoke('user:create', name, email, role),
  updateUserRole: (userId: string, role: User['role']): Promise<void> =>
    ipcRenderer.invoke('user:updateRole', userId, role),
  createWorkflow: (name: string, description: string, steps: WorkflowStep[]): Promise<WorkflowTemplate> =>
    ipcRenderer.invoke('workflow:create', name, description, steps),
  launchWorkflow: (workflowId: string, missionId: string | null): Promise<WorkflowRun> =>
    ipcRenderer.invoke('workflow:launch', workflowId, missionId),
  updateSandboxConfig: (config: Partial<SandboxConfig>): Promise<SandboxConfig> =>
    ipcRenderer.invoke('sandbox:update', config),
  getAnalytics: (): Promise<AnalyticsSnapshot> => ipcRenderer.invoke('analytics:get')
};

contextBridge.exposeInMainWorld('commandCenter', commandCenter);

export type CommandCenterApi = typeof commandCenter;
