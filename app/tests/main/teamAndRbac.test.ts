import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createOrchestrator } from '../../src/main/services/orchestrator.js';

describe('team and RBAC', () => {
  it('seeds a default admin user', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);
    const snapshot = orchestrator.getSnapshot();

    expect(snapshot.users).toHaveLength(1);
    expect(snapshot.users[0].role).toBe('admin');
    expect(snapshot.currentUser).not.toBeNull();
  });

  it('creates a new user', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const user = orchestrator.createUser('Alice', 'alice@example.com', 'operator');

    expect(user.name).toBe('Alice');
    expect(user.email).toBe('alice@example.com');
    expect(user.role).toBe('operator');
    expect(orchestrator.getSnapshot().users).toHaveLength(2);
  });

  it('updates user role', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    const user = orchestrator.createUser('Bob', 'bob@example.com', 'viewer');
    orchestrator.updateUserRole(user.id, 'admin');

    const updated = orchestrator.getSnapshot().users.find((u) => u.id === user.id);
    expect(updated?.role).toBe('admin');
  });

  it('throws for empty name or email', async () => {
    const store = await createAppStore(':memory:');
    const orchestrator = await createOrchestrator(store);

    expect(() => orchestrator.createUser('', 'a@b.com', 'viewer')).toThrow('User name is required');
    expect(() => orchestrator.createUser('X', '', 'viewer')).toThrow('User email is required');
  });
});
