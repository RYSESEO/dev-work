import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import type { Mission } from '../../src/shared/domain.js';

describe('appStore', () => {
  it('persists and reads records by collection', async () => {
    const store = await createAppStore(':memory:');
    const mission: Mission = {
      id: 'mission_test',
      title: 'Build command center',
      goal: 'Coordinate agents',
      status: 'active',
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z'
    };

    store.put('missions', mission.id, mission);

    expect(store.getAll<Mission>('missions')).toEqual([mission]);
    expect(store.getById<Mission>('missions', mission.id)).toEqual(mission);
  });

  it('updates existing records without duplicating ids', async () => {
    const store = await createAppStore(':memory:');

    store.put('missions', 'mission_test', { id: 'mission_test', title: 'First' });
    store.put('missions', 'mission_test', { id: 'mission_test', title: 'Second' });

    expect(store.getAll<{ id: string; title: string }>('missions')).toEqual([{ id: 'mission_test', title: 'Second' }]);
  });
});
