import fs from 'node:fs';
import path from 'node:path';
import type {
  ISODateString,
  Week2Article,
  Week2ArticleContent,
  Week2Feed,
  Week2FeedStatus,
  Week2ParsedArticle,
  Week2StoragePort
} from '../src/features/feed/sync/index.js';

type JsonState = {
  feeds: Week2Feed[];
  articles: Week2Article[];
  contents: Week2ArticleContent[];
  nextFeedId: number;
  nextArticleId: number;
};

function initialState(): JsonState {
  return {
    feeds: [],
    articles: [],
    contents: [],
    nextFeedId: 1,
    nextArticleId: 1
  };
}

export function createJsonWeek2StoragePort(userDataPath: string): Week2StoragePort & { databasePath: string } {
  const databasePath = path.join(userDataPath, 'mercury-week2-fallback.json');

  function readState(): JsonState {
    try {
      if (!fs.existsSync(databasePath)) return initialState();
      return { ...initialState(), ...JSON.parse(fs.readFileSync(databasePath, 'utf8')) };
    } catch {
      return initialState();
    }
  }

  function writeState(state: JsonState) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.writeFileSync(databasePath, JSON.stringify(state, null, 2), 'utf8');
  }

  const port: Week2StoragePort & { databasePath: string } = {
    databasePath,

    async saveFeeds(feeds) {
      const state = readState();
      const now = new Date().toISOString();
      const saved = feeds.map((feed) => {
        const existing = state.feeds.find((item) => item.feedUrl === feed.feedUrl);
        if (existing) {
          Object.assign(existing, {
            title: feed.title || existing.title,
            siteUrl: feed.siteUrl ?? existing.siteUrl,
            status: feed.status ?? existing.status,
            lastSyncedAt: feed.lastSyncedAt ?? existing.lastSyncedAt,
            isEnabled: feed.isEnabled ?? existing.isEnabled
          });
          return existing;
        }

        const created: Week2Feed = {
          id: String(state.nextFeedId++),
          title: feed.title,
          feedUrl: feed.feedUrl,
          siteUrl: feed.siteUrl,
          unreadCount: feed.unreadCount ?? 0,
          status: feed.status ?? 'ready',
          lastSyncedAt: feed.lastSyncedAt ?? now,
          isEnabled: feed.isEnabled ?? true
        };
        state.feeds.push(created);
        return created;
      });
      writeState(state);
      return saved;
    },

    async listFeeds() {
      const state = readState();
      return state.feeds
        .filter((feed) => feed.isEnabled !== false)
        .map((feed) => ({
          ...feed,
          unreadCount: state.articles.filter((article) => article.feedId === feed.id && article.readState === 'unread').length
        }));
    },

    async saveArticles(input: { feedId: string; articles: Week2ParsedArticle[] }) {
      const state = readState();
      const saved: Week2Article[] = [];

      for (const article of input.articles) {
        const existing = state.articles.find((item) => item.url === article.url || (article.guid && item.id === article.guid));
        if (existing) {
          saved.push(existing);
          continue;
        }

        const id = String(state.nextArticleId++);
        const created: Week2Article = {
          id,
          feedId: input.feedId,
          title: article.title,
          url: article.url,
          author: article.author,
          excerpt: article.summary ?? article.contentText ?? '',
          publishedAt: article.publishedAt,
          readState: 'unread',
          isRead: false,
          isStarred: false,
          estimatedMinutes: Math.max(1, Math.round((article.contentText?.length ?? article.summary?.length ?? 200) / 500)),
          tags: article.tags ?? []
        };
        state.articles.push(created);

        if (article.contentHtml || article.contentText) {
          const sourceHtml = article.contentHtml ?? article.contentText ?? '';
          const canonicalMarkdown = article.contentText ?? stripHtmlTags(article.contentHtml ?? '');
          const now = new Date().toISOString();
          state.contents.push({
            articleId: id,
            sourceHtml,
            cleanedHtml: sourceHtml,
            canonicalMarkdown,
            createdAt: now,
            updatedAt: now
          });
        }

        saved.push(created);
      }

      writeState(state);
      return saved;
    },

    async listArticles(query?: { feedId?: string; searchText?: string }) {
      const state = readState();
      return state.articles
        .filter((article) => !query?.feedId || article.feedId === query.feedId)
        .filter((article) => {
          if (!query?.searchText) return true;
          const text = query.searchText.toLowerCase();
          return article.title.toLowerCase().includes(text) || article.excerpt.toLowerCase().includes(text);
        })
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    },

    async saveArticleContent(content) {
      const state = readState();
      const existingIndex = state.contents.findIndex((item) => item.articleId === content.articleId);
      if (existingIndex >= 0) {
        state.contents[existingIndex] = content;
      } else {
        state.contents.push(content);
      }
      writeState(state);
      return content;
    },

    async getArticleContent(articleId: string) {
      const state = readState();
      return state.contents.find((content) => content.articleId === articleId) ?? null;
    },

    async updateArticleState(input) {
      const state = readState();
      const article = state.articles.find((item) => item.id === input.articleId);
      if (!article) throw new Error(`Article not found: ${input.articleId}`);
      if (input.isStarred !== undefined) article.isStarred = input.isStarred;
      if (input.isRead !== undefined) {
        article.isRead = input.isRead;
        article.readState = input.isRead ? 'reading' : 'unread';
      }
      writeState(state);
      return article;
    },

    async updateFeedSubscription(input) {
      const state = readState();
      if (input.isDeleted) {
        state.feeds = state.feeds.filter((feed) => feed.id !== input.feedId);
        state.articles = state.articles.filter((article) => article.feedId !== input.feedId);
        writeState(state);
        return;
      }

      const feed = state.feeds.find((item) => item.id === input.feedId);
      if (feed && input.isEnabled !== undefined) {
        feed.isEnabled = input.isEnabled;
        feed.status = input.isEnabled ? 'ready' : 'error';
      }
      writeState(state);
    },

    async updateFeedSyncStatus(input: {
      feedId: string;
      status: Week2FeedStatus;
      lastSyncedAt?: ISODateString;
      errorMessage?: string;
    }) {
      const state = readState();
      const feed = state.feeds.find((item) => item.id === input.feedId);
      if (feed) {
        feed.status = input.status;
        feed.lastSyncedAt = input.lastSyncedAt ?? feed.lastSyncedAt;
      }
      writeState(state);
    }
  };

  return port;
}

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
