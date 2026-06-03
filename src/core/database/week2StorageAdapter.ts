import type Database from 'better-sqlite3';
import type {
  Week2Feed,
  Week2Article,
  Week2ArticleContent,
  Week2StoragePort,
  Week2FeedStatus,
  Week2ParsedArticle,
  ISODateString,
} from './types';
import { createFeedStore } from './stores/feedStore';
import { createEntryStore } from './stores/entryStore';
import { createContentStore } from './stores/contentStore';

/**
 * Week2StoragePort 适配器
 *
 * 职责：
 * - 将内部 Entry/Content/SyncLog 映射为 AGENTS.md 规定的 Week2 类型
 * - 将内部 number ID 转换为 Week2 要求的 string ID
 * - 将同步的 better-sqlite3 调用包装为异步接口（为后续 Electron IPC 预留）
 */
export function createWeek2StoragePort(db: Database.Database): Week2StoragePort {
  const feedStore = createFeedStore(db);
  const entryStore = createEntryStore(db);
  const contentStore = createContentStore(db);

  return {
    async saveFeeds(feeds: Week2Feed[]): Promise<Week2Feed[]> {
      const results: Week2Feed[] = [];

      for (const f of feeds) {
        // If the feed has an existing numeric id, update it; otherwise create
        const existing = f.id && f.id !== 'auto'
          ? feedStore.getByUrl(f.feedUrl)
          : null;

        if (existing) {
          if (f.title) feedStore.update(existing.id, { title: f.title });
          if (f.siteUrl) feedStore.update(existing.id, { siteUrl: f.siteUrl });
          results.push(mapFeedToWeek2(existing));
        } else {
          const created = feedStore.upsert({
            title: f.title ?? null,
            feedUrl: f.feedUrl,
            siteUrl: f.siteUrl ?? null,
            description: null,
            feedParserVersion: null,
            lastFetchedAt: f.lastSyncedAt ?? null,
          });
          results.push(mapFeedToWeek2(created));
        }
      }

      return results;
    },

    async listFeeds(): Promise<Week2Feed[]> {
      const feeds = feedStore.getAll();
      return feeds.map(mapFeedToWeek2);
    },

    async saveArticles(input: {
      feedId: string;
      articles: Week2ParsedArticle[];
    }): Promise<Week2Article[]> {
      const numericFeedId = Number(input.feedId);
      const results: Week2Article[] = [];

      for (const a of input.articles) {
        const entry = entryStore.upsert({
          feedId: numericFeedId,
          guid: a.guid ?? null,
          url: a.url,
          title: a.title,
          author: a.author ?? null,
          publishedAt: a.publishedAt ?? null,
          summary: a.summary ?? null,
        });

        results.push(mapEntryToWeek2Article(entry));

        // Save minimal content if contentHtml/contentText is provided
        if (a.contentHtml || a.contentText) {
          const sourceHtml = a.contentHtml ?? a.contentText ?? '';
          const cleanedHtml = a.contentHtml ?? a.contentText ?? '';
          const canonicalMarkdown = a.contentText ?? stripHtmlTags(a.contentHtml ?? '');

          contentStore.upsert({
            entryId: entry.id,
            html: sourceHtml,
            cleanedHtml: cleanedHtml,
            readabilityTitle: entry.title,
            readabilityByline: entry.author,
            readabilityVersion: 1,
            markdown: canonicalMarkdown,
            markdownVersion: 1,
            displayMode: 'cleaned',
            documentBaseUrl: entry.url,
            pipelineType: 'default',
            resolvedIntermediateContent: null,
          });
        }
      }

      return results;
    },

    async listArticles(query?: {
      feedId?: string;
      searchText?: string;
    }): Promise<Week2Article[]> {
      let sql = `
        SELECT e.*, f.title as feedSourceTitle
        FROM entry e
        LEFT JOIN feed f ON e.feedId = f.id
        WHERE e.isDeleted = 0
      `;
      const params: unknown[] = [];

      if (query?.feedId) {
        sql += ' AND e.feedId = ?';
        params.push(Number(query.feedId));
      }

      if (query?.searchText) {
        sql += ' AND (e.title LIKE ? OR e.summary LIKE ?)';
        const pattern = `%${query.searchText}%`;
        params.push(pattern, pattern);
      }

      sql += ' ORDER BY e.publishedAt DESC, e.createdAt DESC';

      const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

      return rows.map((row) => mapEntryToWeek2Article({
        id: row.id as number,
        feedId: row.feedId as number,
        url: row.url as string | null,
        title: row.title as string | null,
        author: row.author as string | null,
        publishedAt: row.publishedAt as string | null,
        summary: row.summary as string | null,
        isRead: Boolean(row.isRead),
        isStarred: Boolean(row.isStarred),
      }));
    },

    async saveArticleContent(content: Week2ArticleContent): Promise<Week2ArticleContent> {
      const entryId = Number(content.articleId);

      contentStore.upsert({
        entryId,
        html: content.sourceHtml,
        cleanedHtml: content.cleanedHtml,
        readabilityTitle: null,
        readabilityByline: null,
        readabilityVersion: null,
        markdown: content.canonicalMarkdown,
        markdownVersion: 1,
        displayMode: 'cleaned',
        documentBaseUrl: null,
        pipelineType: 'default',
        resolvedIntermediateContent: null,
      });

      return content;
    },

    async getArticleContent(articleId: string): Promise<Week2ArticleContent | null> {
      const entryId = Number(articleId);
      const content = contentStore.getByEntryId(entryId);

      if (!content) return null;

      const now = new Date().toISOString() as ISODateString;
      return {
        articleId: String(content.entryId),
        sourceHtml: content.html ?? '',
        cleanedHtml: content.cleanedHtml ?? '',
        canonicalMarkdown: content.markdown ?? '',
        createdAt: content.createdAt,
        updatedAt: content.createdAt || now,
      };
    },

    async updateFeedSyncStatus(input: {
      feedId: string;
      status: Week2FeedStatus;
      lastSyncedAt?: ISODateString;
      errorMessage?: string;
    }): Promise<void> {
      const feedId = Number(input.feedId);

      if (input.lastSyncedAt) {
        feedStore.updateLastFetchedAt(feedId, input.lastSyncedAt);
      }
    },
  };
}

