import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderInput,
  Languages,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Wifi
} from 'lucide-react';
import type {
  AgentRunStatus,
  AgentTaskType,
  Article,
  ArticleContent,
  Feed,
  FeedStatus,
  Week2ReaderDataPort
} from '../../core/types';

type ActivePanel = AgentTaskType | 'usage' | 'settings';
type FontSizeSetting = 'small' | 'medium' | 'large';
type LineHeightSetting = 'compact' | 'comfortable' | 'loose';
type SyncStatus = 'idle' | 'running' | 'succeeded' | 'failed';

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

const agentStatusLabels: Record<AgentRunStatus, string> = {
  idle: 'idle',
  queued: 'queued',
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  cancelled: 'cancelled'
};

const emptyReaderDataPort: Week2ReaderDataPort = {
  async listFeeds() {
    return [];
  },

  async listArticles() {
    return [];
  },

  async getArticleContent() {
    return null;
  }
};

function formatDate(value?: string) {
  if (!value) return 'No date';

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function downloadMarkdown(article: Article, content: ArticleContent | null) {
  if (!content?.canonicalMarkdown) return;

  const safeTitle = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([content.canonicalMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle || 'mercury-article'}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createSnapshotReaderDataPort(input: {
  feeds: Feed[];
  articles: Article[];
  contents: ArticleContent[];
}): Week2ReaderDataPort {
  return {
    async listFeeds() {
      return input.feeds;
    },

    async listArticles(query = {}) {
      return input.articles.filter((article) => matchesArticleQuery(article, query));
    },

    async getArticleContent(articleId: string) {
      return input.contents.find((content) => content.articleId === articleId) ?? null;
    }
  };
}

function matchesArticleQuery(article: Article, query: { feedId?: string; searchText?: string }) {
  if (query.feedId && article.feedId !== query.feedId) {
    return false;
  }

  const normalizedSearch = query.searchText?.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [article.title, article.excerpt, article.author, article.url, ...article.tags]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
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
  onSelect,
  onToggleEnabled,
  onDelete
}: {
  feed: Feed;
  selected: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  const status = feed.isEnabled === false ? 'error' : feed.status;

  return (
    <div className={`feed-row ${selected ? 'is-selected' : ''} ${feed.isEnabled === false ? 'is-disabled-feed' : ''}`}>
      <button className="feed-row-select" type="button" onClick={onSelect}>
        <span className="feed-row-main">
          <span className="feed-title">{feed.title}</span>
          <span className="feed-meta">{formatDate(feed.lastSyncedAt)}</span>
        </span>
        <span className="feed-row-side">
          <span className="unread-count">{feed.unreadCount}</span>
          <FeedStatusBadge status={status} />
        </span>
      </button>
      <span className="feed-row-tools">
        <button className="mini-button" type="button" onClick={onToggleEnabled}>
          {feed.isEnabled === false ? 'Enable' : 'Disable'}
        </button>
        <button className="mini-button is-danger" type="button" onClick={onDelete}>
          Delete
        </button>
      </span>
    </div>
  );
}

function ArticleRow({
  article,
  sourceName,
  selected,
  onSelect
}: {
  article: Article;
  sourceName: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const articleState = article as typeof article & { isRead?: boolean; isStarred?: boolean };
  const isRead = Boolean(articleState.isRead ?? articleState.readState !== 'unread');
  const isStarred = Boolean(articleState.isStarred ?? articleState.readState === 'saved');

  return (
    <button
      className={`article-row ${selected ? 'is-selected' : ''} ${isRead ? 'is-read' : 'is-unread'} ${isStarred ? 'is-starred' : ''}`}
      type="button"
      onClick={onSelect}
    >
      <span className="article-row-header">
        <span className={`read-dot ${isRead ? 'read-dot-reading' : 'read-dot-unread'}`} />
        <span>{sourceName}</span>
        <span>{formatDate(article.publishedAt)}</span>
        <span>{article.estimatedMinutes} min</span>
        <span className={`article-state-badge ${isRead ? 'is-read' : 'is-unread'}`}>{isRead ? 'Read' : 'Unread'}</span>
        {isStarred ? <span className="article-state-badge is-starred">Saved</span> : null}
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

function StatusPill({ status }: { status: AgentRunStatus }) {
  return <span className={`agent-status agent-status-${status}`}>{agentStatusLabels[status]}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <BookOpen size={28} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function ReaderApp() {
  const [dataPort, setDataPort] = useState<Week2ReaderDataPort>(() => emptyReaderDataPort);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [selectedContent, setSelectedContent] = useState<ArticleContent | null>(null);
  const [searchText, setSearchText] = useState('');
  const [feedUrlInput, setFeedUrlInput] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('summary');
  const [fontSize, setFontSize] = useState<FontSizeSetting>('medium');
  const [lineHeight, setLineHeight] = useState<LineHeightSetting>('comfortable');
  const [feedsStatus, setFeedsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [articlesStatus, setArticlesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [contentStatus, setContentStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState('Add a Feed URL, import OPML, or sync the default real feeds.');
  const [opmlSummary, setOpmlSummary] = useState<{ importedCount: number; skippedCount: number; messages: string[] } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    setFeedsStatus('loading');
    dataPort
      .listFeeds()
      .then((nextFeeds) => {
        if (cancelled) return;
        setFeeds(nextFeeds);
        setSelectedFeedId((current) => current || nextFeeds[0]?.id || '');
        setFeedsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setFeedsStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [dataPort]);

  useEffect(() => {
    if (!selectedFeedId) {
      setArticles([]);
      setSelectedArticleId('');
      setArticlesStatus('idle');
      return;
    }

    let cancelled = false;
    setArticlesStatus('loading');
    dataPort
      .listArticles({ feedId: selectedFeedId, searchText })
      .then((nextArticles) => {
        if (cancelled) return;
        setArticles(nextArticles);
        setSelectedArticleId((current) =>
          nextArticles.some((article) => article.id === current) ? current : nextArticles[0]?.id || ''
        );
        setArticlesStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setArticlesStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [dataPort, searchText, selectedFeedId]);

  useEffect(() => {
    if (!selectedArticleId) {
      setSelectedContent(null);
      setContentStatus('idle');
      return;
    }

    let cancelled = false;
    setContentStatus('loading');
    dataPort
      .getArticleContent(selectedArticleId)
      .then((content) => {
        if (cancelled) return;
        setSelectedContent(content);
        setContentStatus(content?.cleanedHtml && content.canonicalMarkdown ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setContentStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [dataPort, selectedArticleId]);

  const selectedArticle = articles.find((article) => article.id === selectedArticleId);
  const selectedArticleState = selectedArticle as (typeof selectedArticle & { isRead?: boolean; isStarred?: boolean });
  const selectedArticleIsRead = Boolean(selectedArticleState?.isRead ?? selectedArticleState?.readState !== 'unread');
  const selectedArticleIsStarred = Boolean(selectedArticleState?.isStarred ?? selectedArticleState?.readState === 'saved');
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId);
  const feedTitleById = useMemo(() => new Map(feeds.map((feed) => [feed.id, feed.title])), [feeds]);
  const runtime = window.mercury;
  const readerClassName = `reader-content reader-font-${fontSize} reader-line-${lineHeight}`;

  function handleFeedSelect(feedId: string) {
    setSelectedFeedId(feedId);
  }

  function applySyncPayload(payload: Awaited<ReturnType<NonNullable<typeof runtime>['runWeek2Sync']>>) {
    const nextDataPort = createSnapshotReaderDataPort(payload);
    const nextFeedId = payload.feeds.some((feed) => feed.id === selectedFeedId) ? selectedFeedId : payload.feeds[0]?.id ?? '';
    const nextArticles = payload.articles.filter((article) => !nextFeedId || article.feedId === nextFeedId);
    const nextArticleId = nextArticles.some((article) => article.id === selectedArticleId)
      ? selectedArticleId
      : nextArticles[0]?.id ?? payload.articles[0]?.id ?? '';
    const nextContent = payload.contents.find((content) => content.articleId === nextArticleId) ?? null;

    setDataPort(() => nextDataPort);
    setSearchText('');
    setFeeds(payload.feeds);
    setArticles(nextArticles);
    setSelectedFeedId(nextFeedId);
    setSelectedArticleId(nextArticleId);
    setSelectedContent(nextContent);
    setFeedsStatus('ready');
    setArticlesStatus('ready');
    setContentStatus(nextContent?.cleanedHtml && nextContent.canonicalMarkdown ? 'ready' : 'empty');
    setSyncStatus(payload.result.status === 'failed' ? 'failed' : 'succeeded');

    const opmlPart = payload.opml
      ? ` Imported ${payload.opml.importedCount} OPML feed(s), skipped ${payload.opml.skippedCount}.`
      : '';
    const storagePart =
      payload.storage?.mode === 'sqlite'
        ? ' Stored in SQLite.'
        : payload.storage?.mode === 'json-fallback'
          ? ' Stored locally.'
          : '';
    setSyncMessage(
      `Synced ${payload.result.totalSubscriptions} feed(s), saved ${payload.result.totalSavedArticles} article(s).${opmlPart}${storagePart}`
    );
    setOpmlSummary(payload.opml ?? null);
  }

  async function handleRunWeek2Sync() {
    if (!runtime?.runWeek2Sync) {
      setSyncStatus('failed');
      setSyncMessage('Open the Electron app to run the real Feed sync chain.');
      return;
    }

    const feedUrl = feedUrlInput.trim();
    const feedUrls = feedUrl ? [feedUrl] : undefined;

    setSyncStatus('running');
    setSyncMessage(feedUrl ? 'Syncing the entered Feed URL...' : 'Syncing the default real Feed sources...');
    setFeeds((currentFeeds) => currentFeeds.map((feed) => ({ ...feed, status: 'syncing' })));

    try {
      const payload = await runtime.runWeek2Sync(feedUrls);
      applySyncPayload(payload);
    } catch (error) {
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Feed sync failed.');
    }
  }

  async function handleImportOpmlFile(file?: File) {
    if (!file) return;

    if (!runtime?.importOpmlText) {
      setSyncStatus('failed');
      setSyncMessage('Open the Electron app to import OPML.');
      return;
    }

    setSyncStatus('running');
    setSyncMessage(`Importing ${file.name} and syncing its feeds...`);

    try {
      const payload = await runtime.importOpmlText(await file.text());
      applySyncPayload(payload);
    } catch (error) {
      setSyncStatus('failed');
      const message = error instanceof Error ? error.message : 'OPML import failed.';
      setSyncMessage(message);
      setOpmlSummary({ importedCount: 0, skippedCount: 1, messages: [message] });
    }
  }

  async function handleArticleStateChange(input: { isRead?: boolean; isStarred?: boolean }) {
    if (!selectedArticle || !runtime?.updateArticleState) return;

    try {
      const payload = await runtime.updateArticleState({ articleId: selectedArticle.id, ...input });
      applySyncPayload(payload);
    } catch (error) {
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Article state update failed.');
    }
  }

  async function handleFeedSubscriptionChange(feed: Feed, input: { isEnabled?: boolean; isDeleted?: boolean }) {
    if (!runtime?.updateFeedSubscription) return;

    try {
      const payload = await runtime.updateFeedSubscription({ feedId: feed.id, ...input });
      applySyncPayload(payload);
      setSyncMessage(input.isDeleted ? `Deleted subscription: ${feed.title}` : `Updated subscription: ${feed.title}`);
    } catch (error) {
      setSyncStatus('failed');
      setSyncMessage(error instanceof Error ? error.message : 'Subscription update failed.');
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
          <button
            className={activePanel === 'settings' ? 'icon-button is-active' : 'icon-button'}
            type="button"
            aria-label="Reader settings"
            title="Reader settings"
            onClick={() => setActivePanel('settings')}
          >
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="primary-button" type="button" onClick={handleRunWeek2Sync} disabled={syncStatus === 'running'}>
            <Plus size={17} aria-hidden="true" />
            {syncStatus === 'running' ? 'Syncing' : 'Add Feed'}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Sync feeds"
            title="Sync feeds"
            onClick={handleRunWeek2Sync}
            disabled={syncStatus === 'running'}
          >
            <RefreshCw className={syncStatus === 'running' ? 'spin-icon' : ''} size={18} aria-hidden="true" />
          </button>
          <label className={syncStatus === 'running' ? 'icon-button is-disabled' : 'icon-button'} aria-label="Import OPML" title="Import OPML">
            <FolderInput size={18} aria-hidden="true" />
            <input
              accept=".opml,.xml,text/xml"
              disabled={syncStatus === 'running'}
              type="file"
              onChange={(event) => {
                void handleImportOpmlFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <label className="feed-url-box">
          <Wifi size={17} aria-hidden="true" />
          <input
            aria-label="Feed URL"
            placeholder="Feed URL, empty uses default feeds"
            type="url"
            value={feedUrlInput}
            onChange={(event) => setFeedUrlInput(event.target.value)}
          />
        </label>

        <div className={`sync-message sync-message-${syncStatus}`}>{syncMessage}</div>

        {opmlSummary ? (
          <div className="opml-summary">
            <strong>OPML import</strong>
            <span>
              {opmlSummary.importedCount} imported · {opmlSummary.skippedCount} skipped
            </span>
            {opmlSummary.messages.slice(0, 3).map((message) => (
              <span className="opml-message" key={message}>
                {message}
              </span>
            ))}
          </div>
        ) : null}

        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search articles"
            placeholder="Search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>

        <div className="feed-list">
          {feedsStatus === 'loading' ? <span className="state-line">Loading feeds...</span> : null}
          {feedsStatus === 'error' ? <span className="state-line state-line-error">Feeds failed to load</span> : null}
          {feedsStatus === 'ready' && feeds.length === 0 ? (
            <span className="state-line">No feeds yet. Click Add Feed to sync default sources.</span>
          ) : null}
          {feeds.map((feed) => (
            <FeedRow
              feed={feed}
              key={feed.id}
              selected={feed.id === selectedFeedId}
              onSelect={() => handleFeedSelect(feed.id)}
              onToggleEnabled={() => void handleFeedSubscriptionChange(feed, { isEnabled: feed.isEnabled === false })}
              onDelete={() => void handleFeedSubscriptionChange(feed, { isDeleted: true })}
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
          <span className="count-label">{articles.length}</span>
        </div>

        <div className="article-list">
          {articlesStatus === 'loading' ? <span className="state-line">Loading articles...</span> : null}
          {articlesStatus === 'error' ? (
            <span className="state-line state-line-error">Articles failed to load</span>
          ) : null}
          {articlesStatus === 'ready' && articles.length === 0 ? (
            <span className="state-line">No articles match this feed</span>
          ) : null}
          {articles.map((article) => (
            <ArticleRow
              article={article}
              key={article.id}
              sourceName={feedTitleById.get(article.feedId) ?? 'Unknown feed'}
              selected={article.id === selectedArticle?.id}
              onSelect={() => setSelectedArticleId(article.id)}
            />
          ))}
        </div>
      </section>

      <section className="reader-panel" aria-label="Reader">
        {selectedArticle ? (
          <>
            <header className="reader-header">
              <div className="reader-kicker">
                <BookOpen size={17} aria-hidden="true" />
                <span>{selectedFeed?.title ?? 'Unknown feed'}</span>
                <span>{selectedArticle.author ?? 'Unknown author'}</span>
                <span>{formatDate(selectedArticle.publishedAt)}</span>
              </div>
              <h2>{selectedArticle.title}</h2>
              <p>{selectedArticle.excerpt}</p>
              <div className="reader-actions">
                <a className="tool-button" href={selectedArticle.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={17} aria-hidden="true" />
                  Source
                </a>
                <button
                  className={selectedArticleIsRead ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  title={selectedArticleIsRead ? 'Current status: read. Click to mark unread.' : 'Current status: unread. Click to mark read.'}
                  onClick={() => void handleArticleStateChange({ isRead: !selectedArticleIsRead })}
                >
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {selectedArticleIsRead ? 'Read' : 'Unread'}
                </button>
                <button
                  className={selectedArticleIsStarred ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  title={selectedArticleIsStarred ? 'Current status: saved. Click to unsave.' : 'Current status: not saved. Click to save.'}
                  onClick={() => void handleArticleStateChange({ isStarred: !selectedArticleIsStarred })}
                >
                  <Star size={17} aria-hidden="true" />
                  {selectedArticleIsStarred ? 'Saved' : 'Save'}
                </button>
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
                <button
                  className={activePanel === 'settings' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  onClick={() => setActivePanel('settings')}
                >
                  <Settings size={17} aria-hidden="true" />
                  Settings
                </button>
                <button
                  className="tool-button"
                  type="button"
                  disabled={!selectedContent?.canonicalMarkdown}
                  onClick={() => downloadMarkdown(selectedArticle, selectedContent)}
                >
                  <Download size={17} aria-hidden="true" />
                  Export
                </button>
              </div>
            </header>

            <div className="reader-grid">
              {contentStatus === 'loading' ? (
                <div className="reader-loading">
                  <Clock size={20} aria-hidden="true" />
                  Loading article content...
                </div>
              ) : null}
              {contentStatus === 'error' ? (
                <div className="reader-loading is-error">
                  <CircleAlert size={20} aria-hidden="true" />
                  Article content failed to load
                </div>
              ) : null}
              {contentStatus === 'empty' ? (
                <div className="reader-loading">
                  <FileText size={20} aria-hidden="true" />
                  This article has no saved content yet
                </div>
              ) : null}
              {contentStatus === 'ready' && selectedContent ? (
                <article className={readerClassName}>
                  <div dangerouslySetInnerHTML={{ __html: selectedContent.cleanedHtml }} />
                </article>
              ) : null}

              <aside className="inspector-panel">
                {activePanel === 'usage' ? (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      <Database size={17} aria-hidden="true" />
                      <span>Usage</span>
                    </div>
                    <div className="usage-total">0 tokens</div>
                    <div className="usage-list">
                      <div className="usage-row">
                        <span>Summary / Translation usage will appear after AI calls run.</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activePanel === 'settings' ? (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      <Settings size={17} aria-hidden="true" />
                      <span>Reading Settings</span>
                    </div>
                    <div className="setting-group">
                      <span className="setting-label">Font size</span>
                      <div className="segmented-control" role="group" aria-label="Font size">
                        {(['small', 'medium', 'large'] as const).map((value) => (
                          <button
                            className={fontSize === value ? 'is-selected' : ''}
                            key={value}
                            type="button"
                            onClick={() => setFontSize(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="setting-group">
                      <span className="setting-label">Line height</span>
                      <div className="segmented-control" role="group" aria-label="Line height">
                        {(['compact', 'comfortable', 'loose'] as const).map((value) => (
                          <button
                            className={lineHeight === value ? 'is-selected' : ''}
                            key={value}
                            type="button"
                            onClick={() => setLineHeight(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activePanel === 'summary' || activePanel === 'translation' ? (
                  <div className="inspector-section">
                    <div className="inspector-title">
                      {activePanel === 'summary' ? (
                        <Sparkles size={17} aria-hidden="true" />
                      ) : (
                        <Languages size={17} aria-hidden="true" />
                      )}
                      <span>{activePanel === 'summary' ? 'Summary' : 'Translation'}</span>
                    </div>
                    <div className="agent-status-list">
                      <div className="agent-status-row">
                        <span>{activePanel}</span>
                        <StatusPill status="idle" />
                      </div>
                    </div>
                    <p className="agent-output">
                      {selectedContent?.canonicalMarkdown
                        ? 'This article is ready for AI processing. Summary and Translation will use its canonicalMarkdown input.'
                        : 'Sync and select an article with canonicalMarkdown before running AI processing.'}
                    </p>
                    <div className="inspector-actions">
                      <button className="icon-button" type="button" aria-label="Regenerate" title="Regenerate">
                        <RotateCcw size={16} aria-hidden="true" />
                      </button>
                      <button className="icon-button" type="button" aria-label="Copy" title="Copy">
                        <Copy size={16} aria-hidden="true" />
                      </button>
                      <button className="icon-button" type="button" aria-label="Clear" title="Clear">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="provider-line">
                      <Wifi size={16} aria-hidden="true" />
                      <span>Provider not configured</span>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>

            <footer className="contract-strip">
              <span>
                <FileText size={16} aria-hidden="true" />
                canonicalMarkdown
              </span>
              <span>Local storage</span>
              <span>AI provider</span>
              <span>Usage records</span>
            </footer>
          </>
        ) : (
          <EmptyState message="No article selected" />
        )}
      </section>
    </main>
  );
}
