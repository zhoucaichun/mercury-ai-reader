import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../init';
import { seedMockData, cleanSeedData } from '../seed';

describe('seed', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createInMemoryDatabase();
  });

  it('creates 3 mock feeds', () => {
    seedMockData(db);
    const feeds = db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number };
    expect(feeds.cnt).toBe(3);
  });

  it('creates 10 mock entries', () => {
    seedMockData(db);
    const entries = db.prepare('SELECT COUNT(*) as cnt FROM entry').get() as { cnt: number };
    expect(entries.cnt).toBe(10);
  });

  it('creates content for all entries', () => {
    seedMockData(db);
    const contents = db.prepare('SELECT COUNT(*) as cnt FROM content').get() as { cnt: number };
    expect(contents.cnt).toBe(10);
  });

  it('all content has three layers (html + cleanedHtml + markdown)', () => {
    seedMockData(db);
    const incomplete = db.prepare(
      "SELECT COUNT(*) as cnt FROM content WHERE html IS NULL OR cleanedHtml IS NULL OR markdown IS NULL",
    ).get() as { cnt: number };
    expect(incomplete.cnt).toBe(0);
  });

  it('entries have mixed read/starred states', () => {
    seedMockData(db);
    const readCount = (db.prepare('SELECT COUNT(*) as cnt FROM entry WHERE isRead = 1').get() as { cnt: number }).cnt;
    const starredCount = (db.prepare('SELECT COUNT(*) as cnt FROM entry WHERE isStarred = 1').get() as { cnt: number }).cnt;
    expect(readCount).toBeGreaterThan(0);
    expect(starredCount).toBeGreaterThan(0);
    expect(readCount).toBeLessThan(10);
    expect(starredCount).toBeLessThan(10);
  });

  it('respects mockFeeds = false option', () => {
    seedMockData(db, { mockFeeds: false });
    const feeds = db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number };
    expect(feeds.cnt).toBe(0);
  });

  it('respects mockEntries = false option', () => {
    seedMockData(db, { mockEntries: false });
    const feeds = db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number };
    const entries = db.prepare('SELECT COUNT(*) as cnt FROM entry').get() as { cnt: number };
    expect(feeds.cnt).toBe(3);
    expect(entries.cnt).toBe(0);
  });

  it('respects mockContents = false option', () => {
    seedMockData(db, { mockContents: false });
    const entries = db.prepare('SELECT COUNT(*) as cnt FROM entry').get() as { cnt: number };
    const contents = db.prepare('SELECT COUNT(*) as cnt FROM content').get() as { cnt: number };
    expect(entries.cnt).toBe(10);
    expect(contents.cnt).toBe(0);
  });

  it('is idempotent — seeding twice does not create duplicates', () => {
    seedMockData(db);
    seedMockData(db);
    const feeds = db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number };
    expect(feeds.cnt).toBe(3);
  });

  it('cleanSeedData removes all mock data', () => {
    seedMockData(db);

    cleanSeedData(db);

    const feeds = db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number };
    const entries = db.prepare('SELECT COUNT(*) as cnt FROM entry').get() as { cnt: number };
    const contents = db.prepare('SELECT COUNT(*) as cnt FROM content').get() as { cnt: number };

    expect(feeds.cnt).toBe(0);
    expect(entries.cnt).toBe(0);
    expect(contents.cnt).toBe(0);
  });

  it('cleanSeedData preserves non-seed data', () => {
    seedMockData(db);

    // Add a non-seed feed and entry
    db.prepare("INSERT INTO feed (feedUrl) VALUES ('https://custom.com/rss')").run();
    db.prepare("INSERT INTO entry (feedId, guid) VALUES ((SELECT id FROM feed WHERE feedUrl = 'https://custom.com/rss'), 'custom-1')").run();

    cleanSeedData(db);

    const feeds = db.prepare('SELECT COUNT(*) as cnt FROM feed').get() as { cnt: number };
    expect(feeds.cnt).toBe(1); // custom feed remains
  });
});
