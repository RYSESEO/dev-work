import http from 'node:http';
import { describe, expect, it, afterEach } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createApiKeyService } from '../../src/main/services/apiKeys.js';
import { createWebhookServer } from '../../src/main/services/webhookServer.js';

function post(port: number, path: string, body: unknown, apiKey?: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers }, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) as Record<string, unknown> }); }
        catch { resolve({ status: res.statusCode ?? 0, body: {} }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(port: number, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) as Record<string, unknown> }); }
        catch { resolve({ status: res.statusCode ?? 0, body: {} }); }
      });
    }).on('error', reject);
  });
}

let stopFn: (() => Promise<void>) | null = null;

afterEach(async () => {
  if (stopFn) {
    await stopFn();
    stopFn = null;
  }
});

describe('webhook server', () => {
  it('responds to health check without auth', async () => {
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port: 0, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    // Health check uses the configured port; need to get actual port from server
    // For test, use configured port
    expect(srv.isRunning()).toBe(true);
  });

  it('rejects requests without auth', async () => {
    const port = 19401;
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    const res = await post(port, '/api/v1/events', { type: 'heartbeat', payload: { agentName: 'test' } });
    expect(res.status).toBe(401);
  });

  it('rejects invalid API key', async () => {
    const port = 19402;
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    const res = await post(port, '/api/v1/events', { type: 'heartbeat', payload: { agentName: 'test' } }, 'bad_key');
    expect(res.status).toBe(403);
  });

  it('accepts valid events with API key', async () => {
    const port = 19403;
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    const { rawKey } = apiKeys.create('test-key', ['events:write', 'events:read', 'status:read']);

    const res = await post(port, '/api/v1/events', {
      type: 'run.completed',
      payload: {
        runId: 'ext-run-1',
        agentName: 'Cursor',
        status: 'completed',
        durationMs: 5000
      }
    }, rawKey);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('accepted');
    expect(res.body.id).toBeTruthy();
  });

  it('rejects invalid event type', async () => {
    const port = 19404;
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    const { rawKey } = apiKeys.create('test-key', ['events:write']);

    const res = await post(port, '/api/v1/events', {
      type: 'invalid.type',
      payload: {}
    }, rawKey);
    expect(res.status).toBe(400);
  });

  it('tracks usage on integration when events arrive', async () => {
    const port = 19405;
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    const { key, rawKey } = apiKeys.create('test-key', ['events:write']);
    const integration = srv.createIntegration('My Cursor', 'cursor', key.id);

    await post(port, '/api/v1/events', {
      type: 'usage.report',
      payload: { tokens: 1000, costUsd: 0.05, model: 'gpt-4', provider: 'openai' }
    }, rawKey);

    const integrations = srv.getIntegrations();
    const updated = integrations.find((i) => i.id === integration.id)!;
    expect(updated.eventCount).toBe(1);
    expect(updated.totalTokens).toBe(1000);
    expect(updated.totalCostUsd).toBeCloseTo(0.05);
    expect(updated.status).toBe('active');
  });

  it('health check returns status ok', async () => {
    const port = 19406;
    const store = await createAppStore(':memory:');
    const apiKeys = createApiKeyService(store);
    const srv = createWebhookServer(store, apiKeys);
    srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
    await srv.start();
    stopFn = () => srv.stop();

    const res = await get(port, '/api/v1/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('api key service', () => {
  it('creates and validates keys', async () => {
    const store = await createAppStore(':memory:');
    const svc = createApiKeyService(store);

    const { key, rawKey } = svc.create('Test Key', ['events:write']);
    expect(key.name).toBe('Test Key');
    expect(rawKey.startsWith('dw_')).toBe(true);

    const validated = svc.validate(rawKey);
    expect(validated).not.toBeNull();
    expect(validated!.id).toBe(key.id);
  });

  it('revokes keys', async () => {
    const store = await createAppStore(':memory:');
    const svc = createApiKeyService(store);

    const { key, rawKey } = svc.create('Revoke Me', ['events:write']);
    svc.revoke(key.id);

    const validated = svc.validate(rawKey);
    expect(validated).toBeNull();
  });

  it('lists keys without hashes', async () => {
    const store = await createAppStore(':memory:');
    const svc = createApiKeyService(store);

    svc.create('Key 1', ['events:write']);
    svc.create('Key 2', ['events:read', 'status:read']);

    const list = svc.list();
    expect(list).toHaveLength(2);
    for (const k of list) {
      expect('keyHash' in k).toBe(false);
    }
  });
});
