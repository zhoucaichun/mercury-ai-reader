/// <reference types="vite/client" />

import type { Week2Article, Week2ArticleContent, Week2Feed } from './core/types';
import type { Week2Subscription } from './features/feed/sync/types';
import type { Week2SyncAllResult } from './features/feed/sync/types';

type MercuryWeek2SyncPayload = {
  result: Week2SyncAllResult;
  feeds: Week2Feed[];
  articles: Week2Article[];
  contents: Week2ArticleContent[];
  feedUrls: string[];
  syncedAt: string;
  storage?: {
    mode: 'sqlite';
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
};

declare global {
  interface Window {
    mercury?: MercuryRuntimeInfo;
  }
}

export {};
