import { describe, it, expect } from 'vitest';
import { createInMemoryDatabase } from '../init';
import { runMigrations } from '../migrations';

describe('migrations', () => {
  it('creates all W1 tables on first run', () => {
    const db = createInMemoryDatabase();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('feed');
    expect(tableNames).toContain('entry');
    expect(tableNames).toContain('content');
    expect(tableNames).toContain('app_settings');
    expect(tableNames).toContain('_migrations');
  });

  it('records all applied migrations in _migrations table', () => {
    const db = createInMemoryDatabase();

    const rows = db
      .prepare('SELECT version, name FROM _migrations ORDER BY version')
      .all() as Array<{ version: number; name: string }>;

    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ version: 1, name: 'createFeed' });
    expect(rows[1]).toEqual({ version: 2, name: 'createEntry' });
    expect(rows[2]).toEqual({ version: 3, name: 'createContent' });
    expect(rows[3]).toEqual({ version: 4, name: 'createAppSettings' });
  });

  it('is idempotent — second run does not re-apply migrations', () => {
    const db = createInMemoryDatabase();

    // Insert data to verify it survives
    db.prepare("INSERT INTO feed (feedUrl) VALUES ('https://test.com/rss')").run();

    // Run migrations again (would fail if trying to recreate tables)
    runMigrations(db);

    // Data still there
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number }).cnt;
    expect(count).toBe(1);
  });

  it('creates expected indexes', () => {
    const db = createInMemoryDatabase();

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_feed_feedUrl');
    expect(indexNames).toContain('idx_entry_feed_guid');
    expect(indexNames).toContain('idx_entry_feed_url');
    expect(indexNames).toContain('idx_content_entryId');
  });

  it('enables foreign keys', () => {
    const db = createInMemoryDatabase();

    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
  });
});
