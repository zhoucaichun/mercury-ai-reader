/**
 * T5 Sync - SyncService 实现
 *
 * 核心同步服务，调用 T4（订阅源）-> T3（Feed 解析）-> T2（存储）。
 * 遵循 AGENTS.md 5A. Week 2 Main Chain Contract。
 *
 * 特性：
 * - 单个订阅源失败不影响其他订阅源同步
 * - 文章去重（guid > url）
 * - 同步时同时保存 Article 和 ArticleContent
 * - 如果 T6 pipeline 暂未接入，使用 sourceHtml = contentHtml, canonicalMarkdown = 纯文本
 */

import type {
  ISODateString,
  Week2Feed,
  Week2FeedStatus,
  Week2SyncService,
  Week2SyncAllResult,
  Week2SyncFeedResult,
  Week2SubscriptionProvider,
  Week2FeedParser,
  Week2StoragePort,
} from './types.js';

function toISODate(): ISODateString {
  return new Date().toISOString();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * 创建 SyncService 实例
 *
 * @param deps - 依赖端口（T4 SubscriptionProvider, T3 FeedParser, T2 StoragePort）
 */
export function createSyncService(deps: {
  subscriptionProvider: Week2SubscriptionProvider;
  feedParser: Week2FeedParser;
  storage: Week2StoragePort;
}): Week2SyncService {
  const { subscriptionProvider, feedParser, storage } = deps;

  return {
    /**
     * 同步所有活跃的订阅源
     *
     * 流程：
     * 1. 从 T4 获取活跃订阅源列表
     * 2. 逐个同步每个订阅源（try-catch 隔离错误）
     * 3. 汇总结果
     */
    async syncAll(): Promise<Week2SyncAllResult> {
      const startedAt = toISODate();
      const results: Week2SyncFeedResult[] = [];
      let totalSavedArticles = 0;

      // 获取活跃订阅源
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

      // 逐个同步（单个失败不影响其他）
      for (const subscription of subscriptions) {
        try {
          const result = await syncSingleFeed(subscription.id, subscription.feedUrl, subscription.title);
          results.push(result);
          totalSavedArticles += result.savedCount;
        } catch (error: any) {
          // 单个订阅源失败，记录但继续
          results.push({
            subscriptionId: subscription.id,
            feedId: '',
            status: 'failed',
            parsedCount: 0,
            savedCount: 0,
            skippedCount: 0,
            startedAt,
            finishedAt: toISODate(),
            errorMessage: error.message,
          });
        }
      }

      // 汇总
      const succeededCount = results.filter((r) => r.status === 'succeeded').length;
      const failedCount = results.filter((r) => r.status === 'failed').length;

      let overallStatus: 'succeeded' | 'failed' | 'partial';
      if (failedCount === 0) {
        overallStatus = 'succeeded';
      } else if (succeededCount === 0) {
        overallStatus = 'failed';
      } else {
        overallStatus = 'partial';
      }

      return {
        status: overallStatus,
        totalSubscriptions: subscriptions.length,
        succeededCount,
        failedCount,
        totalSavedArticles,
        results,
      };
    },

    /**
     * 同步单个订阅源
     */
    async syncFeed(subscriptionId: string): Promise<Week2SyncFeedResult> {
      // 获取订阅源信息
      const subscriptions = await subscriptionProvider.listActiveSubscriptions();
      const subscription = subscriptions.find((s) => s.id === subscriptionId);

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

  /**
   * 同步单个 Feed 的内部实现
   */
  async function syncSingleFeed(
    subscriptionId: string,
    feedUrl: string,
    feedTitle: string
  ): Promise<Week2SyncFeedResult> {
    const startedAt = toISODate();

    // 1. 解析 Feed
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

    // 2. 创建或获取 Feed 记录
    const feedId = generateId();
    const feed: Week2Feed = {
      id: feedId,
      title: parsedFeed.feed.title || feedTitle,
      feedUrl: parsedFeed.feed.feedUrl || feedUrl,
      siteUrl: parsedFeed.feed.siteUrl,
      unreadCount: parsedFeed.articles.length,
      status: 'syncing' as Week2FeedStatus,
      lastSyncedAt: undefined,
    };

    try {
      const [savedFeed] = await storage.saveFeeds([feed]);
      const savedFeedId = savedFeed?.id ?? feedId;

      // 3. 保存文章（内部去重）
      const savedArticles = await storage.saveArticles({
        feedId: savedFeedId,
        articles: parsedFeed.articles,
      });

      // 4. 更新 Feed 状态为 ready
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
      // 尝试更新 Feed 状态为 error
      try {
        await storage.updateFeedSyncStatus({
          feedId,
          status: 'error',
          errorMessage: error.message,
        });
      } catch {
        // 忽略状态更新失败
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
}
