import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

describe('marketplace', () => {
  it('seeds default marketplace entries', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);
    const snapshot = orchestrator.getSnapshot();

    expect(snapshot.marketplace.length).toBeGreaterThanOrEqual(6);
    expect(snapshot.marketplace.some((e) => e.category === 'runner')).toBe(true);
    expect(snapshot.marketplace.some((e) => e.category === 'plugin')).toBe(true);
  });

  it('installs and uninstalls marketplace entries', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const entry = orchestrator.getSnapshot().marketplace.find((e) => !e.installed);
    expect(entry).toBeDefined();

    orchestrator.installMarketplaceEntry(entry!.id);
    expect(orchestrator.getSnapshot().marketplace.find((e) => e.id === entry!.id)?.installed).toBe(true);

    orchestrator.uninstallMarketplaceEntry(entry!.id);
    expect(orchestrator.getSnapshot().marketplace.find((e) => e.id === entry!.id)?.installed).toBe(false);
  });

  it('throws for unknown marketplace entry', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    expect(() => orchestrator.installMarketplaceEntry('nonexistent')).toThrow('Marketplace entry not found');
  });
});
