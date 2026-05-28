// ─── Feed ────────────────────────────────────────────────────
export interface Feed {
  id: number;
  title: string | null;
  feedUrl: string;
  siteUrl: string | null;
  description: string | null;
  feedParserVersion: number | null;
  lastFetchedAt: string | null;
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
  | 'timedOut'
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
export type SummaryDetailLevel = 'short' | 'medium' | 'detailed';

export interface SummaryResult {
  taskRunId: number;
  entryId: number;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
  outputLanguage: string;
  text: string;
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
export type LLMUsageRequestPhase = 'normal' | 'repair' | 'retry';
export type LLMUsageRequestStatus = 'succeeded' | 'failed' | 'cancelled' | 'timedOut';
export type LLMUsageAvailability = 'actual' | 'missing';

export interface LLMUsageEvent {
  id: number;
  taskRunId: number | null;
  entryId: number | null;
  taskType: AgentTaskType;
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
  totalTokens: number | null;
  usageAvailability: LLMUsageAvailability;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface LLMUsageEventContext {
  taskRunId: number | null;
  entryId: number | null;
  taskType: AgentTaskType;
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
  durationMs: number | null;
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
