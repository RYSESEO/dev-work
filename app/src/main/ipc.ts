import { app, ipcMain } from 'electron';
import path from 'node:path';
import { createAppStore } from './db/appStore.js';
import { createOrchestrator, type Orchestrator } from './services/orchestrator.js';
import type { RunnerProfile, SandboxConfig, Task, User, WorkflowStep } from '../shared/domain.js';

let orchestratorPromise: Promise<Orchestrator> | null = null;

function getOrchestrator(): Promise<Orchestrator> {
  orchestratorPromise ??= createAppStore(path.join(app.getPath('userData'), 'command-center.sqlite')).then(createOrchestrator);
  return orchestratorPromise;
}

export function registerIpcHandlers(): void {
  ipcMain.handle('dashboard:getSnapshot', async () => (await getOrchestrator()).getSnapshot());
  ipcMain.handle('mission:create', async (_event, title: string, goal: string) =>
    (await getOrchestrator()).createMission(title, goal)
  );
  ipcMain.handle(
    'task:create',
    async (_event, missionId: string | null, title: string, description: string, priority?: Task['priority']) =>
      (await getOrchestrator()).createTask(missionId, title, description, priority)
  );
  ipcMain.handle('run:launch', async (_event, taskId: string, agentProfileId: string, prompt: string) =>
    (await getOrchestrator()).launchRun(taskId, agentProfileId, prompt)
  );
  ipcMain.handle('approval:approve', async (_event, approvalRequestId: string) =>
    (await getOrchestrator()).approveRequest(approvalRequestId)
  );
  ipcMain.handle('approval:reject', async (_event, approvalRequestId: string, reason: string) =>
    (await getOrchestrator()).rejectRequest(approvalRequestId, reason)
  );
  ipcMain.handle('marketplace:install', async (_event, entryId: string) =>
    (await getOrchestrator()).installMarketplaceEntry(entryId)
  );
  ipcMain.handle('marketplace:uninstall', async (_event, entryId: string) =>
    (await getOrchestrator()).uninstallMarketplaceEntry(entryId)
  );
  ipcMain.handle('plugin:toggle', async (_event, pluginId: string, enabled: boolean) =>
    (await getOrchestrator()).togglePlugin(pluginId, enabled)
  );
  ipcMain.handle('runner:add', async (_event, profile: RunnerProfile) =>
    (await getOrchestrator()).addRunnerProfile(profile)
  );
  ipcMain.handle('runner:remove', async (_event, profileId: string) =>
    (await getOrchestrator()).removeRunnerProfile(profileId)
  );
  ipcMain.handle('user:create', async (_event, name: string, email: string, role: User['role']) =>
    (await getOrchestrator()).createUser(name, email, role)
  );
  ipcMain.handle('user:updateRole', async (_event, userId: string, role: User['role']) =>
    (await getOrchestrator()).updateUserRole(userId, role)
  );
  ipcMain.handle('workflow:create', async (_event, name: string, description: string, steps: WorkflowStep[]) =>
    (await getOrchestrator()).createWorkflow(name, description, steps)
  );
  ipcMain.handle('workflow:launch', async (_event, workflowId: string, missionId: string | null) =>
    (await getOrchestrator()).launchWorkflow(workflowId, missionId)
  );
  ipcMain.handle('sandbox:update', async (_event, config: Partial<SandboxConfig>) =>
    (await getOrchestrator()).updateSandboxConfig(config)
  );
  ipcMain.handle('analytics:get', async () =>
    (await getOrchestrator()).getAnalytics()
  );
}
