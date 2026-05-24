import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

describe('sandbox config', () => {
  it('returns default sandbox config', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const snapshot = orchestrator.getSnapshot();

    expect(snapshot.sandboxConfig.enabled).toBe(false);
    expect(snapshot.sandboxConfig.runtime).toBe('none');
    expect(snapshot.sandboxConfig.memoryLimitMb).toBe(512);
    expect(snapshot.sandboxConfig.cpuLimit).toBe(1);
    expect(snapshot.sandboxConfig.networkAccess).toBe(false);
    expect(snapshot.sandboxConfig.timeoutSeconds).toBe(300);
  });

  it('updates sandbox config', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const updated = orchestrator.updateSandboxConfig({
      enabled: true,
      runtime: 'docker',
      image: 'node:20-slim',
      memoryLimitMb: 1024,
      networkAccess: true
    });

    expect(updated.enabled).toBe(true);
    expect(updated.runtime).toBe('docker');
    expect(updated.image).toBe('node:20-slim');
    expect(updated.memoryLimitMb).toBe(1024);
    expect(updated.networkAccess).toBe(true);
    expect(updated.cpuLimit).toBe(1);

    const snapshot = orchestrator.getSnapshot();
    expect(snapshot.sandboxConfig.enabled).toBe(true);
    expect(snapshot.sandboxConfig.runtime).toBe('docker');
  });
});
