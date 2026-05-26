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
  getSnapshot: (knownVersion?: number): Promise<DashboardSnapshot | null> =>
    ipcRenderer.invoke('dashboard:getSnapshot', knownVersion),

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
  createUser: (name: string, email: string, role: User['role']): Promise<User> =>
    ipcRenderer.invoke('user:create', name, email, role),
  updateUserRole: (userId: string, role: User['role']): Promise<void> =>
    ipcRenderer.invoke('user:updateRole', userId, role),
  deleteUser: (userId: string): Promise<void> => ipcRenderer.invoke('user:delete', userId),

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
  getAnalytics: (): Promise<AnalyticsSnapshot> => ipcRenderer.invoke('analytics:get')
};

contextBridge.exposeInMainWorld('commandCenter', commandCenter);

export type CommandCenterApi = typeof commandCenter;
