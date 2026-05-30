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
  | 'user'
  | 'license'
  | 'telemetry'
  | 'apikey'
  | 'integration'
  | 'budget'
  | 'anomaly'
  | 'collab'
  | 'message'
  | 'subtask'
  | 'sandbox'
  | 'compliance';

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

export interface AnthropicRunnerProfile {
  id: string;
  name: string;
  type: 'anthropic';
  model: string;
  workspacePath: string;
  env: Record<string, string>;
  costPerThousandTokensUsd: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface OllamaRunnerProfile {
  id: string;
  name: string;
  type: 'ollama';
  model: string;
  workspacePath: string;
  env: Record<string, string>;
  costPerThousandTokensUsd: number;
  ollamaHost: string;
}

export interface CustomHttpRunnerProfile {
  id: string;
  name: string;
  type: 'custom-http';
  workspacePath: string;
  env: Record<string, string>;
  costPerThousandTokensUsd: number;
  endpointUrl: string;
  headers: Record<string, string>;
}

export type RunnerProfile = CommandRunnerProfile | OpenAIRunnerProfile | AnthropicRunnerProfile | OllamaRunnerProfile | CustomHttpRunnerProfile;

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

export type LicenseTier = 'free' | 'pro' | 'team';

export type LicenseFeature =
  | 'unlimited_agents'
  | 'unlimited_runners'
  | 'marketplace_install'
  | 'plugin_system'
  | 'data_export'
  | 'audit_log'
  | 'workflow_engine'
  | 'priority_support'
  | 'custom_branding'
  | 'team_management'
  | 'multi_agent_collaboration'
  | 'cloud_sync'
  | 'sso_auth'
  | 'sandbox_execution'
  | 'compliance_reporting'
  | 'rest_api_server';

export interface LicenseStatus {
  tier: LicenseTier;
  maxAgents: number;
  maxRunners: number;
  maxUsers: number;
  features: LicenseFeature[];
  validUntil: string | null;
  activated: boolean;
}

// ── Billing / Checkout ──────────────────────────────────────────────

export type CheckoutProvider = 'lemonsqueezy' | 'paddle' | 'gumroad' | 'custom';

export type PaidTier = Exclude<LicenseTier, 'free'>;

export interface BillingConfig {
  provider: CheckoutProvider;
  proCheckoutUrl: string;
  teamCheckoutUrl: string;
  manageUrl: string;
}

export interface CheckoutSession {
  provider: CheckoutProvider;
  tier: PaidTier;
  url: string;
}

// ── Cost Intelligence ───────────────────────────────────────────────

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';
export type BudgetAction = 'alert' | 'throttle' | 'block';

export interface Budget {
  id: string;
  name: string;
  limitUsd: number;
  period: BudgetPeriod;
  action: BudgetAction;
  spentUsd: number;
  enabled: boolean;
  resetAt: string;
  createdAt: string;
}

export interface CostForecast {
  period: 'next_7d' | 'next_30d';
  projectedCostUsd: number;
  projectedTokens: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPct: number;
  confidence: 'low' | 'medium' | 'high';
  dailyAvgCostUsd: number;
  dailyAvgTokens: number;
}

export interface CostAnomaly {
  id: string;
  detectedAt: string;
  type: 'cost_spike' | 'token_spike' | 'frequency_spike' | 'unusual_model';
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: number;
  baseline: number;
  runId?: string;
  agentName?: string;
}

export interface ModelCostEntry {
  model: string;
  provider: string;
  totalTokens: number;
  totalCostUsd: number;
  runCount: number;
  avgCostPerRun: number;
  avgTokensPerRun: number;
  costPer1kTokens: number;
}

export interface CostIntelligenceSnapshot {
  budgets: Budget[];
  forecasts: CostForecast[];
  anomalies: CostAnomaly[];
  modelCosts: ModelCostEntry[];
  totalSpentToday: number;
  totalSpentThisWeek: number;
  totalSpentThisMonth: number;
}

// ── Webhook / API Integration ───────────────────────────────────────

export type WebhookEventType =
  | 'run.started'
  | 'run.progress'
  | 'run.completed'
  | 'run.failed'
  | 'usage.report'
  | 'artifact.created'
  | 'heartbeat';

export interface WebhookEvent {
  id: string;
  integrationId: string;
  type: WebhookEventType;
  payload: WebhookRunPayload | WebhookUsagePayload | WebhookArtifactPayload | WebhookHeartbeatPayload;
  receivedAt: string;
}

export interface WebhookRunPayload {
  runId: string;
  agentName: string;
  status: 'started' | 'running' | 'completed' | 'failed';
  prompt?: string;
  output?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, string>;
}

export interface WebhookUsagePayload {
  runId?: string;
  tokens: number;
  costUsd: number;
  model?: string;
  provider?: string;
}

export interface WebhookArtifactPayload {
  runId?: string;
  title: string;
  kind: 'log' | 'summary' | 'file' | 'report';
  content?: string;
  path?: string;
}

export interface WebhookHeartbeatPayload {
  agentName: string;
  version?: string;
  uptime?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
}

export type ApiScope = 'events:write' | 'events:read' | 'status:read';

export interface ExternalIntegration {
  id: string;
  name: string;
  type: 'cursor' | 'copilot' | 'devin' | 'custom' | 'cli' | 'ci-cd';
  apiKeyId: string;
  status: 'active' | 'inactive' | 'error';
  lastSeenAt: string | null;
  eventCount: number;
  totalTokens: number;
  totalCostUsd: number;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface WebhookServerConfig {
  enabled: boolean;
  port: number;
  host: string;
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
  license: LicenseStatus;
  billing: BillingConfig;
  integrations: ExternalIntegration[];
  apiKeys: Array<Omit<ApiKey, 'keyHash'>>;
  webhookServer: WebhookServerConfig;
  costIntelligence: CostIntelligenceSnapshot;
  collaboration: CollaborationSnapshot;
  enterprise: EnterpriseSnapshot;
  storeVersion?: number;
}

// ── Multi-Agent Collaboration ───────────────────────────────────────

export type CollaborationStatus = 'planning' | 'running' | 'merging' | 'completed' | 'failed' | 'cancelled';
export type SubTaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'skipped';
export type AgentMessageType = 'status_update' | 'data_share' | 'conflict' | 'request' | 'resolution';

export interface CollaborationSession {
  id: string;
  missionId: string | null;
  title: string;
  description: string;
  status: CollaborationStatus;
  strategy: 'parallel' | 'pipeline' | 'divide_and_conquer';
  maxConcurrency: number;
  subTasks: SubTask[];
  agentAssignments: AgentAssignment[];
  sharedContext: SharedContextEntry[];
  messages: AgentMessage[];
  conflicts: ConflictRecord[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SubTask {
  id: string;
  sessionId: string;
  parentTaskId: string | null;
  title: string;
  description: string;
  status: SubTaskStatus;
  assignedAgentId: string | null;
  runId: string | null;
  dependsOn: string[];
  priority: 'low' | 'normal' | 'high';
  output: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AgentAssignment {
  agentId: string;
  role: string;
  subTaskIds: string[];
  status: 'idle' | 'working' | 'done' | 'failed';
}

export interface SharedContextEntry {
  key: string;
  value: string;
  setBy: string;
  setAt: string;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  fromAgentId: string;
  toAgentId: string | null;
  type: AgentMessageType;
  subject: string;
  body: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface ConflictRecord {
  id: string;
  sessionId: string;
  type: 'resource_contention' | 'output_mismatch' | 'dependency_deadlock';
  description: string;
  involvedAgentIds: string[];
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CollaborationSnapshot {
  sessions: CollaborationSession[];
  activeSessions: number;
  totalCompleted: number;
  totalSubTasks: number;
  completedSubTasks: number;
  avgCompletionTimeMs: number;
}

// ── Enterprise & Cloud ──────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disabled';
export type SyncConflictResolution = 'local_wins' | 'remote_wins' | 'manual';

export interface CloudSyncConfig {
  enabled: boolean;
  endpoint: string;
  teamId: string;
  encryptionEnabled: boolean;
  syncIntervalSeconds: number;
  conflictResolution: SyncConflictResolution;
  lastSyncAt: string | null;
  status: SyncStatus;
  syncedCollections: string[];
}

export interface SyncRecord {
  id: string;
  collection: string;
  recordId: string;
  action: 'push' | 'pull' | 'conflict';
  status: 'pending' | 'completed' | 'failed' | 'conflict';
  syncedAt: string;
  error: string | null;
}

export type SsoProvider = 'saml' | 'oidc' | 'oauth2';

export interface SsoConfig {
  enabled: boolean;
  provider: SsoProvider;
  issuerUrl: string;
  clientId: string;
  callbackUrl: string;
  autoProvision: boolean;
  defaultRole: UserRole;
  allowedDomains: string[];
  attributeMapping: Record<string, string>;
}

export interface SandboxExecution {
  id: string;
  runId: string;
  containerId: string | null;
  runtime: 'docker' | 'firecracker';
  image: string;
  status: 'creating' | 'running' | 'stopped' | 'failed' | 'destroyed';
  resourceUsage: {
    cpuPercent: number;
    memoryMb: number;
    networkInBytes: number;
    networkOutBytes: number;
  };
  networkPolicy: 'none' | 'restricted' | 'full';
  startedAt: string;
  stoppedAt: string | null;
}

export interface ComplianceControl {
  id: string;
  category: 'access_control' | 'data_protection' | 'audit_logging' | 'encryption' | 'availability' | 'change_management';
  name: string;
  description: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  evidence: string;
  lastCheckedAt: string;
}

export interface ComplianceReport {
  generatedAt: string;
  framework: 'soc2_type1' | 'soc2_type2';
  overallScore: number;
  controls: ComplianceControl[];
  totalControls: number;
  compliantControls: number;
  gaps: string[];
}

export interface RestApiConfig {
  enabled: boolean;
  port: number;
  host: string;
  tlsEnabled: boolean;
  tlsCertPath: string;
  tlsKeyPath: string;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  authRequired: boolean;
}

export interface RestApiStatus {
  running: boolean;
  port: number;
  host: string;
  uptime: number;
  requestCount: number;
  activeConnections: number;
  startedAt: string | null;
}

export interface EnterpriseSnapshot {
  cloudSync: CloudSyncConfig;
  sso: SsoConfig;
  sandboxExecutions: SandboxExecution[];
  compliance: ComplianceReport;
  restApi: RestApiConfig;
  restApiStatus: RestApiStatus;
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
