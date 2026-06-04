import { app } from 'electron';
import type Database from 'better-sqlite3';
import {
  createSyncService
} from '../src/features/feed/sync/index.js';
import type {
  Week2Article,
  Week2ArticleContent,
  Week2Feed,
  Week2StoragePort,
  Week2Subscription,
  Week2SubscriptionProvider,
  Week2SyncAllResult
} from '../src/features/feed/sync/index.js';
import { parseOpmlText } from '../src/features/feed/opml/index.js';
import { week2FeedParser } from '../src/features/feed/parser/index.js';
import { createReaderPipeline } from '../src/features/reader/pipeline/index.js';
import { createWeek2StoragePort, initDatabase } from '../src/core/database/index.js';

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
  storage: {
    mode: 'sqlite';
    databasePath: string;
  };
  opml?: {
    importedCount: number;
    skippedCount: number;
    messages: string[];
  };
};

export type Week2OpmlPreviewPayload = {
  subscriptions: Week2Subscription[];
  skippedCount: number;
  messages: string[];
};

let database: Database.Database | null = null;
let storagePort: Week2StoragePort | null = null;

function getStorage() {
  if (!database || !storagePort) {
    const userDataPath = app.getPath('userData');
    database = initDatabase(userDataPath);
    storagePort = createWeek2StoragePort(database);
  }

  return storagePort;
}

function getDatabasePath() {
  return database?.name ?? `${app.getPath('userData')}\\mercury.sqlite`;
}

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

function createSubscriptionProvider(feedUrls: string[], source: Week2Subscription['source']): Week2SubscriptionProvider {
  return {
    async listActiveSubscriptions(): Promise<Week2Subscription[]> {
      const now = new Date().toISOString();

      return feedUrls.map((feedUrl, index) => ({
        id: `${source}-feed-${index + 1}`,
        title: toFeedTitle(feedUrl),
        feedUrl,
        siteUrl: undefined,
        source,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }));
    }
  };
}

function createStaticSubscriptionProvider(subscriptions: Week2Subscription[]): Week2SubscriptionProvider {
  return {
    async listActiveSubscriptions() {
      return subscriptions.filter((subscription) => subscription.status === 'active');
    }
  };
}

async function listActiveStoredSubscriptions(): Promise<Week2Subscription[]> {
  const feeds = await getStorage().listFeeds();
  const now = new Date().toISOString();

  return feeds
    .filter((feed) => feed.isEnabled !== false)
    .map((feed) => ({
      id: feed.id,
      title: feed.title,
      feedUrl: feed.feedUrl,
      siteUrl: feed.siteUrl,
      source: 'manual',
      status: 'active',
      createdAt: feed.lastSyncedAt ?? now,
      updatedAt: feed.lastSyncedAt ?? now
    }));
}

async function buildPayload(input: {
  result: Week2SyncAllResult;
  feedUrls: string[];
  opml?: Week2FrontendSyncPayload['opml'];
}): Promise<Week2FrontendSyncPayload> {
  const storage = getStorage();
  const pipeline = createReaderPipeline();
  const feeds = await storage.listFeeds();
  const articles = await storage.listArticles();

  const contents = (
    await Promise.all(
      articles.map(async (article) => {
        const content = await storage.getArticleContent(article.id);
        if (!content) return null;

        const piped = await pipeline.runPipeline({
          articleId: article.id,
          sourceHtml: content.sourceHtml,
          url: article.url
        });
        await storage.saveArticleContent(piped);
        return piped;
      })
    )
  ).filter((content): content is Week2ArticleContent => Boolean(content));

  return {
    result: input.result,
    feeds,
    articles,
    contents,
    feedUrls: input.feedUrls,
    syncedAt: new Date().toISOString(),
    storage: {
      mode: 'sqlite',
      databasePath: getDatabasePath()
    },
    opml: input.opml
  };
}

