import { describe, expect, it, afterEach } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createEnterpriseService } from '../../src/main/services/enterprise.js';

describe('enterprise service', () => {
  const servers: Array<{ stop(): Promise<void> }> = [];
  afterEach(async () => {
    for (const srv of servers) {
      await srv.stop();
    }
    servers.length = 0;
  });

  it('returns default cloud sync config', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const config = ent.cloudSync.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.status).toBe('disabled');
    expect(config.encryptionEnabled).toBe(true);
    expect(config.syncIntervalSeconds).toBe(300);
  });

  it('updates cloud sync config', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const updated = ent.cloudSync.updateConfig({
      endpoint: 'https://sync.test.com',
      teamId: 'team-1',
      enabled: true
    });
    expect(updated.endpoint).toBe('https://sync.test.com');
    expect(updated.teamId).toBe('team-1');
    expect(updated.enabled).toBe(true);
    expect(updated.status).toBe('idle');
  });

  it('encrypts and decrypts data', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const plaintext = 'sensitive mission data';
    const key = 'test-encryption-key';
    const encrypted = ent.cloudSync.encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    const decrypted = ent.cloudSync.decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('triggers sync when enabled', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    ent.cloudSync.updateConfig({ enabled: true, endpoint: 'https://sync.test.com' });
    const records = ent.cloudSync.triggerSync();
    expect(records.length).toBeGreaterThan(0);
    expect(records[0].action).toBe('push');
    expect(records[0].status).toBe('completed');
    const config = ent.cloudSync.getConfig();
    expect(config.lastSyncAt).not.toBeNull();
  });

  it('throws when syncing without enabling', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    expect(() => ent.cloudSync.triggerSync()).toThrow('Cloud sync is not enabled');
  });

  it('returns default SSO config', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const config = ent.sso.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.provider).toBe('oidc');
    expect(config.autoProvision).toBe(false);
  });

  it('updates SSO config and validates domain', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    ent.sso.updateConfig({
      enabled: true,
      provider: 'saml',
      issuerUrl: 'https://sso.example.com',
      clientId: 'client-123',
      allowedDomains: ['example.com', 'corp.io']
    });
    expect(ent.sso.validateDomain('user@example.com')).toBe(true);
    expect(ent.sso.validateDomain('user@other.com')).toBe(false);
  });

  it('builds SSO auth URL', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    ent.sso.updateConfig({
      enabled: true,
      provider: 'oidc',
      issuerUrl: 'https://sso.example.com',
      clientId: 'client-123'
    });
    const url = ent.sso.buildAuthUrl();
    expect(url).toContain('https://sso.example.com/authorize');
    expect(url).toContain('client_id=client-123');
  });

  it('creates and manages sandbox executions', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const exec = ent.sandbox.createExecution('run_1', 'node:20', 'docker', 'restricted');
    expect(exec.status).toBe('running');
    expect(exec.runtime).toBe('docker');
    expect(exec.containerId).not.toBeNull();
    expect(exec.networkPolicy).toBe('restricted');

    const stopped = ent.sandbox.stopExecution(exec.id);
    expect(stopped.status).toBe('stopped');
    expect(stopped.stoppedAt).not.toBeNull();

    ent.sandbox.destroyExecution(exec.id);
    const destroyed = ent.sandbox.getExecution(exec.id);
    expect(destroyed?.status).toBe('destroyed');
  });

  it('lists sandbox executions', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    ent.sandbox.createExecution('run_1', 'node:20', 'docker', 'none');
    ent.sandbox.createExecution('run_2', 'python:3.12', 'firecracker', 'full');
    const list = ent.sandbox.listExecutions();
    expect(list.length).toBe(2);
    const byRun = ent.sandbox.getExecutionsByRun('run_1');
    expect(byRun.length).toBe(1);
  });

  it('generates compliance report', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const report = ent.compliance.generateReport();
    expect(report.framework).toBe('soc2_type1');
    expect(report.totalControls).toBeGreaterThan(0);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.controls.length).toBe(report.totalControls);
  });

  it('returns default REST API config', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const config = ent.restApi.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.port).toBe(8080);
    expect(config.authRequired).toBe(true);
  });

  it('updates REST API config', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const updated = ent.restApi.updateConfig({ port: 9090, rateLimitPerMinute: 120 });
    expect(updated.port).toBe(9090);
    expect(updated.rateLimitPerMinute).toBe(120);
  });

  it('starts and stops REST API server', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    ent.restApi.updateConfig({ port: 0 });
    servers.push(ent.restApi);
    await ent.restApi.start();
    const status = ent.restApi.getStatus();
    expect(status.running).toBe(true);
    expect(status.startedAt).not.toBeNull();
    await ent.restApi.stop();
    const stopped = ent.restApi.getStatus();
    expect(stopped.running).toBe(false);
  });

  it('returns enterprise snapshot', async () => {
    const store = await createAppStore(':memory:');
    const ent = createEnterpriseService(store);
    const snapshot = ent.getSnapshot();
    expect(snapshot.cloudSync).toBeDefined();
    expect(snapshot.sso).toBeDefined();
    expect(snapshot.sandboxExecutions).toEqual([]);
    expect(snapshot.compliance).toBeDefined();
    expect(snapshot.restApi).toBeDefined();
    expect(snapshot.restApiStatus).toBeDefined();
    expect(snapshot.compliance.framework).toBe('soc2_type1');
  });
});
