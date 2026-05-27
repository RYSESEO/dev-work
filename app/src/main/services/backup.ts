import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { AppStore, StoreCollection } from '../db/appStore.js';
import { logger } from '../logger.js';

const log = logger.child('backup');

const BACKUP_COLLECTIONS: StoreCollection[] = [
  'missions', 'tasks', 'agents', 'runnerProfiles', 'runs',
  'approvals', 'grants', 'usage', 'events', 'artifacts',
  'marketplace', 'plugins', 'users', 'auditLog',
  'workflows', 'workflowRuns', 'sandboxConfig', 'settings', 'telemetry'
];

export interface BackupMetadata {
  version: string;
  createdAt: string;
  collections: number;
  totalRecords: number;
}

interface BackupData {
  meta: BackupMetadata;
  data: Record<string, Array<{ id: string; [key: string]: unknown }>>;
}

export interface BackupService {
  createBackup(targetPath: string): Promise<BackupMetadata>;
  restoreBackup(sourcePath: string): Promise<BackupMetadata>;
  listBackups(directory: string): Promise<BackupMetadata[]>;
  autoBackup(dataDir: string): Promise<string>;
}

export function createBackupService(store: AppStore): BackupService {
  function collectAllData(): BackupData {
    const data: Record<string, Array<{ id: string; [key: string]: unknown }>> = {};
    let totalRecords = 0;

    for (const collection of BACKUP_COLLECTIONS) {
      const records = store.getAll<{ id: string }>(collection);
      data[collection] = records;
      totalRecords += records.length;
    }

    return {
      meta: {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        collections: Object.keys(data).length,
        totalRecords
      },
      data
    };
  }

  async function createBackup(targetPath: string): Promise<BackupMetadata> {
    const backup = collectAllData();
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(backup, null, 2), 'utf-8');
    log.info('Backup created', { path: targetPath, records: backup.meta.totalRecords });
    return backup.meta;
  }

  async function restoreBackup(sourcePath: string): Promise<BackupMetadata> {
    const raw = await fs.readFile(sourcePath, 'utf-8');
    const backup = JSON.parse(raw) as BackupData;

    if (!backup.meta?.version || !backup.data) {
      throw new Error('Invalid backup file format');
    }

    for (const [collection, records] of Object.entries(backup.data)) {
      if (!BACKUP_COLLECTIONS.includes(collection as StoreCollection)) continue;
      for (const record of records) {
        if (!record.id) continue;
        store.put(collection as StoreCollection, record.id, record as { id: string });
      }
    }

    log.info('Backup restored', { path: sourcePath, records: backup.meta.totalRecords });
    return backup.meta;
  }

  async function listBackups(directory: string): Promise<BackupMetadata[]> {
    if (!existsSync(directory)) return [];
    const files = await fs.readdir(directory);
    const backups: BackupMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(directory, file), 'utf-8');
        const parsed = JSON.parse(raw) as BackupData;
        if (parsed.meta?.version) {
          backups.push(parsed.meta);
        }
      } catch {
        // skip invalid files
      }
    }

    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function autoBackup(dataDir: string): Promise<string> {
    const backupDir = path.join(dataDir, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
    await createBackup(backupPath);
    return backupPath;
  }

  return { createBackup, restoreBackup, listBackups, autoBackup };
}
