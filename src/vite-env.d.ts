/// <reference types="vite/client" />

import type { Week2Article, Week2ArticleContent, Week2Feed } from './core/types';
import type { Week2Subscription } from './features/feed/sync/types';
import type { Week2SyncAllResult } from './features/feed/sync/types';
import type { Week3LLMConnectionTestResult } from './features/agent/providers/types';
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

type MercuryRuntimeInfo = {
  platform: NodeJS.Platform;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
  runWeek2Sync(feedUrls?: string[]): Promise<MercuryWeek2SyncPayload>;
  importOpmlText(opmlText: string): Promise<MercuryWeek2SyncPayload>;
  previewOpmlText(opmlText: string): Promise<MercuryWeek2OpmlPreviewPayload>;
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
  translateArticle(input: {
    config: Required<ReaderLLMProviderConfigInput>;
    request: Week3TranslationRequest;
  }): Promise<Week3TranslationResult>;
  listUsageEvents(): Promise<Week3LLMUsageEvent[]>;
  getUsageSummary(): Promise<Week3LLMUsageSummary>;
};

declare global {
  interface Window {
    mercury?: MercuryRuntimeInfo;
  }
}

export {};
