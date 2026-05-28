import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import type { IFeedStore } from '../feedStore';

describe('FeedStore', () => {
  let db: Database.Database;
  let store: IFeedStore;

  beforeEach(() => {
    db = createInMemoryDatabase();
    store = createFeedStore(db);
  });

  it('creates a feed and returns it with id', () => {
    const feed = store.upsert({
      title: 'Test Feed',
      feedUrl: 'https://example.com/rss',
      siteUrl: 'https://example.com',
      description: 'A test feed',
      feedParserVersion: 1,
      lastFetchedAt: null,
    });

    expect(feed.id).toBeGreaterThan(0);
    expect(feed.feedUrl).toBe('https://example.com/rss');
    expect(feed.title).toBe('Test Feed');
    expect(feed.createdAt).toBeTruthy();
  });

  it('upserts by feedUrl — same feedUrl updates existing record', () => {
    const feed1 = store.upsert({
      title: 'Original Title',
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });

    const feed2 = store.upsert({
      title: 'Updated Title',
      feedUrl: 'https://example.com/rss',
      siteUrl: 'https://example.com',
      description: 'Updated description',
      feedParserVersion: 2,
      lastFetchedAt: '2026-05-28T10:00:00.000Z',
    });

    expect(feed2.id).toBe(feed1.id);
    expect(feed2.title).toBe('Updated Title');
    expect(feed2.siteUrl).toBe('https://example.com');
    expect(feed2.description).toBe('Updated description');
  });

  it('deletes a feed and cascades to entries', () => {
    const feed = store.upsert({
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });

    // Create entry referencing this feed
    db.prepare(
      "INSERT INTO entry (feedId, guid) VALUES (?, 'test-guid')",
    ).run(feed.id);

    store.delete(feed.id);

    expect(store.getById(feed.id)).toBeNull();
    // Entry should be cascade-deleted
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM entry').get() as { cnt: number }).cnt;
    expect(count).toBe(0);
  });

  it('updates specific fields', () => {
    const feed = store.upsert({
      title: 'Before',
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });

    const updated = store.update(feed.id, { title: 'After' });
    expect(updated.title).toBe('After');
    expect(updated.feedUrl).toBe('https://example.com/rss'); // unchanged
  });

  it('getAll returns all feeds sorted by title', () => {
    store.upsert({ feedUrl: 'https://b.com/rss', siteUrl: null, description: null, feedParserVersion: null, lastFetchedAt: null, title: 'B Feed' });
    store.upsert({ feedUrl: 'https://a.com/rss', siteUrl: null, description: null, feedParserVersion: null, lastFetchedAt: null, title: 'A Feed' });

    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('A Feed');
    expect(all[1].title).toBe('B Feed');
  });

  it('getById returns null for non-existent id', () => {
    expect(store.getById(999)).toBeNull();
  });

  it('getByUrl finds feed by URL', () => {
    store.upsert({
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });

    const found = store.getByUrl('https://example.com/rss');
    expect(found).not.toBeNull();
    expect(found!.feedUrl).toBe('https://example.com/rss');
  });

  it('getByUrl returns null for unknown URL', () => {
    expect(store.getByUrl('https://nope.com/rss')).toBeNull();
  });

  it('upsertMany creates multiple feeds in a transaction', () => {
    const feeds = store.upsertMany([
      { feedUrl: 'https://a.com/rss', siteUrl: null, description: null, feedParserVersion: null, lastFetchedAt: null },
      { feedUrl: 'https://b.com/rss', siteUrl: null, description: null, feedParserVersion: null, lastFetchedAt: null },
      { feedUrl: 'https://c.com/rss', siteUrl: null, description: null, feedParserVersion: null, lastFetchedAt: null },
    ]);

    expect(feeds).toHaveLength(3);
    expect(store.getAll()).toHaveLength(3);
  });

  it('updateLastFetchedAt updates only that field', () => {
    const feed = store.upsert({
      title: 'Test',
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });

    store.updateLastFetchedAt(feed.id, '2026-05-28T12:00:00.000Z');

    const updated = store.getById(feed.id);
    expect(updated!.lastFetchedAt).toBe('2026-05-28T12:00:00.000Z');
  });
});
