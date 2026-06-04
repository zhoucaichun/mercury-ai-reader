export type ISODateString = string;

export type Week2FeedStatus = 'ready' | 'syncing' | 'error';
export type Week2ArticleReadState = 'unread' | 'reading' | 'saved';
export type Week2SubscriptionStatus = 'active' | 'disabled' | 'error';
export type Week2SubscriptionSource = 'manual' | 'opml' | 'mock';
export type AgentTaskType = 'summary' | 'translation';
export type AgentRunStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type FeedStatus = Week2FeedStatus;
export type ArticleReadState = Week2ArticleReadState;

export type Week2Feed = {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  unreadCount: number;
  status: Week2FeedStatus;
  lastSyncedAt?: ISODateString;
  isEnabled?: boolean;
};

export type Week2Article = {
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
};

export type Week2ArticleContent = {
  articleId: string;
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type Week2ReaderDataPort = {
  listFeeds(): Promise<Week2Feed[]>;
  listArticles(query?: { feedId?: string; searchText?: string }): Promise<Week2Article[]>;
  getArticleContent(articleId: string): Promise<Week2ArticleContent | null>;
};

export type Feed = Week2Feed;
export type Article = Week2Article;
export type ArticleContent = Week2ArticleContent;

export type AgentPreview = {
  taskType: AgentTaskType;
  status: AgentRunStatus;
  model: string;
  output: string;
  updatedAt: string;
};

export type ProviderPreview = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  status: 'mock' | 'configured' | 'error';
};

export type LLMUsageEventPreview = {
  id: string;
  providerId: string;
  providerName: string;
  purpose: AgentTaskType | 'connection-test' | 'other';
  model: string;
  status: 'succeeded' | 'failed';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated?: boolean;
  startedAt: string;
  finishedAt: string;
  latencyMs?: number;
};

export type MercuryMockDataset = {
  feeds: Feed[];
  articles: Article[];
  contents: ArticleContent[];
  providers: ProviderPreview[];
  agentPreviews: AgentPreview[];
  usageEvents: LLMUsageEventPreview[];
};
