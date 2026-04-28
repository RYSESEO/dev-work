import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';

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
  | 'artifacts';

export interface AppStore {
  put<T extends { id: string }>(collection: StoreCollection, id: string, value: T): void;
  getById<T>(collection: StoreCollection, id: string): T | null;
  getAll<T>(collection: StoreCollection): T[];
  remove(collection: StoreCollection, id: string): void;
  exportToDisk(): void;
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
  'artifacts'
];

const require = createRequire(import.meta.url);

export async function createAppStore(databasePath: string): Promise<AppStore> {
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });
  const isMemory = databasePath === ':memory:';
  const existing = !isMemory && fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : undefined;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);

  function persist(): void {
    if (isMemory) return;
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.writeFileSync(databasePath, Buffer.from(db.export()));
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
      persist();
    },
    exportToDisk(): void {
      persist();
    }
  };
}

function assertCollection(collection: StoreCollection): void {
  if (!collections.includes(collection)) {
    throw new Error(`Unknown store collection: ${collection}`);
  }
}