// ─── Mapping helpers ─────────────────────────────────────────

function mapFeedToWeek2(feed: { id: number; title: string | null; feedUrl: string; siteUrl: string | null; lastFetchedAt: string | null }): Week2Feed {
  return {
    id: String(feed.id),
    title: feed.title ?? '',
    feedUrl: feed.feedUrl,
    siteUrl: feed.siteUrl ?? undefined,
    unreadCount: 0, // TODO: compute from entryStore when needed
    status: 'ready' as Week2FeedStatus,
    lastSyncedAt: feed.lastFetchedAt ?? undefined,
  };
}

function mapEntryToWeek2Article(entry: {
  id: number;
  feedId: number;
  title: string | null;
  url: string | null;
  author: string | null;
  summary: string | null;
  publishedAt: string | null;
  isRead: boolean;
  isStarred: boolean;
}): Week2Article {
  return {
    id: String(entry.id),
    feedId: String(entry.feedId),
    title: entry.title ?? '',
    url: entry.url ?? '',
    author: entry.author ?? undefined,
    excerpt: entry.summary ?? '',
    publishedAt: entry.publishedAt ?? undefined,
    readState: entry.isRead ? 'saved' as const : 'unread' as const,
    estimatedMinutes: Math.max(1, Math.round((entry.summary?.length ?? 0) / 200)),
    tags: [],
  };
}

/** Simple HTML tag stripper for fallback markdown generation */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
