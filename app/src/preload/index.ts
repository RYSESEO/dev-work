import { contextBridge, ipcRenderer } from 'electron';
import type { DashboardSnapshot, Mission, Run, Task } from '../shared/domain.js';

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
    ipcRenderer.invoke('approval:reject', approvalRequestId, reason)
};

contextBridge.exposeInMainWorld('commandCenter', commandCenter);

export type CommandCenterApi = typeof commandCenter;
