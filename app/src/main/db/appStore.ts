import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { runMigrations } from './migrations.js';

export type StoreCollection =
  | 'missions'
  | 'tasks'
  | 'agents'
  | 'runnerProfiles'
  | 'runs'
  | 'approvals'
  | 'grants'
  | 'usage'
  | 'events'
  | 'artifacts'
  | 'marketplace'
  | 'plugins'
  | 'users'
  | 'auditLog'
  | 'workflows'
  | 'workflowRuns'
  | 'sandboxConfig'
  | 'settings'
  | 'telemetry';

export interface AppStore {
  put<T extends { id: string }>(collection: StoreCollection, id: string, value: T): void;
  getById<T>(collection: StoreCollection, id: string): T | null;
  getAll<T>(collection: StoreCollection): T[];
  remove(collection: StoreCollection, id: string): void;
  exportToDisk(): void;
  getVersion(): number;
  getChangedCollections(sinceVersion: number): Set<StoreCollection>;
}

const collections: StoreCollection[] = [
  'missions',
  'tasks',
  'agents',
  'runnerProfiles',
  'runs',
  'approvals',
  'grants',
  'usage',
  'events',
  'artifacts',
  'marketplace',
  'plugins',
  'users',
  'auditLog',
  'workflows',
  'workflowRuns',
  'sandboxConfig',
  'settings',
  'telemetry'
];

const require = createRequire(import.meta.url);

export async function createAppStore(databasePath: string): Promise<AppStore> {
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });
  const isMemory = databasePath === ':memory:';
  const existing = !isMemory && existsSync(databasePath) ? readFileSync(databasePath) : undefined;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  runMigrations(db);

  let version = 0;
  const changeLog = new Map<number, StoreCollection>();

  function trackChange(collection: StoreCollection): void {
    version++;
    changeLog.set(version, collection);
    if (changeLog.size > 500) {
      const cutoff = version - 500;
      for (const key of changeLog.keys()) {
        if (key <= cutoff) changeLog.delete(key);
        else break;
      }
    }
  }

  let persistQueued = false;
  function persist(): void {
    if (isMemory || persistQueued) return;
    persistQueued = true;
    queueMicrotask(() => {
      persistQueued = false;
      void fs.mkdir(path.dirname(databasePath), { recursive: true }).then(() =>
        fs.writeFile(databasePath, Buffer.from(db.export()))
      );
    });
  }

  return {
    put<T extends { id: string }>(collection: StoreCollection, id: string, value: T): void {
      assertCollection(collection);
      db.run(
        `INSERT INTO records (collection, id, json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(collection, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
        [collection, id, JSON.stringify(value), new Date().toISOString()]
      );
      trackChange(collection);
      persist();
    },
    getById<T>(collection: StoreCollection, id: string): T | null {
      assertCollection(collection);
      const stmt = db.prepare('SELECT json FROM records WHERE collection = ? AND id = ?');
      stmt.bind([collection, id]);
      const value = stmt.step() ? (JSON.parse(stmt.getAsObject().json as string) as T) : null;
      stmt.free();
      return value;
    },
    getAll<T>(collection: StoreCollection): T[] {
      assertCollection(collection);
      const stmt = db.prepare('SELECT json FROM records WHERE collection = ? ORDER BY updated_at ASC');
      stmt.bind([collection]);
      const values: T[] = [];
      while (stmt.step()) values.push(JSON.parse(stmt.getAsObject().json as string) as T);
      stmt.free();
      return values;
    },
    remove(collection: StoreCollection, id: string): void {
      assertCollection(collection);
      db.run('DELETE FROM records WHERE collection = ? AND id = ?', [collection, id]);
      trackChange(collection);
      persist();
    },
    exportToDisk(): void {
      persist();
    },
    getVersion(): number {
      return version;
    },
    getChangedCollections(sinceVersion: number): Set<StoreCollection> {
      const changed = new Set<StoreCollection>();
      for (const [v, collection] of changeLog) {
        if (v > sinceVersion) changed.add(collection);
      }
      return changed;
    }
  };
}

function assertCollection(collection: StoreCollection): void {
  if (!collections.includes(collection)) {
    throw new Error(`Unknown store collection: ${collection}`);
  }
}
