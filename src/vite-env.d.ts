/// <reference types="vite/client" />

import type { Week2Article, Week2ArticleContent, Week2Feed } from './core/types';
import type { Week2Subscription } from './features/feed/sync/types';
import type { Week2SyncAllResult } from './features/feed/sync/types';
import type { Week3LLMConnectionTestResult } from './features/agent/providers/types';
import type { Week3LLMProviderConfig } from './features/agent/providers/types';
import type { Week3LLMUsageEvent, Week3LLMUsageSummary } from './features/usage/types';
import type {
  ReaderLLMProviderConfigInput,
  Week3SummaryRequest,
  Week3SummaryResult,
  Week3TranslationRequest,
  Week3TranslationResult
} from './features/reader/week3AgentUiPort';

type MercuryWeek2SyncPayload = {
  result: Week2SyncAllResult;
  feeds: Week2Feed[];
  articles: Week2Article[];
  contents: Week2ArticleContent[];
  feedUrls: string[];
  syncedAt: string;
  storage?: {
    mode: 'sqlite' | 'json-fallback';
    databasePath: string;
  };
  opml?: {
    importedCount: number;
    skippedCount: number;
    messages: string[];
  };
};

type MercuryWeek2OpmlPreviewPayload = {
  subscriptions: Week2Subscription[];
  skippedCount: number;
  messages: string[];
};

type MercuryWeek2OpmlImportProgress = {
  jobId?: string;
  phase: 'importing' | 'feed-imported' | 'imported' | 'syncing' | 'feed-succeeded' | 'feed-failed' | 'completed';
  total: number;
  completed: number;
  importedCount: number;
  skippedCount: number;
  currentTitle?: string;
  feed?: Week2Feed;
  message?: string;
  payload?: MercuryWeek2SyncPayload;
};

type MercuryRuntimeInfo = {
  platform: NodeJS.Platform;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
  runWeek2Sync(feedUrls?: string[]): Promise<MercuryWeek2SyncPayload>;
  importOpmlText(
    opmlText: string,
    onProgress?: (progress: MercuryWeek2OpmlImportProgress) => void
  ): Promise<MercuryWeek2SyncPayload>;
  importOpmlFile?(
    filePath: string,
    onProgress?: (progress: MercuryWeek2OpmlImportProgress) => void
  ): Promise<MercuryWeek2SyncPayload>;
  previewOpmlText(opmlText: string): Promise<MercuryWeek2OpmlPreviewPayload>;
  getArticleContent(articleId: string): Promise<Week2ArticleContent | null>;
  updateArticleState(input: {
    articleId: string;
    isRead?: boolean;
    isStarred?: boolean;
  }): Promise<MercuryWeek2SyncPayload>;
  updateFeedSubscription(input: {
    feedId: string;
    isEnabled?: boolean;
    isDeleted?: boolean;
  }): Promise<MercuryWeek2SyncPayload>;
  testLLMConnection(config: Required<ReaderLLMProviderConfigInput>): Promise<Week3LLMConnectionTestResult>;
  generateSummary(input: {
    config: Required<ReaderLLMProviderConfigInput>;
    request: Week3SummaryRequest;
  }): Promise<Week3SummaryResult>;
  streamSummary(
    input: {
      config: Required<ReaderLLMProviderConfigInput>;
      request: Week3SummaryRequest;
    },
    onDelta: (delta: string) => void
  ): Promise<Week3SummaryResult>;
  translateArticle(input: {
    config: Required<ReaderLLMProviderConfigInput>;
    request: Week3TranslationRequest;
  }): Promise<Week3TranslationResult>;
  streamTranslation(
    input: {
      config: Required<ReaderLLMProviderConfigInput>;
      request: Week3TranslationRequest;
    },
    onDelta: (delta: string) => void
  ): Promise<Week3TranslationResult>;
  translateText(input: {
    config: Required<ReaderLLMProviderConfigInput>;
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
  }): Promise<{ translatedText: string }>;
  streamTextTranslation(
    input: {
      config: Required<ReaderLLMProviderConfigInput>;
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
    },
    onDelta: (delta: string) => void
  ): Promise<{ translatedText: string }>;
  listUsageEvents(): Promise<Week3LLMUsageEvent[]>;
  getUsageSummary(): Promise<Week3LLMUsageSummary>;
  loadProviderConfig?(): Week3LLMProviderConfig | null;
  saveProviderConfig?(input: ReaderLLMProviderConfigInput): Week3LLMProviderConfig;
  listProviderProfiles?(): Week3LLMProviderConfig[];
  activateProviderProfile?(profile: Week3LLMProviderConfig): Week3LLMProviderConfig;
  deleteProviderProfile?(profile: Pick<Week3LLMProviderConfig, 'baseUrl' | 'model'>): Week3LLMProviderConfig | null;
};

declare global {
  interface Window {
    mercury?: MercuryRuntimeInfo;
  }
}

export {};
