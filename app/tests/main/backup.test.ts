import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createBackupService } from '../../src/main/services/backup.js';
import type { Mission } from '../../src/shared/domain.js';

const TEST_BACKUP_DIR = path.join(process.cwd(), '.test-backups');

afterEach(async () => {
  if (existsSync(TEST_BACKUP_DIR)) {
    await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true });
  }
});

describe('backup', () => {
  it('creates and restores a backup', async () => {
    const store = await createAppStore(':memory:');
    const backup = createBackupService(store);

    const mission: Mission = {
      id: 'mission_backup1',
      title: 'Test Mission',
      goal: 'Test backup',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    store.put('missions', mission.id, mission);

    const backupPath = path.join(TEST_BACKUP_DIR, 'test-backup.json');
    const meta = await backup.createBackup(backupPath);

    expect(meta.totalRecords).toBeGreaterThanOrEqual(1);
    expect(meta.version).toBe('1.0.0');
    expect(existsSync(backupPath)).toBe(true);

    // Restore to a new store
    const store2 = await createAppStore(':memory:');
    const backup2 = createBackupService(store2);
    await backup2.restoreBackup(backupPath);

    const restoredMissions = store2.getAll<Mission>('missions');
    expect(restoredMissions.find((m) => m.id === 'mission_backup1')).toBeTruthy();
  });

  it('auto-backup creates a timestamped file', async () => {
    const store = await createAppStore(':memory:');
    const backup = createBackupService(store);

    const resultPath = await backup.autoBackup(TEST_BACKUP_DIR);
    expect(existsSync(resultPath)).toBe(true);
    expect(resultPath).toContain('backup-');
  });

  it('lists backups in a directory', async () => {
    const store = await createAppStore(':memory:');
    const backup = createBackupService(store);

    await backup.autoBackup(TEST_BACKUP_DIR);
    await backup.autoBackup(TEST_BACKUP_DIR);

    const backupsDir = path.join(TEST_BACKUP_DIR, 'backups');
    const list = await backup.listBackups(backupsDir);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid backup files', async () => {
    const store = await createAppStore(':memory:');
    const backup = createBackupService(store);

    const badPath = path.join(TEST_BACKUP_DIR, 'bad-backup.json');
    await fs.mkdir(TEST_BACKUP_DIR, { recursive: true });
    await fs.writeFile(badPath, '{"notvalid": true}', 'utf-8');

    await expect(backup.restoreBackup(badPath)).rejects.toThrow('Invalid backup file format');
  });
});
