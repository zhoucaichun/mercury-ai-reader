/**
 * T5 Sync - 公共导出入口
 *
 * 导出 Week2SyncService 实现和创建函数。
 * 路径遵循 AGENTS.md 3. Main Directory Structure：
 *   src/features/feed/sync/index.ts
 *
 * 使用方式：
 *   // 使用 mock adapters（不依赖 T2/T3/T4）
 *   import { createMockSyncService } from './sync';
 *   const syncService = createMockSyncService();
 *   const result = await syncService.syncAll();
 *
 *   // 使用真实 adapters（依赖 T2/T3/T4）
 *   import { createSyncService } from './sync';
 *   const syncService = createSyncService({
 *     subscriptionProvider: t4Provider,
 *     feedParser: t3Parser,
 *     storage: t2Storage,
 *   });
 */

// 导出类型
export type {
  ISODateString,
  Week2FeedStatus,
  Week2ArticleReadState,
  Week2SubscriptionStatus,
  Week2SubscriptionSource,
  Week2Subscription,
  Week2Feed,
  Week2ParsedFeed,
  Week2ParsedArticle,
  Week2Article,
  Week2ArticleContent,
  Week2SubscriptionProvider,
  Week2FeedParser,
  Week2StoragePort,
  Week2SyncService,
  Week2SyncFeedResult,
  Week2SyncAllResult,
} from './types';

// 导出 SyncService 创建函数
export { createSyncService } from './sync.service';

// 导出 Mock Adapters
export {
  MockSubscriptionProvider,
  MockFeedParser,
  MockStoragePort,
} from './mock-adapters';

// 导出便捷函数：创建基于 mock 的完整 SyncService
import { createSyncService } from './sync.service';
import {
  MockSubscriptionProvider,
  MockFeedParser,
  MockStoragePort,
} from './mock-adapters';

/**
 * 创建基于 Mock Adapters 的完整 SyncService
 *
 * 使用真实网络请求拉取 RSS/Atom Feed，
 * 使用内存存储保存文章数据。
 *
 * 适用于 Week 2 集成测试和演示。
 */
export function createMockSyncService() {
  return createSyncService({
    subscriptionProvider: new MockSubscriptionProvider(),
    feedParser: new MockFeedParser(),
    storage: new MockStoragePort(),
  });
}
