import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import { createEntryStore } from '../entryStore';
import type { IFeedStore } from '../feedStore';
import type { IEntryStore } from '../entryStore';

describe('EntryStore', () => {
  let db: Database.Database;
  let feedStore: IFeedStore;
  let store: IEntryStore;
  let feedId: number;

  beforeEach(() => {
    db = createInMemoryDatabase();
    feedStore = createFeedStore(db);
    store = createEntryStore(db);

    const feed = feedStore.upsert({
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });
    feedId = feed.id;
  });

  it('creates an entry and returns it with id', () => {
    const entry = store.upsert({
      feedId,
      guid: 'article-1',
      url: 'https://example.com/article-1',
      title: 'Test Article',
      author: 'Author',
      publishedAt: '2026-05-28T10:00:00.000Z',
      summary: 'A test article',
    });

    expect(entry.id).toBeGreaterThan(0);
    expect(entry.feedId).toBe(feedId);
    expect(entry.title).toBe('Test Article');
    expect(entry.isRead).toBe(false);
    expect(entry.isStarred).toBe(false);
    expect(entry.isDeleted).toBe(false);
  });

  it('upserts by (feedId, guid) — same guid updates existing', () => {
    const e1 = store.upsert({
      feedId,
      guid: 'unique-guid',
      url: 'https://example.com/a',
      title: 'Original',
      author: null,
      publishedAt: null,
      summary: null,
    });

    const e2 = store.upsert({
      feedId,
      guid: 'unique-guid',
      url: 'https://example.com/a-updated',
      title: 'Updated',
      author: 'Author',
      publishedAt: '2026-05-28T10:00:00.000Z',
      summary: 'New summary',
    });

    expect(e2.id).toBe(e1.id);
    expect(e2.title).toBe('Updated');
    expect(e2.url).toBe('https://example.com/a-updated');
  });

  it('upserts by (feedId, url) when guid is null', () => {
    const e1 = store.upsert({
      feedId,
      guid: null,
      url: 'https://example.com/no-guid',
      title: 'First',
      author: null,
      publishedAt: null,
      summary: null,
    });

    const e2 = store.upsert({
      feedId,
      guid: null,
      url: 'https://example.com/no-guid',
      title: 'Second',
      author: null,
      publishedAt: null,
      summary: null,
    });

    expect(e2.id).toBe(e1.id);
    expect(e2.title).toBe('Second');
  });

  it('throws if neither guid nor url is provided', () => {
    expect(() =>
      store.upsert({
        feedId,
        guid: null as any,
        url: null as any,
        title: null,
        author: null,
        publishedAt: null,
        summary: null,
      }),
    ).toThrow();
  });

  it('upsertMany creates multiple entries', () => {
    const entries = store.upsertMany([
      { feedId, guid: 'a', url: 'https://example.com/a', title: 'A', author: null, publishedAt: null, summary: null },
      { feedId, guid: 'b', url: 'https://example.com/b', title: 'B', author: null, publishedAt: null, summary: null },
    ]);
    expect(entries).toHaveLength(2);
  });

  it('softDelete marks entry as deleted', () => {
    const entry = store.upsert({
      feedId,
      guid: 'soft-del',
      url: 'https://example.com/soft-del',
      title: 'Delete Me',
      author: null,
      publishedAt: null,
      summary: null,
    });

    store.softDelete(entry.id);
    const found = store.getById(entry.id);
    expect(found!.isDeleted).toBe(true);
  });

  it('softDeleteMany marks multiple entries', () => {
    const e1 = store.upsert({ feedId, guid: 'd1', url: 'https://example.com/d1', title: null, author: null, publishedAt: null, summary: null });
    const e2 = store.upsert({ feedId, guid: 'd2', url: 'https://example.com/d2', title: null, author: null, publishedAt: null, summary: null });

    store.softDeleteMany([e1.id, e2.id]);

    expect(store.getById(e1.id)!.isDeleted).toBe(true);
    expect(store.getById(e2.id)!.isDeleted).toBe(true);
  });

  it('markRead toggles read status', () => {
    const entry = store.upsert({
      feedId,
      guid: 'read-test',
      url: 'https://example.com/read',
      title: null,
      author: null,
      publishedAt: null,
      summary: null,
    });

    expect(entry.isRead).toBe(false);

    store.markRead(entry.id, true);
    expect(store.getById(entry.id)!.isRead).toBe(true);

    store.markRead(entry.id, false);
    expect(store.getById(entry.id)!.isRead).toBe(false);
  });

  it('markReadMany sets read for multiple entries', () => {
    const e1 = store.upsert({ feedId, guid: 'r1', url: 'https://example.com/r1', title: null, author: null, publishedAt: null, summary: null });
    const e2 = store.upsert({ feedId, guid: 'r2', url: 'https://example.com/r2', title: null, author: null, publishedAt: null, summary: null });

    store.markReadMany([e1.id, e2.id], true);
    expect(store.getById(e1.id)!.isRead).toBe(true);
    expect(store.getById(e2.id)!.isRead).toBe(true);
  });

  it('markStarred toggles starred status', () => {
    const entry = store.upsert({
      feedId,
      guid: 'star-test',
      url: 'https://example.com/star',
      title: null,
      author: null,
      publishedAt: null,
      summary: null,
    });

    store.markStarred(entry.id, true);
    expect(store.getById(entry.id)!.isStarred).toBe(true);

    store.markStarred(entry.id, false);
    expect(store.getById(entry.id)!.isStarred).toBe(false);
  });

  it('updateUrl changes the url field', () => {
    const entry = store.upsert({
      feedId,
      guid: 'url-test',
      url: 'https://example.com/old',
      title: null,
      author: null,
      publishedAt: null,
      summary: null,
    });

    store.updateUrl(entry.id, 'https://example.com/new');
    expect(store.getById(entry.id)!.url).toBe('https://example.com/new');
  });

  it('getById returns null for non-existent id', () => {
    expect(store.getById(999)).toBeNull();
  });

  it('getByFeedGuid finds entry by feedId + guid', () => {
    store.upsert({
      feedId,
      guid: 'find-me',
      url: 'https://example.com/find',
      title: 'Findable',
      author: null,
      publishedAt: null,
      summary: null,
    });

    const found = store.getByFeedGuid(feedId, 'find-me');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Findable');
  });

  it('getByFeedUrl finds entry by feedId + url', () => {
    store.upsert({
      feedId,
      guid: null,
      url: 'https://example.com/find-url',
      title: 'URL Findable',
      author: null,
      publishedAt: null,
      summary: null,
    });

    const found = store.getByFeedUrl(feedId, 'https://example.com/find-url');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('URL Findable');
  });

  it('getUnreadCount returns correct count', () => {
    store.upsert({ feedId, guid: 'u1', url: 'https://example.com/u1', title: null, author: null, publishedAt: null, summary: null });
    store.upsert({ feedId, guid: 'u2', url: 'https://example.com/u2', title: null, author: null, publishedAt: null, summary: null });
    const e3 = store.upsert({ feedId, guid: 'u3', url: 'https://example.com/u3', title: null, author: null, publishedAt: null, summary: null });

    expect(store.getUnreadCount(feedId)).toBe(3);

    store.markRead(e3.id, true);
    expect(store.getUnreadCount(feedId)).toBe(2);
  });

  it('getUnreadCount excludes soft-deleted entries', () => {
    const e1 = store.upsert({ feedId, guid: 'ud1', url: 'https://example.com/ud1', title: null, author: null, publishedAt: null, summary: null });
    store.upsert({ feedId, guid: 'ud2', url: 'https://example.com/ud2', title: null, author: null, publishedAt: null, summary: null });

    store.softDelete(e1.id);
    expect(store.getUnreadCount(feedId)).toBe(1);
  });

  it('getTotalCount returns correct count excluding deleted', () => {
    store.upsert({ feedId, guid: 't1', url: 'https://example.com/t1', title: null, author: null, publishedAt: null, summary: null });
    const e2 = store.upsert({ feedId, guid: 't2', url: 'https://example.com/t2', title: null, author: null, publishedAt: null, summary: null });

    expect(store.getTotalCount(feedId)).toBe(2);

    store.softDelete(e2.id);
    expect(store.getTotalCount(feedId)).toBe(1);
  });

  it('getUnreadCount without feedId counts across all feeds', () => {
    const feed2 = feedStore.upsert({ feedUrl: 'https://other.com/rss', siteUrl: null, description: null, feedParserVersion: null, lastFetchedAt: null });

    store.upsert({ feedId, guid: 'c1', url: 'https://example.com/c1', title: null, author: null, publishedAt: null, summary: null });
    store.upsert({ feedId: feed2.id, guid: 'c2', url: 'https://other.com/c2', title: null, author: null, publishedAt: null, summary: null });

    expect(store.getUnreadCount()).toBe(2);
  });
});
