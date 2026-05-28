import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Copy,
  Cpu,
  Database,
  Download,
  FileText,
  Languages,
  Loader,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Wifi,
  XCircle
} from 'lucide-react';
import { mockDataset } from '../core/mockData';
import type { AgentTaskType, Article, Feed, FeedStatus, TranslationResult } from '../core/types';
import {
  createTranslationAgent,
  createMockLLMProvider,
  InMemoryUsageStore,
} from '../features/agent';
import type {
  TranslationCallInput,
  TranslationCallState,
  LLMUsageEvent,
  LLMProvider,
} from '../features/agent';
import { downloadMarkdownFile } from '../features/export';

// ─── T11: create Provider + UsageStore via dependency injection ──────
//   In production, the Provider comes from T9's createLLMProvider(config).
//   The UsageStore comes from T9's BrowserLocalStorageLLMUsageEventStore.
//   T11 just calls provider.chat() — never fetch directly.

const mockLLMProvider: LLMProvider = createMockLLMProvider({
  id: 'provider-openai-compatible',
  name: 'OpenAI-compatible Mock',
  model: 'mock-reader-model',
});
const usageStore = new InMemoryUsageStore();
const translationAgent = createTranslationAgent({
  provider: mockLLMProvider,
  usageStore,
});

type ActivePanel = AgentTaskType | 'usage';

const statusLabels: Record<FeedStatus, string> = {
  ready: 'Ready',
  syncing: 'Syncing',
  error: 'Check'
};

