import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Database,
  Download,
  FileText,
  Languages,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Wifi
} from 'lucide-react';
import { mockDataset } from '../core/mockData';
import type { AgentTaskType, Article, Feed, FeedStatus } from '../core/types';

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

function downloadMarkdown(article: Article) {
  const content = getArticleContent(article.id);
  if (!content) return;

  const safeTitle = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([content.canonicalMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle || 'mercury-article'}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
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

  const selectedArticle = mockDataset.articles.find((article) => article.id === selectedArticleId) ?? filteredArticles[0];
  const selectedContent = selectedArticle ? getArticleContent(selectedArticle.id) : undefined;
  const selectedFeed = mockDataset.feeds.find((feed) => feed.id === selectedFeedId);
  const runtime = window.mercury;
  const usageTotal = mockDataset.usageEvents.reduce((total, event) => total + event.totalTokens, 0);

  function handleFeedSelect(feedId: string) {
    setSelectedFeedId(feedId);
    const firstArticle = mockDataset.articles.find((article) => article.feedId === feedId);
    if (firstArticle) {
      setSelectedArticleId(firstArticle.id);
    }
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
                  onClick={() => setActivePanel('translation')}
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
                <button className="tool-button" type="button" onClick={() => downloadMarkdown(selectedArticle)}>
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
                      <span>Usage</span>
                    </div>
                    <div className="usage-total">{usageTotal.toLocaleString()} tokens</div>
                    <div className="usage-list">
                      {mockDataset.usageEvents.map((event) => (
                        <div className="usage-row" key={event.id}>
                          <span>{event.taskType}</span>
                          <strong>{event.totalTokens}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      {activePanel === 'summary' ? (
                        <Sparkles size={17} aria-hidden="true" />
                      ) : (
                        <Languages size={17} aria-hidden="true" />
                      )}
                      <span>{activePanel === 'summary' ? 'Summary' : 'Translation'}</span>
                    </div>
                    <p className="agent-output">
                      {mockDataset.agentPreviews.find((preview) => preview.taskType === activePanel)?.output}
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
