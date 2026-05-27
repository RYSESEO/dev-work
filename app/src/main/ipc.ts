import { app, ipcMain } from 'electron';
import { getNotificationPrefs, setNotificationPrefs, type NotificationPreferences } from './notifications.js';
import path from 'node:path';
import { createAppStore } from './db/appStore.js';
import { createAuthService } from './services/auth.js';
import { createOrchestrator, type Orchestrator } from './services/orchestrator.js';
import type { Mission, RunnerProfile, SandboxConfig, Task, User, WorkflowStep, WorkflowTemplate } from '../shared/domain.js';

let orchestratorPromise: Promise<Orchestrator> | null = null;

function getOrchestrator(): Promise<Orchestrator> {
  orchestratorPromise ??= createAppStore(path.join(app.getPath('userData'), 'command-center.sqlite')).then((store) => {
    const auth = createAuthService(store);
    return createOrchestrator(store, auth);
  });
  return orchestratorPromise;
}

export function registerIpcHandlers(): void {
  ipcMain.handle('dashboard:getSnapshot', async (_event, knownVersion?: number) => {
    const orch = await getOrchestrator();
    if (typeof knownVersion === 'number' && knownVersion === orch.getStoreVersion()) {
      return null;
    }
    return orch.getSnapshot();
  });

  // Auth
  ipcMain.handle('auth:login', async (_event, email: string, password: string) =>
    (await getOrchestrator()).login(email, password)
  );
  ipcMain.handle('auth:logout', async () =>
    (await getOrchestrator()).logout()
  );
  ipcMain.handle('auth:currentUser', async () =>
    (await getOrchestrator()).getCurrentUser()
  );
  ipcMain.handle('auth:requiresSetup', async () =>
    (await getOrchestrator()).requiresSetup()
  );
  ipcMain.handle('auth:setupAdmin', async (_event, name: string, email: string, password: string) =>
    (await getOrchestrator()).setupAdmin(name, email, password)
  );

  // Missions
  ipcMain.handle('mission:create', async (_event, title: string, goal: string) =>
    (await getOrchestrator()).createMission(title, goal)
  );
  ipcMain.handle('mission:update', async (_event, id: string, fields: Partial<Pick<Mission, 'title' | 'goal' | 'status'>>) =>
    (await getOrchestrator()).updateMission(id, fields)
  );
  ipcMain.handle('mission:delete', async (_event, id: string) =>
    (await getOrchestrator()).deleteMission(id)
  );

  // Tasks
  ipcMain.handle(
    'task:create',
    async (_event, missionId: string | null, title: string, description: string, priority?: Task['priority']) =>
      (await getOrchestrator()).createTask(missionId, title, description, priority)
  );
  ipcMain.handle('task:update', async (_event, id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status'>>) =>
    (await getOrchestrator()).updateTask(id, fields)
  );
  ipcMain.handle('task:delete', async (_event, id: string) =>
    (await getOrchestrator()).deleteTask(id)
  );

  // Runs
  ipcMain.handle('run:launch', async (_event, taskId: string, agentProfileId: string, prompt: string) =>
    (await getOrchestrator()).launchRun(taskId, agentProfileId, prompt)
  );
  ipcMain.handle('run:stop', async (_event, runId: string) =>
    (await getOrchestrator()).stopRun(runId)
  );
  ipcMain.handle('run:log', async (_event, runId: string) =>
    (await getOrchestrator()).getRunLog(runId)
  );

  // Approvals
  ipcMain.handle('approval:approve', async (_event, approvalRequestId: string) =>
    (await getOrchestrator()).approveRequest(approvalRequestId)
  );
  ipcMain.handle('approval:reject', async (_event, approvalRequestId: string, reason: string) =>
    (await getOrchestrator()).rejectRequest(approvalRequestId, reason)
  );

  // Marketplace
  ipcMain.handle('marketplace:install', async (_event, entryId: string) =>
    (await getOrchestrator()).installMarketplaceEntry(entryId)
  );
  ipcMain.handle('marketplace:uninstall', async (_event, entryId: string) =>
    (await getOrchestrator()).uninstallMarketplaceEntry(entryId)
  );

  // Plugins
  ipcMain.handle('plugin:toggle', async (_event, pluginId: string, enabled: boolean) =>
    (await getOrchestrator()).togglePlugin(pluginId, enabled)
  );

  // Runner profiles
  ipcMain.handle('runner:add', async (_event, profile: RunnerProfile) =>
    (await getOrchestrator()).addRunnerProfile(profile)
  );
  ipcMain.handle('runner:remove', async (_event, profileId: string) =>
    (await getOrchestrator()).removeRunnerProfile(profileId)
  );
  ipcMain.handle('runner:update', async (_event, id: string, fields: Partial<Omit<RunnerProfile, 'id'>>) =>
    (await getOrchestrator()).updateRunnerProfile(id, fields)
  );

  // Users
  ipcMain.handle('user:create', async (_event, name: string, email: string, role: User['role'], password?: string) =>
    (await getOrchestrator()).createUser(name, email, role, password)
  );
  ipcMain.handle('user:updateRole', async (_event, userId: string, role: User['role']) =>
    (await getOrchestrator()).updateUserRole(userId, role)
  );
  ipcMain.handle('user:delete', async (_event, userId: string) =>
    (await getOrchestrator()).deleteUser(userId)
  );
  ipcMain.handle('user:setPassword', async (_event, userId: string, password: string) =>
    (await getOrchestrator()).setUserPassword(userId, password)
  );

  // Workflows
  ipcMain.handle('workflow:create', async (_event, name: string, description: string, steps: WorkflowStep[]) =>
    (await getOrchestrator()).createWorkflow(name, description, steps)
  );
  ipcMain.handle('workflow:update', async (_event, id: string, fields: Partial<Pick<WorkflowTemplate, 'name' | 'description' | 'steps'>>) =>
    (await getOrchestrator()).updateWorkflow(id, fields)
  );
  ipcMain.handle('workflow:delete', async (_event, id: string) =>
    (await getOrchestrator()).deleteWorkflow(id)
  );
  ipcMain.handle('workflow:launch', async (_event, workflowId: string, missionId: string | null) =>
    (await getOrchestrator()).launchWorkflow(workflowId, missionId)
  );

  // Sandbox
  ipcMain.handle('sandbox:update', async (_event, config: Partial<SandboxConfig>) =>
    (await getOrchestrator()).updateSandboxConfig(config)
  );

  // Analytics
  ipcMain.handle('analytics:get', async () =>
    (await getOrchestrator()).getAnalytics()
  );

  // Audit log
  ipcMain.handle('audit:get', async () =>
    (await getOrchestrator()).getAuditLog()
  );

  // Data export
  ipcMain.handle('data:export', async (_event, format: 'json' | 'csv') =>
    (await getOrchestrator()).exportData(format)
  );

  // License
  ipcMain.handle('license:activate', async (_event, key: string, email: string) =>
    (await getOrchestrator()).activateLicense(key, email)
  );
  ipcMain.handle('license:deactivate', async () =>
    (await getOrchestrator()).deactivateLicense()
  );
  ipcMain.handle('license:status', async () =>
    (await getOrchestrator()).getLicenseStatus()
  );

  // Notifications
  ipcMain.handle('notifications:get', () => getNotificationPrefs());
  ipcMain.handle('notifications:set', (_event, prefs: Partial<NotificationPreferences>) =>
    setNotificationPrefs(prefs)
  );
}
