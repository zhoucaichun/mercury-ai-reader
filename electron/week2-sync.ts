import {
  createSyncService,
  MockFeedParser,
  MockStoragePort
} from '../src/features/feed/sync/index.js';
import type {
  Week2Article,
  Week2ArticleContent,
  Week2Feed,
  Week2Subscription,
  Week2SubscriptionProvider,
  Week2SyncAllResult
} from '../src/features/feed/sync/index.js';

const DEFAULT_FEED_URLS = [
  'https://www.ruanyifeng.com/blog/atom.xml',
  'https://css-tricks.com/feed/'
] as const;

export type Week2FrontendSyncPayload = {
  result: Week2SyncAllResult;
  feeds: Week2Feed[];
  articles: Week2Article[];
  contents: Week2ArticleContent[];
  feedUrls: string[];
  syncedAt: string;
};

function toFeedTitle(feedUrl: string) {
  try {
    const url = new URL(feedUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return feedUrl;
  }
}

function normalizeFeedUrls(feedUrls?: string[]) {
  const candidates = feedUrls?.map((url) => url.trim()).filter(Boolean);
  const urls = candidates && candidates.length > 0 ? candidates : [...DEFAULT_FEED_URLS];

  return Array.from(new Set(urls)).filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function createSubscriptionProvider(feedUrls: string[]): Week2SubscriptionProvider {
  return {
    async listActiveSubscriptions(): Promise<Week2Subscription[]> {
      const now = new Date().toISOString();

      return feedUrls.map((feedUrl, index) => ({
        id: `frontend-feed-${index + 1}`,
        title: toFeedTitle(feedUrl),
        feedUrl,
        siteUrl: undefined,
        source: 'manual',
        status: 'active',
        createdAt: now,
        updatedAt: now
      }));
    }
  };
}

export async function runWeek2Sync(feedUrls?: string[]): Promise<Week2FrontendSyncPayload> {
  const normalizedFeedUrls = normalizeFeedUrls(feedUrls);

  if (normalizedFeedUrls.length === 0) {
    throw new Error('Please enter a valid http/https Feed URL.');
  }

  const storage = new MockStoragePort();
  const syncService = createSyncService({
    subscriptionProvider: createSubscriptionProvider(normalizedFeedUrls),
    feedParser: new MockFeedParser(),
    storage
  });

  const result = await syncService.syncAll();
  const feeds = await storage.listFeeds();
  const articles = await storage.listArticles();
  const contents = (
    await Promise.all(articles.map((article) => storage.getArticleContent(article.id)))
  ).filter((content): content is Week2ArticleContent => Boolean(content));

  return {
    result,
    feeds,
    articles,
    contents,
    feedUrls: normalizedFeedUrls,
    syncedAt: new Date().toISOString()
  };
}
