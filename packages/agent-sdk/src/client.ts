import type {
  ClientConfig,
  EventResponse,
  EventType,
  EventPayload,
  StatusResponse,
  ErrorResponse,
  RunPayload,
  UsagePayload,
  ArtifactPayload,
  HeartbeatPayload,
  RunTracker
} from './types.js';

/**
 * Error thrown when the dev-work API returns a non-2xx response.
 */
export class DevWorkApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: ErrorResponse
  ) {
    super(`dev-work API error (${statusCode}): ${body.error}`);
    this.name = 'DevWorkApiError';
  }
}

/**
 * Client for sending agent events to the dev-work webhook API.
 *
 * @example
 * ```ts
 * import { DevWorkClient } from '@dev-work/agent-sdk';
 *
 * const client = new DevWorkClient({ apiKey: 'dw_your_key_here' });
 *
 * // Simple event
 * await client.sendEvent('heartbeat', { agentName: 'my-agent', version: '1.0' });
 *
 * // Tracked run
 * const run = await client.startRun('my-agent', 'Refactor auth module');
 * await run.progress('Analyzing files...');
 * await run.usage(1500, 0.045, 'gpt-4o', 'openai');
 * await run.complete('Done! 3 files changed.', 12000);
 *
 * client.destroy(); // cleanup heartbeat timer
 * ```
 */
export class DevWorkClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly agentName: string;
  private readonly agentVersion: string | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();

  constructor(config: ClientConfig) {
    if (!config.apiKey) {
      throw new Error('apiKey is required. Get one from the dev-work Integrations tab.');
    }

    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 10_000;
    this.retries = config.retries ?? 2;
    this.agentName = config.agentName ?? 'custom-agent';
    this.agentVersion = config.agentVersion;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    } else {
      const host = config.host ?? '127.0.0.1';
      const port = config.port ?? 9400;
      this.baseUrl = `http://${host}:${port}`;
    }

    if (config.heartbeatInterval && config.heartbeatInterval > 0) {
      this.startHeartbeat(config.heartbeatInterval);
    }
  }

  /**
   * Send a raw event to the webhook API.
   */
  async sendEvent(type: EventType, payload: EventPayload): Promise<EventResponse> {
    return this.post('/api/v1/events', { type, payload });
  }

  /**
   * Check webhook server health (no auth required).
   */
  async status(): Promise<StatusResponse> {
    return this.get('/api/v1/status');
  }

  /**
   * Send a heartbeat event.
   */
  async heartbeat(): Promise<EventResponse> {
    const payload: HeartbeatPayload = {
      agentName: this.agentName,
      version: this.agentVersion,
      uptime: Math.round((Date.now() - this.startTime) / 1000)
    };
    return this.sendEvent('heartbeat', payload);
  }

  /**
   * Report a run.started event.
   */
  async runStarted(
    agentName: string,
    runId: string,
    prompt?: string,
    metadata?: Record<string, string>
  ): Promise<EventResponse> {
    const payload: RunPayload = {
      runId,
      agentName,
      status: 'started',
      prompt,
      metadata
    };
    return this.sendEvent('run.started', payload);
  }

  /**
   * Report a run.progress event.
   */
  async runProgress(
    agentName: string,
    runId: string,
    output: string,
    metadata?: Record<string, string>
  ): Promise<EventResponse> {
    const payload: RunPayload = {
      runId,
      agentName,
      status: 'running',
      output,
      metadata
    };
    return this.sendEvent('run.progress', payload);
  }

  /**
   * Report a run.completed event.
   */
  async runCompleted(
    agentName: string,
    runId: string,
    output?: string,
    durationMs?: number,
    metadata?: Record<string, string>
  ): Promise<EventResponse> {
    const payload: RunPayload = {
      runId,
      agentName,
      status: 'completed',
      output,
      durationMs,
      metadata
    };
    return this.sendEvent('run.completed', payload);
  }

  /**
   * Report a run.failed event.
   */
  async runFailed(
    agentName: string,
    runId: string,
    error: string,
    durationMs?: number,
    metadata?: Record<string, string>
  ): Promise<EventResponse> {
    const payload: RunPayload = {
      runId,
      agentName,
      status: 'failed',
      error,
      durationMs,
      metadata
    };
    return this.sendEvent('run.failed', payload);
  }

  /**
   * Report token/cost usage.
   */
  async reportUsage(
    tokens: number,
    costUsd: number,
    model?: string,
    provider?: string,
    runId?: string
  ): Promise<EventResponse> {
    const payload: UsagePayload = { runId, tokens, costUsd, model, provider };
    return this.sendEvent('usage.report', payload);
  }

  /**
   * Report an artifact creation.
   */
  async reportArtifact(
    title: string,
    kind: ArtifactPayload['kind'],
    content?: string,
    path?: string,
    runId?: string
  ): Promise<EventResponse> {
    const payload: ArtifactPayload = { runId, title, kind, content, path };
    return this.sendEvent('artifact.created', payload);
  }

  /**
   * Start a tracked run. Returns a RunTracker with convenience methods.
   *
   * @example
   * ```ts
   * const run = await client.startRun('cursor', 'Fix bug in auth.ts');
   * await run.progress('Found the issue...');
   * await run.usage(1200, 0.036, 'gpt-4o', 'openai');
   * await run.artifact('Fix Summary', 'summary', 'Changed 2 files');
   * await run.complete('Bug fixed', 8500);
   * ```
   */
  async startRun(
    agentName: string,
    prompt?: string,
    metadata?: Record<string, string>,
    runId?: string
  ): Promise<RunTracker> {
    const id = runId ?? generateRunId();
    await this.runStarted(agentName, id, prompt, metadata);

    const tracker: RunTracker = {
      runId: id,

      progress: (output: string, meta?: Record<string, string>) =>
        this.runProgress(agentName, id, output, meta),

      usage: (tokens: number, costUsd: number, model?: string, provider?: string) =>
        this.reportUsage(tokens, costUsd, model, provider, id),

      artifact: (title: string, kind: ArtifactPayload['kind'], content?: string, path?: string) =>
        this.reportArtifact(title, kind, content, path, id),

      complete: (output?: string, durationMs?: number, meta?: Record<string, string>) =>
        this.runCompleted(agentName, id, output, durationMs, meta),

      fail: (error: string, durationMs?: number, meta?: Record<string, string>) =>
        this.runFailed(agentName, id, error, durationMs, meta)
    };

    return tracker;
  }

  /**
   * Stop the auto-heartbeat timer and release resources.
   */
  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(() => {
        // Heartbeat failures are non-fatal
      });
    }, intervalMs);
    // Don't keep the process alive just for heartbeats
    if (typeof this.heartbeatTimer === 'object' && 'unref' in this.heartbeatTimer) {
      this.heartbeatTimer.unref();
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request('POST', path, body);
  }

  private async get<T>(path: string): Promise<T> {
    return this.request('GET', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const needsAuth = path !== '/api/v1/status';
    if (needsAuth) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let lastError: Error | null = null;
    const attempts = this.retries + 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timer);

        const data = await response.json() as T & ErrorResponse;

        if (!response.ok) {
          throw new DevWorkApiError(response.status, data as ErrorResponse);
        }

        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof DevWorkApiError && err.statusCode < 500) {
          throw err;
        }
        if (attempt < attempts - 1) {
          await sleep(Math.min(1000 * 2 ** attempt, 5000));
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }
}

function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `run_${ts}_${rand}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