export async function runWeek2Sync(feedUrls?: string[]): Promise<Week2FrontendSyncPayload> {
  const normalizedFeedUrls = normalizeFeedUrls(feedUrls);

  if (normalizedFeedUrls.length === 0) {
    throw new Error('Please enter a valid http/https Feed URL.');
  }

  if (feedUrls?.length) {
    const now = new Date().toISOString();
    await getStorage().saveFeeds(
      normalizedFeedUrls.map((feedUrl) => ({
        id: 'auto',
        title: toFeedTitle(feedUrl),
        feedUrl,
        siteUrl: undefined,
        unreadCount: 0,
        status: 'ready',
        lastSyncedAt: now,
        isEnabled: true
      }))
    );
  }

  const storedSubscriptions = await listActiveStoredSubscriptions();
  const subscriptions =
    feedUrls?.length || storedSubscriptions.length > 0
      ? storedSubscriptions
      : await createSubscriptionProvider(normalizedFeedUrls, 'mock').listActiveSubscriptions();

  const syncService = createSyncService({
    subscriptionProvider: createStaticSubscriptionProvider(subscriptions),
    feedParser: week2FeedParser,
    storage: getStorage()
  });

  const result = await syncService.syncAll();
  return buildPayload({ result, feedUrls: subscriptions.map((subscription) => subscription.feedUrl) });
}

export async function importOpmlAndSync(opmlText: string): Promise<Week2FrontendSyncPayload> {
  const parsed = parseOpmlText(opmlText);
  const feedUrls = parsed.subscriptions.map((subscription) => subscription.feedUrl);

  if (feedUrls.length === 0) {
    throw new Error('The OPML file did not contain any valid http/https Feed URL.');
  }

  await getStorage().saveFeeds(
    parsed.subscriptions.map((subscription) => ({
      id: 'auto',
      title: subscription.title,
      feedUrl: subscription.feedUrl,
      siteUrl: subscription.siteUrl,
      unreadCount: 0,
      status: 'ready',
      lastSyncedAt: undefined,
      isEnabled: true
    }))
  );

  const subscriptions = await listActiveStoredSubscriptions();

  const syncService = createSyncService({
    subscriptionProvider: createStaticSubscriptionProvider(subscriptions),
    feedParser: week2FeedParser,
    storage: getStorage()
  });

  const result = await syncService.syncAll();
  return buildPayload({
    result,
    feedUrls: subscriptions.map((subscription) => subscription.feedUrl),
    opml: {
      importedCount: parsed.subscriptions.length,
      skippedCount: parsed.issues.length,
      messages: parsed.issues.map((issue) => issue.message)
    }
  });
}

export async function previewOpmlImport(opmlText: string): Promise<Week2OpmlPreviewPayload> {
  const parsed = parseOpmlText(opmlText);
  return {
    subscriptions: parsed.subscriptions,
    skippedCount: parsed.issues.length,
    messages: parsed.issues.map((issue) => issue.message)
  };
}

export async function updateArticleState(input: {
  articleId: string;
  isRead?: boolean;
  isStarred?: boolean;
}): Promise<Week2FrontendSyncPayload> {
  const storage = getStorage();
  await storage.updateArticleState?.(input);
  return buildPayload({
    result: emptyResult(),
    feedUrls: (await listActiveStoredSubscriptions()).map((subscription) => subscription.feedUrl)
  });
}

export async function updateFeedSubscription(input: {
  feedId: string;
  isEnabled?: boolean;
  isDeleted?: boolean;
}): Promise<Week2FrontendSyncPayload> {
  const storage = getStorage();
  await storage.updateFeedSubscription?.(input);
  return buildPayload({
    result: emptyResult(),
    feedUrls: (await listActiveStoredSubscriptions()).map((subscription) => subscription.feedUrl)
  });
}

function emptyResult(): Week2SyncAllResult {
  return {
    status: 'succeeded',
    totalSubscriptions: 0,
    succeededCount: 0,
    failedCount: 0,
    totalSavedArticles: 0,
    results: []
  };
}
