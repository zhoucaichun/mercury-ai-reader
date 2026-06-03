import type Database from 'better-sqlite3';
import type { Entry } from '../types';

export type EntryInsert = Omit<Entry, 'id' | 'createdAt' | 'isRead' | 'isStarred' | 'isDeleted'>;

export interface IEntryStore {
  upsert(entry: EntryInsert): Entry;
  upsertMany(entries: EntryInsert[]): Entry[];
  softDelete(entryId: number): void;
  softDeleteMany(entryIds: number[]): void;
  markRead(entryId: number, isRead: boolean): void;
  markReadMany(entryIds: number[], isRead: boolean): void;
  markStarred(entryId: number, isStarred: boolean): void;
  updateUrl(entryId: number, url: string): void;
  getById(entryId: number): Entry | null;
  getByFeedGuid(feedId: number, guid: string): Entry | null;
  getByFeedUrl(feedId: number, url: string): Entry | null;
  getUnreadCount(feedId?: number): number;
  getTotalCount(feedId?: number): number;
}

function mapEntry(row: Record<string, unknown>): Entry {
  return {
    ...row,
    isRead: Boolean(row.isRead),
    isStarred: Boolean(row.isStarred),
    isDeleted: Boolean(row.isDeleted),
  } as Entry;
}

export function createEntryStore(db: Database.Database): IEntryStore {
  const getByIdStmt = db.prepare('SELECT * FROM entry WHERE id = ?');
  const getByFeedGuidStmt = db.prepare('SELECT * FROM entry WHERE feedId = ? AND guid = ?');
  const getByFeedUrlStmt = db.prepare('SELECT * FROM entry WHERE feedId = ? AND url = ?');
  const softDeleteStmt = db.prepare('UPDATE entry SET isDeleted = 1 WHERE id = ?');
  const markReadStmt = db.prepare('UPDATE entry SET isRead = ? WHERE id = ?');
  const markStarredStmt = db.prepare('UPDATE entry SET isStarred = ? WHERE id = ?');
  const updateUrlStmt = db.prepare('UPDATE entry SET url = ? WHERE id = ?');

  const upsertByGuid = db.prepare(`
    INSERT INTO entry (feedId, guid, url, title, author, publishedAt, summary)
    VALUES (@feedId, @guid, @url, @title, @author, @publishedAt, @summary)
    ON CONFLICT(feedId, guid) DO UPDATE SET
      url = excluded.url,
      title = excluded.title,
      author = excluded.author,
      publishedAt = excluded.publishedAt,
      summary = excluded.summary
  `);

  const upsertByUrl = db.prepare(`
    INSERT INTO entry (feedId, guid, url, title, author, publishedAt, summary)
    VALUES (@feedId, @guid, @url, @title, @author, @publishedAt, @summary)
    ON CONFLICT(feedId, url) DO UPDATE SET
      guid = COALESCE(excluded.guid, entry.guid),
      title = excluded.title,
      author = excluded.author,
      publishedAt = excluded.publishedAt,
      summary = excluded.summary
  `);

  function doUpsert(entry: EntryInsert): Entry {
    if (entry.guid) {
      const info = upsertByGuid.run({
        feedId: entry.feedId,
        guid: entry.guid,
        url: entry.url ?? null,
        title: entry.title ?? null,
        author: entry.author ?? null,
        publishedAt: entry.publishedAt ?? null,
        summary: entry.summary ?? null,
      });

      if (info.changes > 0) {
        if (info.lastInsertRowid > 0) {
          return mapEntry(getByIdStmt.get(info.lastInsertRowid) as Record<string, unknown>);
        }
        return mapEntry(getByFeedGuidStmt.get(entry.feedId, entry.guid) as Record<string, unknown>);
      }
    }

    if (entry.url) {
      const info = upsertByUrl.run({
        feedId: entry.feedId,
        guid: entry.guid ?? null,
        url: entry.url,
        title: entry.title ?? null,
        author: entry.author ?? null,
        publishedAt: entry.publishedAt ?? null,
        summary: entry.summary ?? null,
      });

      if (info.lastInsertRowid > 0) {
        return mapEntry(getByIdStmt.get(info.lastInsertRowid) as Record<string, unknown>);
      }
      return mapEntry(getByFeedUrlStmt.get(entry.feedId, entry.url) as Record<string, unknown>);
    }

    throw new Error('Entry must have either guid or url for upsert');
  }

  return {
    upsert(entry: EntryInsert): Entry {
      return db.transaction(() => doUpsert(entry))();
    },

    upsertMany(entries: EntryInsert[]): Entry[] {
      return db.transaction(() => entries.map((e) => doUpsert(e)))();
    },

    softDelete(entryId: number): void {
      softDeleteStmt.run(entryId);
    },

    softDeleteMany(entryIds: number[]): void {
      if (entryIds.length === 0) return;
      db.transaction(() => {
        for (const id of entryIds) {
          softDeleteStmt.run(id);
        }
      })();
    },

    markRead(entryId: number, isRead: boolean): void {
      markReadStmt.run(isRead ? 1 : 0, entryId);
    },

    markReadMany(entryIds: number[], isRead: boolean): void {
      if (entryIds.length === 0) return;
      const val = isRead ? 1 : 0;
      db.transaction(() => {
        for (const id of entryIds) {
          markReadStmt.run(val, id);
        }
      })();
    },

    markStarred(entryId: number, isStarred: boolean): void {
      markStarredStmt.run(isStarred ? 1 : 0, entryId);
    },

    updateUrl(entryId: number, url: string): void {
      updateUrlStmt.run(url, entryId);
    },

    getById(entryId: number): Entry | null {
      const row = getByIdStmt.get(entryId) as Record<string, unknown> | undefined;
      return row ? mapEntry(row) : null;
    },

    getByFeedGuid(feedId: number, guid: string): Entry | null {
      const row = getByFeedGuidStmt.get(feedId, guid) as Record<string, unknown> | undefined;
      return row ? mapEntry(row) : null;
    },

    getByFeedUrl(feedId: number, url: string): Entry | null {
      const row = getByFeedUrlStmt.get(feedId, url) as Record<string, unknown> | undefined;
      return row ? mapEntry(row) : null;
    },

    getUnreadCount(feedId?: number): number {
      if (feedId !== undefined) {
        const row = db
          .prepare('SELECT COUNT(*) as cnt FROM entry WHERE feedId = ? AND isRead = 0 AND isDeleted = 0')
          .get(feedId) as { cnt: number };
        return row.cnt;
      }
      const row = db
        .prepare('SELECT COUNT(*) as cnt FROM entry WHERE isRead = 0 AND isDeleted = 0')
        .get() as { cnt: number };
      return row.cnt;
    },

    getTotalCount(feedId?: number): number {
      if (feedId !== undefined) {
        const row = db
          .prepare('SELECT COUNT(*) as cnt FROM entry WHERE feedId = ? AND isDeleted = 0')
          .get(feedId) as { cnt: number };
        return row.cnt;
      }
      const row = db
        .prepare('SELECT COUNT(*) as cnt FROM entry WHERE isDeleted = 0')
        .get() as { cnt: number };
      return row.cnt;
    },
  };
}
