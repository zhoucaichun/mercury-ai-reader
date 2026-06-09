// ─── Feed ────────────────────────────────────────────────────
export interface Feed {
  id: number;
  title: string | null;
  feedUrl: string;
  siteUrl: string | null;
  description: string | null;
  feedParserVersion: number | null;
  lastFetchedAt: string | null;
  isEnabled?: boolean;
  createdAt: string;
}

// ─── Entry ───────────────────────────────────────────────────
export interface Entry {
  id: number;
  feedId: number;
  guid: string | null;
  url: string | null;
  title: string | null;
  author: string | null;
  publishedAt: string | null;
  summary: string | null;
  isRead: boolean;
  isStarred: boolean;
  isDeleted: boolean;
  createdAt: string;
}

// ─── SyncLog ─────────────────────────────────────────────────
export type SyncStatus = 'running' | 'succeeded' | 'failed' | 'partial';

export interface SyncLog {
  id: number;
  feedId: number;
  status: SyncStatus;
  newEntriesCount: number;
  errorMessage: string | null;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

// ─── Content ─────────────────────────────────────────────────
export type ContentDisplayMode = 'web' | 'cleaned';
export type ReaderPipelineType = 'default' | string;

export interface Content {
  id: number;
  entryId: number;
  html: string | null;
  cleanedHtml: string | null;
  readabilityTitle: string | null;
  readabilityByline: string | null;
  readabilityVersion: number | null;
  markdown: string | null;
  markdownVersion: number | null;
  displayMode: ContentDisplayMode;
  documentBaseUrl: string | null;
  pipelineType: ReaderPipelineType;
  resolvedIntermediateContent: string | null;
  createdAt: string;
}

export interface ContentLayerState {
  hasSourceHtml: boolean;
  hasCleanedHtml: boolean;
  hasMarkdown: boolean;
  readabilityVersion: number | null;
  markdownVersion: number | null;
}

// ─── AgentTaskRun ────────────────────────────────────────────
export type AgentTaskType = 'summary' | 'translation';
export type AgentTaskRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface AgentTaskRun {
  id: number;
  entryId: number;
  taskType: AgentTaskType;
  status: AgentTaskRunStatus;
  agentProfileId: number | null;
  providerProfileId: number | null;
  modelProfileId: number | null;
  promptVersion: string | null;
  targetLanguage: string | null;
  templateId: string | null;
  templateVersion: string | null;
  runtimeParameterSnapshot: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── SummaryResult ───────────────────────────────────────────
export type SummaryDetailLevel = 'brief' | 'standard';

export interface SummaryResult {
  taskRunId: number;
  entryId: number;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
  outputLanguage: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

// ─── TranslationResult ───────────────────────────────────────
export type TranslationRunStatus = 'running' | 'succeeded';

export interface TranslationResult {
  taskRunId: number;
  entryId: number;
  targetLanguage: string;
  sourceContentHash: string;
  segmenterVersion: string;
  outputLanguage: string;
  runStatus: TranslationRunStatus;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationSegment {
  taskRunId: number;
  sourceSegmentId: string;
  orderIndex: number;
  sourceTextSnapshot: string | null;
  translatedText: string;
  createdAt: string;
  updatedAt: string;
}

// ─── LLMUsageEvent ──────────────────────────────────────────
export type LLMUsagePurpose = 'summary' | 'translation' | 'connection-test' | 'other';
export type LLMUsageRequestPhase = 'normal' | 'repair' | 'retry';
export type LLMUsageRequestStatus = 'succeeded' | 'failed';

export interface LLMUsageEvent {
  id: number;
  taskRunId: number | null;
  entryId: number | null;
  taskType: AgentTaskType;
  purpose: LLMUsagePurpose;
  // AGENTS.md §8 unified provider fields
  providerId: string;
  providerName: string;
  model: string;
  // Internal snapshot fields (for debugging)
  providerProfileId: number | null;
  modelProfileId: number | null;
  providerBaseUrlSnapshot: string;
  providerResolvedUrlSnapshot: string | null;
  providerResolvedHostSnapshot: string | null;
  providerResolvedPathSnapshot: string | null;
  providerNameSnapshot: string | null;
  modelNameSnapshot: string;
  // Request info
  requestPhase: LLMUsageRequestPhase;
  requestStatus: LLMUsageRequestStatus;
  // Token counts
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  // AGENTS.md §8 fields
  estimated: boolean;
  latencyMs: number | null;
  // Timing
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface LLMUsageEventContext {
  taskRunId: number | null;
  entryId: number | null;
  taskType: AgentTaskType;
  purpose: LLMUsagePurpose;
  providerId: string;
  providerName: string;
  model: string;
  providerProfileId: number | null;
  modelProfileId: number | null;
  providerBaseUrlSnapshot: string;
  providerResolvedUrlSnapshot: string | null;
  providerResolvedHostSnapshot: string | null;
  providerResolvedPathSnapshot: string | null;
  providerNameSnapshot: string | null;
  modelNameSnapshot: string;
  requestPhase: LLMUsageRequestPhase;
  requestStatus: LLMUsageRequestStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  estimated: boolean;
  latencyMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface LLMUsageSummary {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
}

export interface UsageBreakdownItem {
  key: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
}

// ─── AgentProviderProfile / AgentModelProfile ────────────────
export interface AgentProviderProfile {
  id: number;
  name: string;
  baseUrl: string;
  apiKeyRef: string;
  testModel: string;
  isDefault: boolean;
  isEnabled: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentModelProfile {
  id: number;
  providerProfileId: number;
  name: string;
  modelName: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  isStreaming: boolean;
  supportsSummary: boolean;
  supportsTranslation: boolean;
  isDefault: boolean;
  isEnabled: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── AppSettings ─────────────────────────────────────────────
export interface AppSettings {
  key: string;
  value: string;
  updatedAt: string;
}

// ─── Entry List Query Types ──────────────────────────────────
export interface EntryListQuery {
  feedId?: number;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  searchText?: string;
}

export interface EntryListCursor {
  publishedAt: string | null;
  createdAt: string;
  id: number;
}

export interface EntryListItem {
  id: number;
  feedId: number;
  title: string | null;
  publishedAt: string | null;
  createdAt: string;
  isRead: boolean;
  isStarred: boolean;
  feedSourceTitle: string | null;
}

export interface EntryListPageResult {
  entries: EntryListItem[];
  hasMore: boolean;
  nextCursor: EntryListCursor | null;
}

// ═══════════════════════════════════════════════════════════════
// AGENTS.md 对外类型别名
// 内部类型保持 Entry/Content/SyncLog/AgentTaskRun 命名，
// 对外统一使用 AGENTS.md 规定的 Article/ArticleContent/AITaskRun 命名。
// ═══════════════════════════════════════════════════════════════

/** 对外别名：Entry = Article */
export type Article = Entry;

/**
 * 对外别名：Content → ArticleContent
 * 字段映射：html → sourceHtml, markdown → canonicalMarkdown
 * 使用 toArticleContent() 转换函数获取映射后的对象
 */
export interface ArticleContent {
  id: string;
  articleId: string;
  sourceHtml: string | null;
  cleanedHtml: string | null;
  canonicalMarkdown: string | null;
  readabilityTitle: string | null;
  readabilityByline: string | null;
  readabilityVersion: number | null;
  markdownVersion: number | null;
  displayMode: ContentDisplayMode;
  documentBaseUrl: string | null;
  pipelineType: ReaderPipelineType;
  createdAt: string;
  updatedAt: string;
}

/** 对外别名：SyncLog → FeedSyncStatus */
export type FeedSyncStatus = SyncLog;

/** 对外别名：AgentTaskRun → AITaskRun */
export type AITaskRun = AgentTaskRun;

/** Content → ArticleContent 转换函数 */
export function toArticleContent(content: Content): ArticleContent {
  return {
    id: String(content.id),
    articleId: String(content.entryId),
    sourceHtml: content.html,
    cleanedHtml: content.cleanedHtml,
    canonicalMarkdown: content.markdown,
    readabilityTitle: content.readabilityTitle,
    readabilityByline: content.readabilityByline,
    readabilityVersion: content.readabilityVersion,
    markdownVersion: content.markdownVersion,
    displayMode: content.displayMode,
    documentBaseUrl: content.documentBaseUrl,
    pipelineType: content.pipelineType,
    createdAt: content.createdAt,
    updatedAt: content.createdAt, // Content table has no updatedAt; use createdAt
  };
}

// ═══════════════════════════════════════════════════════════════
// Week 2 Main Chain Contract (AGENTS.md §5A)
// ═══════════════════════════════════════════════════════════════

export type ISODateString = string;

export type Week2FeedStatus = 'ready' | 'syncing' | 'error';
export type Week2ArticleReadState = 'unread' | 'reading' | 'saved';
export type Week2SubscriptionStatus = 'active' | 'disabled' | 'error';
export type Week2SubscriptionSource = 'manual' | 'opml' | 'mock';

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
  isRead?: boolean;
  isStarred?: boolean;
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

export interface Week2SyncService {
  syncAll(): Promise<Week2SyncAllResult>;
  syncFeed(subscriptionId: string): Promise<Week2SyncFeedResult>;
}

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

export interface Week2ReaderDataPort {
  listFeeds(): Promise<Week2Feed[]>;
  listArticles(query?: { feedId?: string; searchText?: string }): Promise<Week2Article[]>;
  getArticleContent(articleId: string): Promise<Week2ArticleContent | null>;
}

export interface Week2ReaderPipeline {
  runPipeline(input: {
    articleId: string;
    sourceHtml: string;
    url?: string;
  }): Promise<Week2ArticleContent>;
}

// ═══════════════════════════════════════════════════════════════
// Week 3 AI / Export / Usage Contract (AGENTS.md §5B)
// ═══════════════════════════════════════════════════════════════

// --- External-facing Week3 types (string IDs, provider info) ---

export interface Week3SummaryResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface Week3TranslationResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  sourceLanguage?: string;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export type Week3LLMPurpose = 'summary' | 'translation' | 'connection-test' | 'other';

export interface Week3LLMUsageEvent {
  id: string;
  purpose: Week3LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: 'succeeded' | 'failed';
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  startedAt?: string;
  finishedAt?: string;
  latencyMs?: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface Week3LLMUsageSummary {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  estimatedTokens: number;
  byPurpose: Array<{ purpose: Week3LLMPurpose; calls: number; totalTokens: number }>;
  byProvider: Array<{ providerId: string; providerName: string; calls: number; totalTokens: number }>;
  byModel: Array<{ model: string; calls: number; totalTokens: number }>;
  recent: Week3LLMUsageEvent[];
}

// --- Mapping functions ---

export function toWeek3SummaryResult(
  result: SummaryResult,
  run: AgentTaskRun,
): Week3SummaryResult {
  return {
    id: String(result.taskRunId),
    articleId: String(result.entryId),
    taskId: String(result.taskRunId),
    targetLanguage: result.targetLanguage,
    detailLevel: result.detailLevel,
    markdown: result.markdown,
    providerId: String(run.providerProfileId ?? ''),
    providerName: '',
    model: '',
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export function toWeek3TranslationResult(
  result: TranslationResult,
  run: AgentTaskRun,
): Week3TranslationResult {
  return {
    id: String(result.taskRunId),
    articleId: String(result.entryId),
    taskId: String(result.taskRunId),
    targetLanguage: result.targetLanguage,
    markdown: result.markdown,
    providerId: String(run.providerProfileId ?? ''),
    providerName: '',
    model: '',
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export function toWeek3UsageEvent(event: LLMUsageEvent): Week3LLMUsageEvent {
  return {
    id: String(event.id),
    purpose: event.purpose,
    providerId: event.providerId,
    providerName: event.providerName,
    model: event.model,
    status: event.requestStatus,
    promptTokens: event.promptTokens ?? undefined,
    completionTokens: event.completionTokens ?? undefined,
    totalTokens: event.totalTokens ?? undefined,
    estimated: event.estimated ?? undefined,
    startedAt: event.startedAt ?? undefined,
    finishedAt: event.finishedAt ?? undefined,
    latencyMs: event.latencyMs ?? undefined,
  };
}
