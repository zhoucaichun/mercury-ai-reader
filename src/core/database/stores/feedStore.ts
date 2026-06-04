import type Database from 'better-sqlite3';
import type { Feed } from '../types';

export type FeedInsert = Omit<Feed, 'id' | 'createdAt' | 'title'> & { title?: string | null };

export interface IFeedStore {
  upsert(feed: FeedInsert): Feed;
  delete(feedId: number): void;
  update(feedId: number, partial: Partial<Omit<Feed, 'id' | 'createdAt'>>): Feed;
  getAll(): Feed[];
  getById(feedId: number): Feed | null;
  getByUrl(feedUrl: string): Feed | null;
  upsertMany(feeds: FeedInsert[]): Feed[];
  updateLastFetchedAt(feedId: number, lastFetchedAt: string): void;
  setEnabled(feedId: number, isEnabled: boolean): void;
}

export function createFeedStore(db: Database.Database): IFeedStore {
  const upsertStmt = db.prepare(`
    INSERT INTO feed (title, feedUrl, siteUrl, description, feedParserVersion, lastFetchedAt, isEnabled)
    VALUES (@title, @feedUrl, @siteUrl, @description, @feedParserVersion, @lastFetchedAt, @isEnabled)
    ON CONFLICT(feedUrl) DO UPDATE SET
      title = excluded.title,
      siteUrl = excluded.siteUrl,
      description = excluded.description,
      feedParserVersion = excluded.feedParserVersion,
      lastFetchedAt = excluded.lastFetchedAt
  `);

  const getByIdStmt = db.prepare('SELECT * FROM feed WHERE id = ?');
  const getByUrlStmt = db.prepare('SELECT * FROM feed WHERE feedUrl = ?');
  const getAllStmt = db.prepare('SELECT * FROM feed ORDER BY title COLLATE NOCASE ASC');
  const deleteStmt = db.prepare('DELETE FROM feed WHERE id = ?');
  const updateLastFetchedStmt = db.prepare(
    `UPDATE feed SET lastFetchedAt = ? WHERE id = ?`,
  );
  const setEnabledStmt = db.prepare('UPDATE feed SET isEnabled = ? WHERE id = ?');

  function update(feedId: number, partial: Partial<Omit<Feed, 'id' | 'createdAt'>>): Feed {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(partial)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }

    if (sets.length === 0) {
      const row = getByIdStmt.get(feedId) as Feed | undefined;
      if (!row) throw new Error(`Feed not found: ${feedId}`);
      return row;
    }

    values.push(feedId);
    db.prepare(`UPDATE feed SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const row = getByIdStmt.get(feedId) as Feed | undefined;
    if (!row) throw new Error(`Feed not found: ${feedId}`);
    return row;
  }

  return {
    upsert(feed: FeedInsert): Feed {
      upsertStmt.run({
        title: feed.title ?? null,
        feedUrl: feed.feedUrl,
        siteUrl: feed.siteUrl ?? null,
        description: feed.description ?? null,
        feedParserVersion: feed.feedParserVersion ?? null,
        lastFetchedAt: feed.lastFetchedAt ?? null,
        isEnabled: feed.isEnabled === false ? 0 : 1,
      });

      return getByUrlStmt.get(feed.feedUrl) as Feed;
    },

    delete(feedId: number): void {
      deleteStmt.run(feedId);
    },

    update,

    getAll(): Feed[] {
      return getAllStmt.all() as Feed[];
    },

    getById(feedId: number): Feed | null {
      return (getByIdStmt.get(feedId) as Feed | undefined) ?? null;
    },

    getByUrl(feedUrl: string): Feed | null {
      return (getByUrlStmt.get(feedUrl) as Feed | undefined) ?? null;
    },

    upsertMany(feeds: FeedInsert[]): Feed[] {
      return db.transaction(() => {
        const results: Feed[] = [];
        for (const feed of feeds) {
          upsertStmt.run({
            title: feed.title ?? null,
            feedUrl: feed.feedUrl,
            siteUrl: feed.siteUrl ?? null,
          description: feed.description ?? null,
          feedParserVersion: feed.feedParserVersion ?? null,
          lastFetchedAt: feed.lastFetchedAt ?? null,
          isEnabled: feed.isEnabled === false ? 0 : 1,
          });
          results.push(getByUrlStmt.get(feed.feedUrl) as Feed);
        }
        return results;
      })();
    },

    updateLastFetchedAt(feedId: number, lastFetchedAt: string): void {
      updateLastFetchedStmt.run(lastFetchedAt, feedId);
    },

    setEnabled(feedId: number, isEnabled: boolean): void {
      setEnabledStmt.run(isEnabled ? 1 : 0, feedId);
    },
  };
}