const statusIcons: Record<FeedStatus, typeof CheckCircle2> = {
  ready: CheckCircle2,
  syncing: RefreshCw,
  error: CircleAlert
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getArticleContent(articleId: string) {
  return mockDataset.contents.find((content) => content.articleId === articleId);
}

function exportArticleMarkdown(
  article: Article,
  translationResult?: TranslationResult,
  summaryText?: string
) {
  const content = getArticleContent(article.id);
  if (!content) return;

  downloadMarkdownFile({
    title: article.title,
    url: article.url,
    author: article.author,
    publishedAt: article.publishedAt,
    summaryText,
    translatedText: translationResult?.translatedText,
    canonicalMarkdown: content.canonicalMarkdown,
  });
}

function FeedStatusBadge({ status }: { status: FeedStatus }) {
  const Icon = statusIcons[status];
  return (
    <span className={`feed-status feed-status-${status}`}>
      <Icon size={14} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

function FeedRow({
  feed,
  selected,
  onSelect
}: {
  feed: Feed;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`feed-row ${selected ? 'is-selected' : ''}`} type="button" onClick={onSelect}>
      <span className="feed-row-main">
        <span className="feed-title">{feed.title}</span>
        <span className="feed-meta">{formatDate(feed.lastSyncedAt)}</span>
      </span>
      <span className="feed-row-side">
        <span className="unread-count">{feed.unreadCount}</span>
        <FeedStatusBadge status={feed.status} />
      </span>
    </button>
  );
}

function ArticleRow({
  article,
  selected,
  onSelect
}: {
  article: Article;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`article-row ${selected ? 'is-selected' : ''}`} type="button" onClick={onSelect}>
      <span className="article-row-header">
        <span className={`read-dot read-dot-${article.readState}`} />
        <span>{formatDate(article.publishedAt)}</span>
        <span>{article.estimatedMinutes} min</span>
      </span>
      <span className="article-row-title">{article.title}</span>
      <span className="article-row-excerpt">{article.excerpt}</span>
      <span className="tag-list">
        {article.tags.map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </span>
    </button>
  );
}

export function App() {
  const [selectedFeedId, setSelectedFeedId] = useState(mockDataset.feeds[0]?.id ?? '');
  const filteredArticles = useMemo(
    () => mockDataset.articles.filter((article) => article.feedId === selectedFeedId),
    [selectedFeedId]
  );
  const [selectedArticleId, setSelectedArticleId] = useState(mockDataset.articles[0]?.id ?? '');
  const [activePanel, setActivePanel] = useState<ActivePanel>('summary');

  // ─── T11 Translation Agent state (mock flow) ───────────────────────
  const [translationState, setTranslationState] = useState<TranslationCallState>({
    status: 'idle',
  });

  // ─── Usage events: mock baseline + T11-generated events ───────────
  const [dynamicUsageEvents, setDynamicUsageEvents] = useState<LLMUsageEvent[]>([]);

  const allUsageEvents = [
    ...mockDataset.usageEvents.map((e) => ({
      id: e.id,
      purpose: e.taskType as LLMUsageEvent['purpose'],
      providerId: e.providerId,
      providerName: mockDataset.providers.find((p) => p.id === e.providerId)?.name ?? e.providerId,
      model: e.model,
      status: 'succeeded' as const,
      usage: {
        promptTokens: e.promptTokens,
        completionTokens: e.completionTokens,
        totalTokens: e.totalTokens,
        estimated: false,
      },
      startedAt: e.createdAt,
      finishedAt: e.createdAt,
      latencyMs: 0,
    })),
    ...dynamicUsageEvents,
  ];

  const usageTotal = allUsageEvents.reduce((sum, e) => sum + e.usage.totalTokens, 0);

  const selectedArticle = mockDataset.articles.find((article) => article.id === selectedArticleId) ?? filteredArticles[0];
  const selectedContent = selectedArticle ? getArticleContent(selectedArticle.id) : undefined;
  const selectedFeed = mockDataset.feeds.find((feed) => feed.id === selectedFeedId);
  const runtime = window.mercury;

  function handleFeedSelect(feedId: string) {
    setSelectedFeedId(feedId);
    const firstArticle = mockDataset.articles.find((article) => article.feedId === feedId);
    if (firstArticle) {
      setSelectedArticleId(firstArticle.id);
    }
  }

  // ─── T11: trigger mock translation via unified Agent → Provider ────
  async function handleTranslate() {
    if (!selectedArticle || !selectedContent) return;

    setActivePanel('translation');
    setTranslationState({ status: 'running' });

    const input: TranslationCallInput = {
      articleId: selectedArticle.id,
      articleTitle: selectedArticle.title,
      canonicalMarkdown: selectedContent.canonicalMarkdown,
      targetLanguage: 'zh-CN',
      sourceLanguage: 'auto',
      providerId: mockDataset.providers[0]?.id ?? 'mock-provider',
      model: mockDataset.providers[0]?.model ?? 'mock-model',
    };

    const result = await translationAgent.translate(input);
    setTranslationState(result);

    // Refresh usage events from the store (T9-aligned)
    const events = await usageStore.list();
    setDynamicUsageEvents(events);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Feeds">
        <div className="brand-block">
          <div>
            <p className="eyebrow">Mercury</p>
            <h1>AI Reader</h1>
          </div>
          <button className="icon-button" type="button" aria-label="Settings" title="Settings">
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="primary-button" type="button">
            <Plus size={17} aria-hidden="true" />
            Add Feed
          </button>
          <button className="icon-button" type="button" aria-label="Sync feeds" title="Sync feeds">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="search-box">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search feeds and articles" placeholder="Search" type="search" />
        </div>

        <div className="feed-list">
          {mockDataset.feeds.map((feed) => (
            <FeedRow
              feed={feed}
              key={feed.id}
              selected={feed.id === selectedFeedId}
              onSelect={() => handleFeedSelect(feed.id)}
            />
          ))}
        </div>

        <div className="runtime-strip">
          <Cpu size={16} aria-hidden="true" />
          <span>{runtime ? `${runtime.platform} / Electron ${runtime.versions.electron}` : 'Browser preview'}</span>
        </div>
      </aside>

      <section className="article-list-panel" aria-label="Articles">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{selectedFeed?.title ?? 'Feeds'}</p>
            <h2>Articles</h2>
          </div>
          <span className="count-label">{filteredArticles.length}</span>
        </div>

        <div className="article-list">
          {filteredArticles.map((article) => (
            <ArticleRow
              article={article}
              key={article.id}
              selected={article.id === selectedArticle?.id}
              onSelect={() => setSelectedArticleId(article.id)}
            />
          ))}
        </div>
      </section>

      <section className="reader-panel" aria-label="Reader">
        {selectedArticle && selectedContent ? (
          <>
            <header className="reader-header">
              <div className="reader-kicker">
                <BookOpen size={17} aria-hidden="true" />
                <span>{selectedArticle.author}</span>
                <span>{formatDate(selectedArticle.publishedAt)}</span>
              </div>
              <h2>{selectedArticle.title}</h2>
              <p>{selectedArticle.excerpt}</p>
              <div className="reader-actions">
                <button
                  className={activePanel === 'summary' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  onClick={() => setActivePanel('summary')}
                >
                  <Sparkles size={17} aria-hidden="true" />
                  Summary
                </button>
                <button
                  className={activePanel === 'translation' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  onClick={handleTranslate}
                >
                  <Languages size={17} aria-hidden="true" />
                  Translate
                </button>
                <button
                  className={activePanel === 'usage' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  onClick={() => setActivePanel('usage')}
                >
                  <BarChart3 size={17} aria-hidden="true" />
                  Usage
                </button>
                <button
                  className="tool-button"
                  type="button"
                  onClick={() =>
                    exportArticleMarkdown(
                      selectedArticle,
                      translationState.result,
                      mockDataset.agentPreviews.find((p) => p.taskType === 'summary')?.output
                    )
                  }
                >
                  <Download size={17} aria-hidden="true" />
                  Export
                </button>
              </div>
            </header>

            <div className="reader-grid">
              <article className="reader-content">
                <div dangerouslySetInnerHTML={{ __html: selectedContent.cleanedHtml }} />
              </article>

              <aside className="inspector-panel">
                {activePanel === 'usage' ? (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      <Database size={17} aria-hidden="true" />
                      <span>LLM Usage</span>
                    </div>
                    <div className="usage-total">{usageTotal.toLocaleString()} tokens</div>
                    <div className="usage-summary-row">
                      <span>{allUsageEvents.length} calls</span>
                      <span>&middot;</span>
                      <span>{allUsageEvents.filter((e) => e.status === 'succeeded').length} succeeded</span>
                    </div>
                    <div className="usage-list">
                      {allUsageEvents.slice(-8).reverse().map((event) => (
                        <div className="usage-row" key={event.id}>
                          <div className="usage-row-left">
                            <span className={`usage-badge usage-badge-${event.purpose}`}>
                              {event.purpose}
                            </span>
                            <span className="usage-model">{event.model}</span>
                          </div>
                          <div className="usage-row-right">
                            <span className={event.status === 'failed' ? 'usage-failed' : ''}>
                              {event.status === 'failed' ? 'fail' : event.usage.totalTokens.toLocaleString()}
                            </span>
                            {event.usage.estimated && (
                              <span className="usage-estimated" title="estimated">~</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activePanel === 'translation' ? (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      <Languages size={17} aria-hidden="true" />
                      <span>Translation</span>
                    </div>

                    {translationState.status === 'running' ? (
                      <div className="agent-running">
                        <Loader size={24} aria-hidden="true" className="spin-icon" />
                        <p>翻译中...</p>
                        <p className="agent-hint">
                          ▸ T9 Provider: {mockDataset.providers[0]?.model}
                        </p>
                      </div>
                    ) : translationState.status === 'failed' ? (
                      <div className="agent-error">
                        <XCircle size={20} aria-hidden="true" />
                        <p>{translationState.errorMessage ?? '翻译失败，请重试'}</p>
                        <button className="primary-button" type="button" onClick={handleTranslate}>
                          <RotateCcw size={15} aria-hidden="true" />
                          重试
                        </button>
                      </div>
                    ) : translationState.status === 'succeeded' && translationState.result ? (
                      <>
                        <p className="agent-output">{translationState.result.translatedText}</p>
                        <div className="agent-actions">
                          <button
                            className="icon-button"
                            type="button"
                            title="复制译文"
                            onClick={() => navigator.clipboard.writeText(translationState.result!.translatedText)}
                          >
                            <Copy size={16} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            title="重新翻译"
                            onClick={handleTranslate}
                          >
                            <RotateCcw size={16} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="provider-line">
                          <Wifi size={16} aria-hidden="true" />
                          <span>
                            {translationState.result.model} &middot;{' '}
                            {translationState.result.totalTokens?.toLocaleString() ?? '—'} tokens
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="agent-idle">
                        <p className="agent-hint">点击 Translate 按钮开始翻译当前文章。</p>
                        <p className="agent-hint">
                          输入：canonical Markdown (T6) &rarr; Agent Runtime (T8) &rarr; LLM Provider (T9)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      <Sparkles size={17} aria-hidden="true" />
                      <span>Summary</span>
                    </div>
                    <p className="agent-output">
                      {mockDataset.agentPreviews.find((preview) => preview.taskType === 'summary')?.output}
                    </p>
                    <div className="provider-line">
                      <Wifi size={16} aria-hidden="true" />
                      <span>{mockDataset.providers[0]?.model}</span>
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <footer className="contract-strip">
              <span>
                <FileText size={16} aria-hidden="true" />
                canonicalMarkdown
              </span>
              <span>agent/providers</span>
              <span>usage/events</span>
            </footer>
          </>
        ) : (
          <div className="empty-state">
            <BookOpen size={28} aria-hidden="true" />
            <p>No article selected</p>
          </div>
        )}
      </section>
    </main>
  );
}
