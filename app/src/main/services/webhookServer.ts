import http from 'node:http';
import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';
import type { ApiKeyService } from './apiKeys.js';
import {
  createId,
  nowIso,
  type ExternalIntegration,
  type WebhookEvent,
  type WebhookEventType,
  type WebhookServerConfig,
  type WebhookRunPayload,
  type WebhookUsagePayload,
  type WebhookArtifactPayload,
  type WebhookHeartbeatPayload
} from '../../shared/domain.js';

export interface WebhookServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getConfig(): WebhookServerConfig;
  updateConfig(update: Partial<WebhookServerConfig>): WebhookServerConfig;
  getEvents(limit?: number): WebhookEvent[];
  getIntegrations(): ExternalIntegration[];
  createIntegration(name: string, type: ExternalIntegration['type'], apiKeyId: string): ExternalIntegration;
  deleteIntegration(id: string): void;
}

const VALID_EVENT_TYPES: WebhookEventType[] = [
  'run.started', 'run.progress', 'run.completed', 'run.failed',
  'usage.report', 'artifact.created', 'heartbeat'
];

const DEFAULT_CONFIG: WebhookServerConfig = { enabled: false, port: 9400, host: '127.0.0.1' };
const CONFIG_KEY = 'webhook_server_config';

export function createWebhookServer(store: AppStore, apiKeys: ApiKeyService): WebhookServer {
  const log = logger.child('webhook-server');
  let server: http.Server | null = null;

  function loadConfig(): WebhookServerConfig {
    const stored = store.getById<WebhookServerConfig & { id: string }>('settings', CONFIG_KEY);
    return stored ? { enabled: stored.enabled, port: stored.port, host: stored.host } : { ...DEFAULT_CONFIG };
  }

  function saveConfig(config: WebhookServerConfig): void {
    store.put('settings', CONFIG_KEY, { id: CONFIG_KEY, ...config });
  }

  function findIntegrationByApiKey(apiKeyId: string): ExternalIntegration | null {
    const integrations = store.getAll<ExternalIntegration>('integrations');
    return integrations.find((i) => i.apiKeyId === apiKeyId) ?? null;
  }

  function updateIntegrationStats(
    integration: ExternalIntegration,
    event: WebhookEvent
  ): void {
    const updated: ExternalIntegration = {
      ...integration,
      lastSeenAt: nowIso(),
      eventCount: integration.eventCount + 1,
      status: 'active'
    };
    if (event.type === 'usage.report') {
      const payload = event.payload as WebhookUsagePayload;
      updated.totalTokens += payload.tokens;
      updated.totalCostUsd += payload.costUsd;
    }
    store.put('integrations', integration.id, updated);
  }

  function parseBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer) => {
        data += chunk.toString();
        if (data.length > 1_000_000) {
          reject(new Error('Payload too large'));
          req.destroy();
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  function sendJson(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(body));
  }

  function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (url.pathname === '/api/v1/status' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok', version: '1.0.0', uptime: process.uptime() });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Missing or invalid Authorization header. Use: Bearer <api-key>' });
      return;
    }
    const rawKey = authHeader.slice(7);
    const apiKey = apiKeys.validate(rawKey);
    if (!apiKey) {
      sendJson(res, 403, { error: 'Invalid or revoked API key' });
      return;
    }
    apiKeys.recordUsage(apiKey.id);

    const integration = findIntegrationByApiKey(apiKey.id);

    if (url.pathname === '/api/v1/events' && req.method === 'POST') {
      if (!apiKey.scopes.includes('events:write')) {
        sendJson(res, 403, { error: 'API key lacks events:write scope' });
        return;
      }
      void handleEventPost(req, res, apiKey.id, integration);
      return;
    }

    if (url.pathname === '/api/v1/events' && req.method === 'GET') {
      if (!apiKey.scopes.includes('events:read')) {
        sendJson(res, 403, { error: 'API key lacks events:read scope' });
        return;
      }
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const events = store.getAll<WebhookEvent>('telemetry')
        .filter((e) => 'integrationId' in e)
        .slice(-Math.min(limit, 500));
      sendJson(res, 200, { events });
      return;
    }

    sendJson(res, 404, { error: 'Not found. Available: POST /api/v1/events, GET /api/v1/events, GET /api/v1/status' });
  }

  async function handleEventPost(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    apiKeyId: string,
    integration: ExternalIntegration | null
  ): Promise<void> {
    try {
      const body = await parseBody(req);
      const data = JSON.parse(body) as { type?: string; payload?: unknown };

      if (!data.type || !VALID_EVENT_TYPES.includes(data.type as WebhookEventType)) {
        sendJson(res, 400, {
          error: `Invalid event type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
          received: data.type
        });
        return;
      }

      if (!data.payload || typeof data.payload !== 'object') {
        sendJson(res, 400, { error: 'Missing or invalid payload object' });
        return;
      }

      const event: WebhookEvent = {
        id: createId('event'),
        integrationId: integration?.id ?? apiKeyId,
        type: data.type as WebhookEventType,
        payload: data.payload as WebhookRunPayload | WebhookUsagePayload | WebhookArtifactPayload | WebhookHeartbeatPayload,
        receivedAt: nowIso()
      };

      store.put('telemetry', event.id, event);
      if (integration) updateIntegrationStats(integration, event);

      log.info('Webhook event received', { type: event.type, integrationId: event.integrationId });
      sendJson(res, 201, { id: event.id, status: 'accepted' });
    } catch (err) {
      log.error('Failed to process webhook event', { error: err instanceof Error ? err.message : String(err) });
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid request body' });
    }
  }

  return {
    async start(): Promise<void> {
      const config = loadConfig();
      if (server) return;
      server = http.createServer(handleRequest);
      await new Promise<void>((resolve, reject) => {
        server!.listen(config.port, config.host, () => {
          log.info(`Webhook server listening on ${config.host}:${config.port}`);
          resolve();
        });
        server!.on('error', reject);
      });
    },

    async stop(): Promise<void> {
      if (!server) return;
      await new Promise<void>((resolve) => {
        server!.close(() => {
          log.info('Webhook server stopped');
          server = null;
          resolve();
        });
      });
    },

    isRunning(): boolean {
      return server !== null && server.listening;
    },

    getConfig(): WebhookServerConfig {
      return loadConfig();
    },

    updateConfig(update: Partial<WebhookServerConfig>): WebhookServerConfig {
      const current = loadConfig();
      const updated: WebhookServerConfig = { ...current, ...update };
      saveConfig(updated);
      return updated;
    },

    getEvents(limit = 100): WebhookEvent[] {
      return store.getAll<WebhookEvent>('telemetry')
        .filter((e) => 'integrationId' in e)
        .slice(-Math.min(limit, 1000));
    },

    getIntegrations(): ExternalIntegration[] {
      return store.getAll<ExternalIntegration>('integrations');
    },

    createIntegration(name: string, type: ExternalIntegration['type'], apiKeyId: string): ExternalIntegration {
      const integration: ExternalIntegration = {
        id: createId('integration'),
        name,
        type,
        apiKeyId,
        status: 'inactive',
        lastSeenAt: null,
        eventCount: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        metadata: {},
        createdAt: nowIso()
      };
      store.put('integrations', integration.id, integration);
      return integration;
    },

    deleteIntegration(id: string): void {
      store.remove('integrations', id);
    }
  };
}
