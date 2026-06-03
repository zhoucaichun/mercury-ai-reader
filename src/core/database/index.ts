// ═══════════════════════════════════════════════════════════════
// Internal types (SQLite / Store layer)
// ═══════════════════════════════════════════════════════════════
export type {
  Feed,
  Entry,
  SyncStatus,
  SyncLog,
  Content,
  ContentDisplayMode,
  ReaderPipelineType,
  ContentLayerState,
  AgentTaskType,
  AgentTaskRunStatus,
  AgentTaskRun,
  SummaryDetailLevel,
  SummaryResult,
  TranslationRunStatus,
  TranslationResult,
  TranslationSegment,
  LLMUsagePurpose,
  LLMUsageRequestPhase,
  LLMUsageRequestStatus,
  LLMUsageEvent,
  LLMUsageEventContext,
  LLMUsageSummary,
  UsageBreakdownItem,
  AgentProviderProfile,
  AgentModelProfile,
  AppSettings,
  EntryListQuery,
  EntryListCursor,
  EntryListItem,
  EntryListPageResult,
} from './types';

// ═══════════════════════════════════════════════════════════════
// AGENTS.md external type aliases
// ═══════════════════════════════════════════════════════════════
export type {
  Article,
  ArticleContent,
  FeedSyncStatus,
  AITaskRun,
  // Week 2 Main Chain types (AGENTS.md §5A)
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
  Week2ReaderDataPort,
  Week2ReaderPipeline,
} from './types';

export { toArticleContent } from './types';

// ═══════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════
export { initDatabase, createInMemoryDatabase } from './init';

// ═══════════════════════════════════════════════════════════════
// Migrations
// ═══════════════════════════════════════════════════════════════
export { runMigrations } from './migrations';
export type { Migration } from './migrations';

// ═══════════════════════════════════════════════════════════════
// Stores (internal)
// ═══════════════════════════════════════════════════════════════
export { createFeedStore } from './stores/feedStore';
export type { IFeedStore, FeedInsert } from './stores/feedStore';

export { createEntryStore } from './stores/entryStore';
export type { IEntryStore, EntryInsert } from './stores/entryStore';

export { createContentStore } from './stores/contentStore';
export type { IContentStore, ContentInsert } from './stores/contentStore';

export { createAppSettingsStore } from './stores/appSettingsStore';
export type { IAppSettingsStore } from './stores/appSettingsStore';

// ═══════════════════════════════════════════════════════════════
// Seed
// ═══════════════════════════════════════════════════════════════
export { seedMockData, cleanSeedData } from './seed';
export type { SeedOptions } from './seed';

// ═══════════════════════════════════════════════════════════════
// Week 2 Storage Port (AGENTS.md §5A)
// ═══════════════════════════════════════════════════════════════
export { createWeek2StoragePort } from './week2StorageAdapter';
