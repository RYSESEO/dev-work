import type { Database } from 'sql.js';
import { logger } from '../logger.js';

interface Migration {
  version: number;
  description: string;
  up(db: Database): void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — records table',
    up(db) {
      db.run(`
        CREATE TABLE IF NOT EXISTS records (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (collection, id)
        )
      `);
    }
  }
];

export function runMigrations(db: Database): void {
  const log = logger.child('migrations');

  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 0,
      migrated_at TEXT NOT NULL
    )
  `);

  const stmt = db.prepare('SELECT version FROM schema_version WHERE id = 1');
  let currentVersion = 0;
  if (stmt.step()) {
    currentVersion = stmt.getAsObject().version as number;
  }
  stmt.free();

  if (currentVersion === 0 && migrations.length > 0) {
    db.run(
      'INSERT OR REPLACE INTO schema_version (id, version, migrated_at) VALUES (1, 0, ?)',
      [new Date().toISOString()]
    );
  }

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) {
    log.info(`Schema up to date at version ${currentVersion}`);
    return;
  }

  log.info(`Running ${pending.length} migration(s) from v${currentVersion}`, {
    target: pending[pending.length - 1].version
  });

  for (const migration of pending) {
    log.info(`Applying migration v${migration.version}: ${migration.description}`);
    migration.up(db);
    db.run(
      'UPDATE schema_version SET version = ?, migrated_at = ? WHERE id = 1',
      [migration.version, new Date().toISOString()]
    );
  }

  log.info(`Migrations complete. Schema at v${pending[pending.length - 1].version}`);
}
