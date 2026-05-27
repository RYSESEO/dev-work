export type IdPrefix =
  | 'mission'
  | 'task'
  | 'agent'
  | 'run'
  | 'event'
  | 'approval'
  | 'grant'
  | 'artifact'
  | 'runner'
  | 'plugin'
  | 'workflow'
  | 'user';

export type MissionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type TaskStatus = 'draft' | 'queued' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type RunStatus = 'queued' | 'running' | 'paused_for_approval' | 'completed' | 'failed' | 'stopped';
export type AgentStatus = 'idle' | 'running' | 'blocked' | 'offline';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Mission {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  missionId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'normal' | 'high';
  assigneeAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  runnerProfileId: string;
  status: AgentStatus;
  successCount: number;
  failureCount: number;
}

export interface CommandRunnerProfile {
  id: string;
  name: string;
  type: 'command';
  command: string;
  args: string[];
  workspacePath: string;
  env: Record<string, string>;
  costPerThousandTokensUsd: number;
}

export interface OpenAIRunnerProfile {
  id: string;
  name: string;
  type: 'openai';
  model: string;
  workspacePath: string;
  env: Record<string, string>;
  costPerThousandTokensUsd: number;
  maxTokens: number;
  systemPrompt: string;
}

export type RunnerProfile = CommandRunnerProfile | OpenAIRunnerProfile;

export interface Run {
  id: string;
  taskId: string;
  agentProfileId: string;
  runnerProfileId: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  estimatedCostUsd: number;
  estimatedTokens: number;
}

export type ApprovalScope =
  | { kind: 'read_workspace' }
  | { kind: 'edit_files'; paths: string[] }
  | { kind: 'edit_folder'; path: string }
  | { kind: 'command_exact'; command: string }
  | { kind: 'command_category'; category: 'test' | 'lint' | 'build' | 'git-read' }
  | { kind: 'install_dependencies' }
  | { kind: 'network' }
  | { kind: 'git_commit' }
  | { kind: 'git_push' };

export interface ApprovalRequest {
  id: string;
  runId: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  scope: ApprovalScope;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
}

export interface ApprovalGrant {
  id: string;
  runId: string;
  requestId: string;
  scope: ApprovalScope;
  duration: 'session';
  createdAt: string;
}

export interface UsageEvent {
  id: string;
  runId: string;
  at: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
  commandCount: number;
  outputBytes: number;
}

export interface SignificantEvent {
  id: string;
  runId: string | null;
  missionId: string | null;
  taskId: string | null;
  at: string;
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body: string;
}

export interface Artifact {
  id: string;
  runId: string;
  title: string;
  path: string;
  kind: 'log' | 'summary' | 'file' | 'report';
  createdAt: string;
}

export interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: 'runner' | 'plugin';
  runnerType: string | null;
  tags: string[];
  installed: boolean;
  rating: number;
  downloads: number;
  config: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  entryPoint: string;
  hooks: PluginHook[];
  config: Record<string, string>;
  installedAt: string;
}

export type PluginHook =
  | 'beforeRunStart'
  | 'afterRunComplete'
  | 'onApprovalRequest'
  | 'onArtifactCreated'
  | 'onMissionCreated'
  | 'onTaskCreated';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  passwordHash: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export type SafeUser = Omit<User, 'passwordHash'>;

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  at: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentRole: string;
  promptTemplate: string;
  dependsOn: string[];
  onFailure: 'stop' | 'skip' | 'retry';
  maxRetries: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  missionId: string | null;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  currentStepIndex: number;
  stepResults: WorkflowStepResult[];
  startedAt: string;
  completedAt: string | null;
}

export interface WorkflowStepResult {
  stepId: string;
  runId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
}

export interface AnalyticsSnapshot {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalTokens: number;
  totalCostUsd: number;
  averageRunDurationMs: number;
  estimatedTimeSavedHours: number;
  costSavingsUsd: number;
  runsByDay: Array<{ date: string; count: number; cost: number }>;
  topAgents: Array<{ agentId: string; name: string; runs: number; successRate: number }>;
}

export interface SandboxConfig {
  enabled: boolean;
  runtime: 'docker' | 'firecracker' | 'none';
  image: string;
  memoryLimitMb: number;
  cpuLimit: number;
  networkAccess: boolean;
  mountPaths: string[];
  timeoutSeconds: number;
}

export interface DashboardSnapshot {
  missions: Mission[];
  tasks: Task[];
  agents: AgentProfile[];
  runnerProfiles: RunnerProfile[];
  runs: Run[];
  approvals: ApprovalRequest[];
  grants: ApprovalGrant[];
  usage: UsageEvent[];
  events: SignificantEvent[];
  artifacts: Artifact[];
  marketplace: MarketplaceEntry[];
  plugins: PluginDefinition[];
  users: SafeUser[];
  workflows: WorkflowTemplate[];
  workflowRuns: WorkflowRun[];
  currentUser: SafeUser | null;
  analytics: AnalyticsSnapshot | null;
  sandboxConfig: SandboxConfig;
  storeVersion?: number;
}

export function createId(prefix: IdPrefix): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}_${uuid}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}
