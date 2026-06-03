export const feedFeature = {
  key: 'feed',
  ownerTasks: ['T3', 'T4', 'T5'],
  status: 'mock-entry-ready'
} as const;

// T5 Sync - Week 2 Main Chain
export {
  createSyncService,
  createMockSyncService,
  MockSubscriptionProvider,
  MockFeedParser,
  MockStoragePort,
} from './sync';

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
} from './sync';
