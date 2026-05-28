import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from './migrations';

export function initDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'mercury.sqlite');
  const db = new Database(dbPath);
  configureDatabase(db);
  runMigrations(db);
  return db;
}

export function createInMemoryDatabase(): Database.Database {
  const db = new Database(':memory:');
  configureDatabase(db);
  runMigrations(db);
  return db;
}

function configureDatabase(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
}
