import type {
  ISODateString,
  Week2Feed,
  Week2FeedParser,
  Week2FeedStatus,
  Week2StoragePort,
  Week2SubscriptionProvider,
  Week2SyncAllResult,
  Week2SyncFeedResult,
  Week2SyncService
} from './types.js';

const DEFAULT_SYNC_CONCURRENCY = 6;

function toISODate(): ISODateString {
  return new Date().toISOString();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export function createSyncService(deps: {
  subscriptionProvider: Week2SubscriptionProvider;
  feedParser: Week2FeedParser;
  storage: Week2StoragePort;
}): Week2SyncService {
  const { subscriptionProvider, feedParser, storage } = deps;

  async function syncSingleFeed(
    subscriptionId: string,
    feedUrl: string,
    feedTitle: string
  ): Promise<Week2SyncFeedResult> {
    const startedAt = toISODate();

    let parsedFeed;
    try {
      parsedFeed = await feedParser.parseFeedUrl(feedUrl);
    } catch (error: any) {
      return {
        subscriptionId,
        feedId: '',
        status: 'failed',
        parsedCount: 0,
        savedCount: 0,
        skippedCount: 0,
        startedAt,
        finishedAt: toISODate(),
        errorMessage: `Feed parse error: ${error.message}`,
      };
    }

    const feedId = generateId();
    const feed: Week2Feed = {
      id: feedId,
      title: parsedFeed.feed.title || feedTitle,
      feedUrl,
      siteUrl: parsedFeed.feed.siteUrl,
      unreadCount: parsedFeed.articles.length,
      status: 'syncing' as Week2FeedStatus,
      lastSyncedAt: undefined,
    };

    try {
      const [savedFeed] = await storage.saveFeeds([feed]);
      const savedFeedId = savedFeed?.id ?? feedId;
      const savedArticles = await storage.saveArticles({
        feedId: savedFeedId,
        articles: parsedFeed.articles,
      });

      await storage.updateFeedSyncStatus({
        feedId: savedFeedId,
        status: 'ready',
        lastSyncedAt: toISODate(),
      });

      return {
        subscriptionId,
        feedId: savedFeedId,
        status: 'succeeded',
        parsedCount: parsedFeed.articles.length,
        savedCount: savedArticles.length,
        skippedCount: parsedFeed.articles.length - savedArticles.length,
        startedAt,
        finishedAt: toISODate(),
      };
    } catch (error: any) {
      try {
        await storage.updateFeedSyncStatus({
          feedId,
          status: 'error',
          errorMessage: error.message,
        });
      } catch {
        // Ignore status update failures; the sync result below still reports the error.
      }

      return {
        subscriptionId,
        feedId,
        status: 'failed',
        parsedCount: parsedFeed.articles.length,
        savedCount: 0,
        skippedCount: parsedFeed.articles.length,
        startedAt,
        finishedAt: toISODate(),
        errorMessage: `Storage error: ${error.message}`,
      };
    }
  }

  return {
    async syncAll(): Promise<Week2SyncAllResult> {
      const startedAt = toISODate();
      let subscriptions;

      try {
        subscriptions = await subscriptionProvider.listActiveSubscriptions();
      } catch (error: any) {
        return {
          status: 'failed',
          totalSubscriptions: 0,
          succeededCount: 0,
          failedCount: 1,
          totalSavedArticles: 0,
          results: [
            {
              subscriptionId: '',
              feedId: '',
              status: 'failed',
              parsedCount: 0,
              savedCount: 0,
              skippedCount: 0,
              startedAt,
              finishedAt: toISODate(),
              errorMessage: `Failed to list subscriptions: ${error.message}`,
            },
          ],
        };
      }

      const results = await mapWithConcurrency(
        subscriptions,
        DEFAULT_SYNC_CONCURRENCY,
        async (subscription) => {
          try {
            return await syncSingleFeed(subscription.id, subscription.feedUrl, subscription.title);
          } catch (error: any) {
            return {
              subscriptionId: subscription.id,
              feedId: '',
              status: 'failed' as const,
              parsedCount: 0,
              savedCount: 0,
              skippedCount: 0,
              startedAt,
              finishedAt: toISODate(),
              errorMessage: error.message,
            };
          }
        }
      );

      const totalSavedArticles = results.reduce((sum, result) => sum + result.savedCount, 0);
      const succeededCount = results.filter((result) => result.status === 'succeeded').length;
      const failedCount = results.filter((result) => result.status === 'failed').length;
      const status =
        failedCount === 0 ? 'succeeded' : succeededCount === 0 ? 'failed' : 'partial';

      return {
        status,
        totalSubscriptions: subscriptions.length,
        succeededCount,
        failedCount,
        totalSavedArticles,
        results,
      };
    },

    async syncFeed(subscriptionId: string): Promise<Week2SyncFeedResult> {
      const subscriptions = await subscriptionProvider.listActiveSubscriptions();
      const subscription = subscriptions.find((item) => item.id === subscriptionId);

      if (!subscription) {
        return {
          subscriptionId,
          feedId: '',
          status: 'failed',
          parsedCount: 0,
          savedCount: 0,
          skippedCount: 0,
          startedAt: toISODate(),
          finishedAt: toISODate(),
          errorMessage: `Subscription not found: ${subscriptionId}`,
        };
      }

      return syncSingleFeed(subscription.id, subscription.feedUrl, subscription.title);
    },
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
