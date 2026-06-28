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
import { createJsonWeek2StoragePort } from './json-week2-storage.js';
import fs from 'node:fs/promises';

const DEFAULT_FEED_URLS = [
  'https://www.ruanyifeng.com/blog/atom.xml',
  'https://blog.mozilla.org/en/feed/'
] as const;

export type Week2FrontendSyncPayload = {
  result: Week2SyncAllResult;
  feeds: Week2Feed[];
  articles: Week2Article[];
  contents: Week2ArticleContent[];
  feedUrls: string[];
  syncedAt: string;
  storage: {
    mode: 'sqlite' | 'json-fallback';
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

export type Week2OpmlImportProgress = {
  jobId?: string;
  phase: 'importing' | 'feed-imported' | 'imported' | 'syncing' | 'feed-succeeded' | 'feed-failed' | 'completed';
  total: number;
  completed: number;
  importedCount: number;
  skippedCount: number;
  currentTitle?: string;
  feed?: Week2Feed;
  message?: string;
  result?: Week2SyncAllResult['results'][number];
  payload?: Week2FrontendSyncPayload;
};

export type Week2OpmlImportOptions = {
  jobId?: string;
  onProgress?: (progress: Week2OpmlImportProgress) => void;
};

let database: Database.Database | null = null;
let storagePort: Week2StoragePort | null = null;
let storageMode: Week2FrontendSyncPayload['storage']['mode'] = 'sqlite';
let storagePath: string | null = null;

function getStorage() {
  if (!database || !storagePort) {
    const userDataPath = app.getPath('userData');
    try {
      database = initDatabase(userDataPath);
      storagePort = createWeek2StoragePort(database);
      storageMode = 'sqlite';
      storagePath = database.name;
    } catch (error) {
      console.warn('[Prism Reader] SQLite native module unavailable, using JSON fallback storage.', error);
      const fallbackStorage = createJsonWeek2StoragePort(userDataPath);
      database = null;
      storagePort = fallbackStorage;
      storageMode = 'json-fallback';
      storagePath = fallbackStorage.databasePath;
    }
  }

  return storagePort;
}

function getDatabasePath() {
  return storagePath ?? database?.name ?? `${app.getPath('userData')}\\mercury.sqlite`;
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
  refreshPipeline?: boolean;
  includeContents?: boolean;
}): Promise<Week2FrontendSyncPayload> {
  const storage = getStorage();
  const pipeline = createReaderPipeline();
  const feeds = await storage.listFeeds();
  const articles = await storage.listArticles();
  const refreshPipeline = input.refreshPipeline ?? true;
  const includeContents = input.includeContents ?? false;

  const contents = includeContents
    ? (
        await Promise.all(
          articles.map(async (article) => {
            const content = await storage.getArticleContent(article.id);
            if (!content) return null;
            if (!refreshPipeline) return content;

            const piped = await pipeline.runPipeline({
              articleId: article.id,
              sourceHtml: content.sourceHtml,
              url: article.url
            });
            await storage.saveArticleContent(piped);
            return piped;
          })
        )
      ).filter((content): content is Week2ArticleContent => Boolean(content))
    : [];

  return {
    result: input.result,
    feeds,
    articles,
    contents,
    feedUrls: input.feedUrls,
    syncedAt: new Date().toISOString(),
    storage: {
      mode: storageMode,
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
      : await createSubscriptionProvider(normalizedFeedUrls, 'manual').listActiveSubscriptions();

  const syncService = createSyncService({
    subscriptionProvider: createStaticSubscriptionProvider(subscriptions),
    feedParser: week2FeedParser,
    storage: getStorage()
  });

  const result = await syncService.syncAll();
  return buildPayload({ result, feedUrls: subscriptions.map((subscription) => subscription.feedUrl) });
}

export async function getStoredArticleContent(articleId: string): Promise<Week2ArticleContent | null> {
  const storage = getStorage();
  const content = await storage.getArticleContent(articleId);
  if (!content) return null;

  const articles = await storage.listArticles();
  const article = articles.find((item) => item.id === articleId);
  const piped = await createReaderPipeline().runPipeline({
    articleId,
    sourceHtml: content.sourceHtml,
    url: article?.url
  });
  await storage.saveArticleContent(piped);
  return piped;
}

export async function importOpmlAndSync(
  opmlText: string,
  options: Week2OpmlImportOptions = {}
): Promise<Week2FrontendSyncPayload> {
  const parsed = parseOpmlText(opmlText);
  const parsedFeedUrls = parsed.subscriptions.map((subscription) => subscription.feedUrl);

  if (parsedFeedUrls.length === 0) {
    throw new Error('The OPML file did not contain any valid http/https Feed URL.');
  }

  const storage = getStorage();
  const existingFeeds = await storage.listFeeds();
  const existingFeedUrls = new Set(existingFeeds.map((feed) => (feed.feedUrl ?? '').toLowerCase()));

  const importableSubscriptions: Week2Subscription[] = [];
  const skippedMessages: string[] = parsed.issues.map((issue) => issue.message);

  for (const subscription of parsed.subscriptions) {
    const dedupeKey = (subscription.feedUrl ?? '').toLowerCase();

    if (existingFeedUrls.has(dedupeKey)) {
      skippedMessages.push(`Skipped duplicate subscription "${subscription.title}".`);
      continue;
    }

    existingFeedUrls.add(dedupeKey);
    importableSubscriptions.push(subscription);
  }

  for (const [index, subscription] of importableSubscriptions.entries()) {
    const [savedFeed] = await storage.saveFeeds([
      {
        id: 'auto',
        title: subscription.title,
        feedUrl: subscription.feedUrl,
        siteUrl: subscription.siteUrl,
        unreadCount: 0,
        status: 'ready',
        lastSyncedAt: undefined,
        isEnabled: true
      }
    ]);

    options.onProgress?.({
      jobId: options.jobId,
      phase: 'feed-imported',
      total: importableSubscriptions.length,
      completed: index + 1,
      importedCount: index + 1,
      skippedCount: skippedMessages.length,
      currentTitle: subscription.title,
      feed: savedFeed,
      message: `Imported OPML feed ${index + 1}/${importableSubscriptions.length}: ${subscription.title}`
    });
  }

  const subscriptions = await listActiveStoredSubscriptions();
  const opml = {
    importedCount: importableSubscriptions.length,
    skippedCount: skippedMessages.length,
    messages: skippedMessages
  };
  const initialPayload = await buildPayload({
    result: emptyResult(),
    feedUrls: subscriptions.map((subscription) => subscription.feedUrl),
    opml,
    refreshPipeline: false,
    includeContents: false
  });

  options.onProgress?.({
    jobId: options.jobId,
    phase: 'imported',
    total: importableSubscriptions.length,
    completed: 0,
    importedCount: importableSubscriptions.length,
    skippedCount: skippedMessages.length,
    message: `Imported ${importableSubscriptions.length} OPML feed(s).`,
    payload: initialPayload
  });

  if (importableSubscriptions.length > 0) {
    void syncImportedSubscriptionsInBackground(importableSubscriptions, opml, options).catch((error: any) => {
      options.onProgress?.({
        jobId: options.jobId,
        phase: 'completed',
        total: importableSubscriptions.length,
        completed: 0,
        importedCount: importableSubscriptions.length,
        skippedCount: skippedMessages.length,
        message: `OPML background sync failed: ${error.message}`,
        payload: initialPayload
      });
    });
  } else {
    options.onProgress?.({
      jobId: options.jobId,
      phase: 'completed',
      total: 0,
      completed: 0,
      importedCount: 0,
      skippedCount: skippedMessages.length,
      message: 'No new OPML feeds to sync.',
      payload: initialPayload
    });
  }

  return initialPayload;
}

export async function importOpmlFileAndSync(
  filePath: string,
  options: Week2OpmlImportOptions = {}
): Promise<Week2FrontendSyncPayload> {
  const opmlText = await fs.readFile(filePath, 'utf8');
  return importOpmlAndSync(opmlText, options);
}

async function syncImportedSubscriptionsInBackground(
  subscriptions: Week2Subscription[],
  opml: NonNullable<Week2FrontendSyncPayload['opml']>,
  options: Week2OpmlImportOptions
) {
  const syncService = createSyncService({
    subscriptionProvider: createStaticSubscriptionProvider(subscriptions),
    feedParser: week2FeedParser,
    storage: getStorage()
  });
  const total = subscriptions.length;
  let completed = 0;
  const results: Week2SyncAllResult['results'] = [];
  let lastPayloadAt = 0;

  options.onProgress?.({
    jobId: options.jobId,
    phase: 'syncing',
    total,
    completed,
    importedCount: opml.importedCount,
    skippedCount: opml.skippedCount,
    message: `Syncing imported feeds 0/${total}.`
  });

  await mapWithConcurrency(subscriptions, 4, async (subscription) => {
    const result = await syncService.syncFeed(subscription.id);
    completed += 1;
    results.push(result);

    const shouldSendPayload = completed === total || completed % 5 === 0 || Date.now() - lastPayloadAt > 2_000;
    const payload = shouldSendPayload ? await buildProgressPayload(results, total, opml) : undefined;
    if (payload) lastPayloadAt = Date.now();

    options.onProgress?.({
      jobId: options.jobId,
      phase: result.status === 'succeeded' ? 'feed-succeeded' : 'feed-failed',
      total,
      completed,
      importedCount: opml.importedCount,
      skippedCount: opml.skippedCount,
      currentTitle: subscription.title,
      message: `Synced imported feeds ${completed}/${total}: ${subscription.title}`,
      result,
      payload
    });
    return result;
  });

  const succeededCount = results.filter((result) => result.status === 'succeeded').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;
  const finalResult: Week2SyncAllResult = {
    status: failedCount === 0 ? 'succeeded' : succeededCount === 0 ? 'failed' : 'partial',
    totalSubscriptions: total,
    succeededCount,
    failedCount,
    totalSavedArticles: results.reduce((sum, result) => sum + result.savedCount, 0),
    results
  };
  const activeSubscriptions = await listActiveStoredSubscriptions();
  const payload = await buildPayload({
    result: finalResult,
    feedUrls: activeSubscriptions.map((subscription) => subscription.feedUrl),
    opml,
    refreshPipeline: false,
    includeContents: false
  });

  options.onProgress?.({
    jobId: options.jobId,
    phase: 'completed',
    total,
    completed,
    importedCount: opml.importedCount,
    skippedCount: opml.skippedCount,
    message: `Finished syncing ${succeededCount}/${total} imported feeds.`,
    payload
  });
}

async function buildProgressPayload(
  results: Week2SyncAllResult['results'],
  total: number,
  opml: NonNullable<Week2FrontendSyncPayload['opml']>
): Promise<Week2FrontendSyncPayload> {
  const succeededCount = results.filter((item) => item.status === 'succeeded').length;
  const failedCount = results.filter((item) => item.status === 'failed').length;
  const partialResult: Week2SyncAllResult = {
    status: failedCount === 0 ? 'succeeded' : succeededCount === 0 ? 'failed' : 'partial',
    totalSubscriptions: total,
    succeededCount,
    failedCount,
    totalSavedArticles: results.reduce((sum, item) => sum + item.savedCount, 0),
    results: [...results]
  };
  const activeSubscriptions = await listActiveStoredSubscriptions();
  return buildPayload({
    result: partialResult,
    feedUrls: activeSubscriptions.map((item) => item.feedUrl),
    opml,
    refreshPipeline: false,
    includeContents: false
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

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}
