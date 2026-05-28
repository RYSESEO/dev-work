/**
 * Event types accepted by the dev-work webhook API.
 */
export type EventType =
  | 'run.started'
  | 'run.progress'
  | 'run.completed'
  | 'run.failed'
  | 'usage.report'
  | 'artifact.created'
  | 'heartbeat';

/**
 * Payload for run lifecycle events (started, progress, completed, failed).
 */
export interface RunPayload {
  runId: string;
  agentName: string;
  status: 'started' | 'running' | 'completed' | 'failed';
  prompt?: string;
  output?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, string>;
}

/**
 * Payload for token/cost usage tracking.
 */
export interface UsagePayload {
  runId?: string;
  tokens: number;
  costUsd: number;
  model?: string;
  provider?: string;
}

/**
 * Payload for artifact creation events.
 */
export interface ArtifactPayload {
  runId?: string;
  title: string;
  kind: 'log' | 'summary' | 'file' | 'report';
  content?: string;
  path?: string;
}

/**
 * Payload for heartbeat events.
 */
export interface HeartbeatPayload {
  agentName: string;
  version?: string;
  uptime?: number;
}

export type EventPayload = RunPayload | UsagePayload | ArtifactPayload | HeartbeatPayload;

/**
 * A webhook event to send to the dev-work API.
 */
export interface WebhookEvent {
  type: EventType;
  payload: EventPayload;
}

/**
 * Response from the dev-work webhook API on successful event submission.
 */
export interface EventResponse {
  id: string;
  status: 'accepted';
}

/**
 * Response from the dev-work health check endpoint.
 */
export interface StatusResponse {
  status: string;
  version: string;
  uptime: number;
}

/**
 * Error response from the dev-work webhook API.
 */
export interface ErrorResponse {
  error: string;
  received?: string;
}

/**
 * Configuration for the DevWorkClient.
 */
export interface ClientConfig {
  /** API key (starts with dw_). Required. */
  apiKey: string;
  /** Webhook server host. Default: '127.0.0.1' */
  host?: string;
  /** Webhook server port. Default: 9400 */
  port?: number;
  /** Base URL override (e.g., 'http://my-server:9400'). Takes precedence over host/port. */
  baseUrl?: string;
  /** Request timeout in ms. Default: 10000 */
  timeout?: number;
  /** Retry failed requests up to N times. Default: 2 */
  retries?: number;
  /** Auto-heartbeat interval in ms. 0 to disable. Default: 0 */
  heartbeatInterval?: number;
  /** Agent name used in heartbeats. Default: 'custom-agent' */
  agentName?: string;
  /** Agent version used in heartbeats. */
  agentVersion?: string;
}

/**
 * Run tracking helper returned by client.startRun().
 */
export interface RunTracker {
  /** The unique run ID. */
  runId: string;
  /** Report progress on this run. */
  progress(output: string, metadata?: Record<string, string>): Promise<EventResponse>;
  /** Report token/cost usage for this run. */
  usage(tokens: number, costUsd: number, model?: string, provider?: string): Promise<EventResponse>;
  /** Attach an artifact to this run. */
  artifact(title: string, kind: ArtifactPayload['kind'], content?: string, path?: string): Promise<EventResponse>;
  /** Mark the run as completed. */
  complete(output?: string, durationMs?: number, metadata?: Record<string, string>): Promise<EventResponse>;
  /** Mark the run as failed. */
  fail(error: string, durationMs?: number, metadata?: Record<string, string>): Promise<EventResponse>;
}
