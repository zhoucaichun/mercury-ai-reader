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
    expect(tableNames).toContain('agent_task_run');
    expect(tableNames).toContain('summary_result');
    expect(tableNames).toContain('translation_result');
    expect(tableNames).toContain('translation_segment');
    expect(tableNames).toContain('llm_usage_event');
  });

  it('records all applied migrations in _migrations table', () => {
    const db = createInMemoryDatabase();

    const rows = db
      .prepare('SELECT version, name FROM _migrations ORDER BY version')
      .all() as Array<{ version: number; name: string }>;

    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ version: 1, name: 'createFeed' });
    expect(rows[1]).toEqual({ version: 2, name: 'createEntry' });
    expect(rows[2]).toEqual({ version: 3, name: 'createContent' });
    expect(rows[3]).toEqual({ version: 4, name: 'createAppSettings' });
    expect(rows[4]).toEqual({ version: 5, name: 'addFeedEnabledColumn' });
    expect(rows[5]).toEqual({ version: 6, name: 'createAgentTaskRun' });
    expect(rows[6]).toEqual({ version: 7, name: 'createSummaryResult' });
    expect(rows[7]).toEqual({ version: 8, name: 'createTranslationResult' });
    expect(rows[8]).toEqual({ version: 9, name: 'createTranslationSegment' });
    expect(rows[9]).toEqual({ version: 10, name: 'createLLMUsageEvent' });
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
    expect(indexNames).toContain('idx_atr_entryId');
    expect(indexNames).toContain('idx_summary_entryId');
    expect(indexNames).toContain('idx_translation_entryId');
    expect(indexNames).toContain('idx_lue_createdAt');
  });

  it('enables foreign keys', () => {
    const db = createInMemoryDatabase();

    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
  });
});
