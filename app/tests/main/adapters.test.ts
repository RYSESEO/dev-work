import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createApiKeyService } from '../../src/main/services/apiKeys.js';
import { createWebhookServer } from '../../src/main/services/webhookServer.js';

/**
 * Adapter integration tests — verify the SDK/CLI communication patterns
 * work correctly with the webhook server.
 */

function postJson(
  port: number,
  path: string,
  body: unknown,
  apiKey: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk: Buffer) => {
          raw += chunk.toString();
        });
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(raw) as Record<string, unknown>
            });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: {} });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function setup(port: number) {
  const store = await createAppStore(':memory:');
  const apiKeys = createApiKeyService(store);
  const srv = createWebhookServer(store, apiKeys);
  srv.updateConfig({ enabled: true, port, host: '127.0.0.1' });
  await srv.start();
  const created = apiKeys.create('adapter-test', ['events:write', 'events:read', 'status:read']);
  srv.createIntegration('Test Agent', 'cli', created.key.id);
  return { srv, rawKey: created.rawKey };
}

describe('adapter event patterns', () => {
  it('handles SDK-style run lifecycle (started → progress → completed)', async () => {
    const port = 19420;
    const { srv, rawKey } = await setup(port);
    try {
      const runId = 'sdk-test-run-001';

      const r1 = await postJson(port, '/api/v1/events', {
        type: 'run.started',
        payload: { runId, agentName: 'test-sdk', status: 'started', prompt: 'Test run lifecycle' }
      }, rawKey);
      expect(r1.status).toBe(201);

      const r2 = await postJson(port, '/api/v1/events', {
        type: 'run.progress',
        payload: { runId, agentName: 'test-sdk', status: 'running', output: 'Working...' }
      }, rawKey);
      expect(r2.status).toBe(201);

      const r3 = await postJson(port, '/api/v1/events', {
        type: 'run.completed',
        payload: { runId, agentName: 'test-sdk', status: 'completed', output: 'Done!', durationMs: 5000 }
      }, rawKey);
      expect(r3.status).toBe(201);

      const events = srv.getEvents(10);
      const runEvents = events.filter(
        (e) => (e.payload as unknown as Record<string, unknown>).runId === runId
      );
      expect(runEvents).toHaveLength(3);
    } finally {
      await srv.stop();
    }
  });

  it('handles CLI-style run (started → failed)', async () => {
    const port = 19421;
    const { srv, rawKey } = await setup(port);
    try {
      const runId = 'cli-test-run-001';

      const r1 = await postJson(port, '/api/v1/events', {
        type: 'run.started',
        payload: { runId, agentName: 'cli-agent', status: 'started', prompt: 'npm test', metadata: { cwd: '/home/user/project', command: 'npm', args: 'test' } }
      }, rawKey);
      expect(r1.status).toBe(201);

      const r2 = await postJson(port, '/api/v1/events', {
        type: 'run.failed',
        payload: { runId, agentName: 'cli-agent', status: 'failed', error: 'Process exited with code 1', durationMs: 3200, metadata: { exitCode: '1', command: 'npm test' } }
      }, rawKey);
      expect(r2.status).toBe(201);
    } finally {
      await srv.stop();
    }
  });

  it('handles CI/CD pipeline event with GitHub metadata', async () => {
    const port = 19422;
    const { srv, rawKey } = await setup(port);
    try {
      const res = await postJson(port, '/api/v1/events', {
        type: 'run.completed',
        payload: {
          runId: 'cirun_abc123',
          agentName: 'github-actions',
          status: 'completed',
          output: 'Pipeline CI #42 completed',
          durationMs: 180000,
          metadata: { repo: 'RYSESEO/dev-work', sha: 'abc12345', ref: 'refs/heads/main', workflow: 'CI', runNumber: '42', actor: 'octocat' }
        }
      }, rawKey);
      expect(res.status).toBe(201);
    } finally {
      await srv.stop();
    }
  });

  it('handles usage reporting with model and provider', async () => {
    const port = 19423;
    const { srv, rawKey } = await setup(port);
    try {
      const res = await postJson(port, '/api/v1/events', {
        type: 'usage.report',
        payload: { runId: 'sdk-run-usage', tokens: 4200, costUsd: 0.126, model: 'gpt-4o', provider: 'openai' }
      }, rawKey);
      expect(res.status).toBe(201);

      const integrations = srv.getIntegrations();
      const updated = integrations[0]!;
      expect(updated.totalTokens).toBe(4200);
      expect(updated.totalCostUsd).toBeCloseTo(0.126);
    } finally {
      await srv.stop();
    }
  });

  it('handles heartbeat with version and uptime', async () => {
    const port = 19424;
    const { srv, rawKey } = await setup(port);
    try {
      const res = await postJson(port, '/api/v1/events', {
        type: 'heartbeat',
        payload: { agentName: 'cursor', version: '0.45.2', uptime: 3600 }
      }, rawKey);
      expect(res.status).toBe(201);
    } finally {
      await srv.stop();
    }
  });

  it('handles artifact creation event', async () => {
    const port = 19425;
    const { srv, rawKey } = await setup(port);
    try {
      const res = await postJson(port, '/api/v1/events', {
        type: 'artifact.created',
        payload: { runId: 'sdk-run-artifact', title: 'Refactoring Summary', kind: 'summary', content: 'Converted 3 functions.' }
      }, rawKey);
      expect(res.status).toBe(201);
    } finally {
      await srv.stop();
    }
  });

  it('handles batch of rapid events (simulates high-throughput adapter)', async () => {
    const port = 19426;
    const { srv, rawKey } = await setup(port);
    try {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          postJson(port, '/api/v1/events', {
            type: 'usage.report',
            payload: { tokens: 100 * (i + 1), costUsd: 0.003 * (i + 1), model: 'gpt-4o-mini', provider: 'openai' }
          }, rawKey)
        )
      );
      for (const r of results) {
        expect(r.status).toBe(201);
      }

      const integrations = srv.getIntegrations();
      const updated = integrations[0]!;
      expect(updated.eventCount).toBe(5);
      expect(updated.totalTokens).toBe(100 + 200 + 300 + 400 + 500);
    } finally {
      await srv.stop();
    }
  });
});
