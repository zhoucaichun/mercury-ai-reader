import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

function createFeedTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      feedUrl TEXT NOT NULL,
      siteUrl TEXT,
      description TEXT,
      feedParserVersion INTEGER,
      lastFetchedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_feedUrl ON feed(feedUrl);
  `);
}

function createEntryTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedId INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
      guid TEXT,
      url TEXT,
      title TEXT,
      author TEXT,
      publishedAt TEXT,
      summary TEXT,
      isRead INTEGER NOT NULL DEFAULT 0,
      isStarred INTEGER NOT NULL DEFAULT 0,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_feed_guid ON entry(feedId, guid);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_feed_url ON entry(feedId, url);
    CREATE INDEX IF NOT EXISTS idx_entry_feedId ON entry(feedId);
    CREATE INDEX IF NOT EXISTS idx_entry_isRead_publishedAt ON entry(isRead, publishedAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_entry_feed_publishedAt ON entry(feedId, publishedAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_entry_publishedAt ON entry(publishedAt, createdAt);
  `);
}

function createContentTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
      html TEXT,
      cleanedHtml TEXT,
      readabilityTitle TEXT,
      readabilityByline TEXT,
      readabilityVersion INTEGER,
      markdown TEXT,
      markdownVersion INTEGER,
      displayMode TEXT NOT NULL DEFAULT 'web',
      documentBaseUrl TEXT,
      pipelineType TEXT NOT NULL DEFAULT 'default',
      resolvedIntermediateContent TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_content_entryId ON content(entryId);
  `);
}

function createAppSettingsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

const migrations: Migration[] = [
  { version: 1, name: 'createFeed', up: createFeedTable },
  { version: 2, name: 'createEntry', up: createEntryTable },
  { version: 3, name: 'createContent', up: createContentTable },
  { version: 4, name: 'createAppSettings', up: createAppSettingsTable },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = db
    .prepare('SELECT version FROM _migrations')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.transaction(() => {
        migration.up(db);
        db.prepare(
          'INSERT INTO _migrations (version, name) VALUES (?, ?)',
        ).run(migration.version, migration.name);
      })();
    }
  }
}
