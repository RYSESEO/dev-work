# API Reference

Complete reference for all IPC channels and client API methods.

## Client API

The renderer accesses the main process through `commandCenterClient`:

```typescript
import { commandCenterClient } from './api/client';
```

## Core Operations

### Snapshot

```typescript
getSnapshot(): Promise<DashboardSnapshot>
```

Returns the full application state including missions, tasks, agents, runs, events, artifacts, runner profiles, and marketplace entries. Supports delta detection — returns a version number that the renderer can use to skip no-op polls.

### Missions

```typescript
createMission(title: string, goal: string): Promise<Mission>
updateMission(id: string, fields: Partial<{ title, goal, status }>): Promise<Mission>
deleteMission(id: string): Promise<void>
```

### Tasks

```typescript
createTask(missionId: string, title: string, description: string, priority?: string): Promise<Task>
updateTask(id: string, fields: Partial<{ title, description, priority, status }>): Promise<Task>
deleteTask(id: string): Promise<void>
```

### Runs

```typescript
launchRun(agentId: string, taskId: string): Promise<Run>
stopRun(runId: string): Promise<void>
getRunLogs(runId: string): Promise<RunLogEntry[]>
```

### Approvals

```typescript
approveRequest(requestId: string): Promise<void>
rejectRequest(requestId: string): Promise<void>
```

## User Management

```typescript
setupAdmin(name: string, email: string, password: string): Promise<SafeUser>
login(email: string, password: string): Promise<SafeUser>
logout(): Promise<void>
getCurrentUser(): Promise<SafeUser | null>
createUser(name: string, email: string, role: UserRole, password?: string): Promise<SafeUser>
updateUserRole(userId: string, role: UserRole): Promise<void>
deleteUser(userId: string): Promise<void>
setUserPassword(userId: string, password: string): Promise<void>
```

## Runner Profiles

```typescript
addRunnerProfile(profile: RunnerProfile): Promise<void>
removeRunnerProfile(profileId: string): Promise<void>
updateRunnerProfile(id: string, fields: Partial<RunnerProfile>): Promise<RunnerProfile>
```

## Marketplace

```typescript
installPackage(packageId: string): Promise<void>
uninstallPackage(packageId: string): Promise<void>
```

## Workflows

```typescript
createWorkflow(name: string, description: string, steps: WorkflowStep[]): Promise<WorkflowTemplate>
updateWorkflow(id: string, fields: Partial<{ name, description, steps }>): Promise<WorkflowTemplate>
deleteWorkflow(id: string): Promise<void>
launchWorkflow(workflowId: string, missionId: string | null): Promise<WorkflowRun>
```

## Sandbox Configuration

```typescript
updateSandboxConfig(config: Partial<SandboxConfig>): Promise<SandboxConfig>
```

## Analytics

```typescript
getAnalytics(): Promise<AnalyticsSnapshot>
```

Returns:
```typescript
{
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  totalTokens: number;
  totalCost: number;
  runsByDay: Array<{ date: string; count: number }>;
  agentPerformance: Array<{ agentId: string; agentName: string; runs: number; successRate: number }>;
}
```

## License

```typescript
activateLicense(key: string): Promise<LicenseStatus>
getLicenseStatus(): Promise<LicenseStatus>
```

## Audit Log

```typescript
getAuditLog(): Promise<AuditLogEntry[]>
```

Returns:
```typescript
{
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}
```

## Data Export

```typescript
exportData(format: 'json' | 'csv'): Promise<string>
```

## Telemetry

```typescript
getTelemetryPrefs(): Promise<{ enabled: boolean; webhookUrl: string }>
setTelemetryPrefs(update: Partial<{ enabled: boolean; webhookUrl: string }>): Promise<TelemetryPreferences>
getTelemetryEvents(limit?: number): Promise<TelemetryEvent[]>
getTelemetrySummary(): Promise<{ totalEvents: number; eventCounts: Record<string, number>; lastEvent: string | null }>
```

## Backup & Restore

```typescript
createBackup(targetPath: string): Promise<BackupMetadata>
restoreBackup(sourcePath: string): Promise<BackupMetadata>
listBackups(directory: string): Promise<BackupMetadata[]>
autoBackup(dataDir: string): Promise<string>
```

## Notifications

```typescript
getNotificationPrefs(): Promise<NotificationPreferences>
setNotificationPrefs(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences>
```

## IPC Channel Map

| Channel | Method | Description |
|---------|--------|-------------|
| `snapshot` | GET | Full dashboard snapshot |
| `mission:create` | POST | Create mission |
| `mission:update` | PUT | Update mission |
| `mission:delete` | DELETE | Delete mission |
| `task:create` | POST | Create task |
| `task:update` | PUT | Update task |
| `task:delete` | DELETE | Delete task |
| `run:launch` | POST | Launch agent run |
| `run:stop` | POST | Stop active run |
| `run:logs` | GET | Get run log entries |
| `approval:approve` | POST | Approve request |
| `approval:reject` | POST | Reject request |
| `auth:setup` | POST | Setup admin |
| `auth:login` | POST | Login |
| `auth:logout` | POST | Logout |
| `auth:me` | GET | Current user |
| `user:create` | POST | Create user |
| `user:updateRole` | PUT | Update role |
| `user:delete` | DELETE | Delete user |
| `user:setPassword` | PUT | Set password |
| `profile:add` | POST | Add runner profile |
| `profile:remove` | DELETE | Remove profile |
| `profile:update` | PUT | Update profile |
| `marketplace:install` | POST | Install package |
| `marketplace:uninstall` | POST | Uninstall package |
| `workflow:create` | POST | Create workflow |
| `workflow:update` | PUT | Update workflow |
| `workflow:delete` | DELETE | Delete workflow |
| `workflow:launch` | POST | Launch workflow |
| `sandbox:update` | PUT | Update sandbox config |
| `analytics` | GET | Get analytics |
| `license:activate` | POST | Activate license |
| `license:status` | GET | License status |
| `audit:log` | GET | Get audit log |
| `export:data` | GET | Export data |
| `notifications:get` | GET | Notification prefs |
| `notifications:set` | PUT | Set notification prefs |
| `telemetry:getPrefs` | GET | Telemetry prefs |
| `telemetry:setPrefs` | PUT | Set telemetry prefs |
| `telemetry:getEvents` | GET | Telemetry events |
| `telemetry:getSummary` | GET | Telemetry summary |
| `backup:create` | POST | Create backup |
| `backup:restore` | POST | Restore backup |
| `backup:list` | GET | List backups |
| `backup:auto` | POST | Auto backup |
