/**
 * T5 Sync - Week 2 Main Chain Types
 *
 * 所有类型定义严格遵循 AGENTS.md 5A. Week 2 Main Chain Contract。
 * 字段命名使用 camelCase，时间字段使用 ISO string。
 *
 * 注意：Article / ArticleContent / FeedSyncStatus 等核心实体字段以 T2 数据模型为准，
 * 本文件仅定义 Sync 模块使用的接口和结果类型。
 */

// ─── Week 2 类型别名 ─────────────────────────────

export type ISODateString = string;

export type Week2FeedStatus = 'ready' | 'syncing' | 'error';
export type Week2ArticleReadState = 'unread' | 'reading' | 'saved';
export type Week2SubscriptionStatus = 'active' | 'disabled' | 'error';
export type Week2SubscriptionSource = 'manual' | 'opml' | 'mock';

// ─── Week 2 数据接口 ─────────────────────────────

export interface Week2Subscription {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  groupName?: string;
  source: Week2SubscriptionSource;
  status: Week2SubscriptionStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Week2Feed {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  unreadCount: number;
  status: Week2FeedStatus;
  lastSyncedAt?: ISODateString;
  isEnabled?: boolean;
}

export interface Week2ParsedFeed {
  feed: {
    title: string;
    feedUrl: string;
    siteUrl?: string;
    fetchedAt: ISODateString;
  };
  articles: Week2ParsedArticle[];
  warnings: string[];
}

export interface Week2ParsedArticle {
  id?: string;
  feedId?: string;
  guid?: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  contentText?: string;
  publishedAt?: ISODateString;
  updatedAt?: ISODateString;
  tags?: string[];
}

export interface Week2Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  author?: string;
  excerpt: string;
  publishedAt?: ISODateString;
  readState: Week2ArticleReadState;
  estimatedMinutes: number;
  tags: string[];
}

export interface Week2ArticleContent {
  articleId: string;
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─── Week 2 依赖端口接口 ─────────────────────────

export interface Week2SubscriptionProvider {
  listActiveSubscriptions(): Promise<Week2Subscription[]>;
}

export interface Week2FeedParser {
  parseFeedUrl(feedUrl: string): Promise<Week2ParsedFeed>;
  parseFeedText(feedText: string, sourceUrl?: string): Promise<Week2ParsedFeed>;
}

export interface Week2StoragePort {
  saveFeeds(feeds: Week2Feed[]): Promise<Week2Feed[]>;
  listFeeds(): Promise<Week2Feed[]>;

  saveArticles(input: {
    feedId: string;
    articles: Week2ParsedArticle[];
  }): Promise<Week2Article[]>;

  listArticles(query?: {
    feedId?: string;
    searchText?: string;
  }): Promise<Week2Article[]>;

  saveArticleContent(content: Week2ArticleContent): Promise<Week2ArticleContent>;
  getArticleContent(articleId: string): Promise<Week2ArticleContent | null>;
  updateArticleState?(input: {
    articleId: string;
    isRead?: boolean;
    isStarred?: boolean;
  }): Promise<Week2Article>;
  updateFeedSubscription?(input: {
    feedId: string;
    isEnabled?: boolean;
    isDeleted?: boolean;
  }): Promise<void>;

  updateFeedSyncStatus(input: {
    feedId: string;
    status: Week2FeedStatus;
    lastSyncedAt?: ISODateString;
    errorMessage?: string;
  }): Promise<void>;
}

// ─── Week 2 Sync 结果接口 ────────────────────────

export interface Week2SyncFeedResult {
  subscriptionId: string;
  feedId: string;
  status: 'succeeded' | 'failed' | 'partial';
  parsedCount: number;
  savedCount: number;
  skippedCount: number;
  startedAt: ISODateString;
  finishedAt: ISODateString;
  errorMessage?: string;
}

export interface Week2SyncAllResult {
  status: 'succeeded' | 'failed' | 'partial';
  totalSubscriptions: number;
  succeededCount: number;
  failedCount: number;
  totalSavedArticles: number;
  results: Week2SyncFeedResult[];
}

export interface Week2SyncService {
  syncAll(): Promise<Week2SyncAllResult>;
  syncFeed(subscriptionId: string): Promise<Week2SyncFeedResult>;
}
