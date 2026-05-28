export type FeedStatus = 'ready' | 'syncing' | 'error';
export type ArticleReadState = 'unread' | 'reading' | 'saved';
export type AgentTaskType = 'summary' | 'translation';
export type AgentRunStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export type Feed = {
  id: string;
  title: string;
  siteUrl: string;
  feedUrl: string;
  unreadCount: number;
  status: FeedStatus;
  lastSyncedAt: string;
};

export type Article = {
  id: string;
  feedId: string;
  title: string;
  author: string;
  url: string;
  excerpt: string;
  publishedAt: string;
  readState: ArticleReadState;
  estimatedMinutes: number;
  tags: string[];
};

export type ArticleContent = {
  articleId: string;
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
};

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
  taskType: AgentTaskType;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: string;
};

// T11: Translation result persisted after a translation run
export type TranslationResult = {
  id: string;
  articleId: string;
  targetLanguage: string;
  translatedText: string;
  status: AgentRunStatus;
  providerId: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

// T11: Fields assembled for single-article Markdown export
export type MarkdownExportData = {
  title: string;
  url: string;
  author: string;
  publishedAt: string;
  summaryText?: string;
  translatedText?: string;
  canonicalMarkdown: string;
};

export type MercuryMockDataset = {
  feeds: Feed[];
  articles: Article[];
  contents: ArticleContent[];
  providers: ProviderPreview[];
  agentPreviews: AgentPreview[];
  usageEvents: LLMUsageEventPreview[];
  translationResults: TranslationResult[];
};
