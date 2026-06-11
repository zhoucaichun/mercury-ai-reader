import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
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
  HelpCircle,
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Wifi,
  X
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
import { formatTokenCount, summarizeUsage } from '../usage/usage';
import type { LLMUsageEvent } from '../usage/types';
import {
  createBrowserWeek3AgentUiPort,
  loadReaderLLMProviderConfig,
  saveReaderLLMProviderConfig,
  type Week3AgentUiPort,
  type Week3SummaryDetailLevel,
  type Week3SummaryResult,
  type Week3TranslationResult
} from './week3AgentUiPort';

type ActivePanel = AgentTaskType | 'usage';
type DialogType = 'help' | 'settings' | null;
type UiLanguage = 'zh' | 'en';
type FontSizeSetting = 'small' | 'medium' | 'large';
type LineHeightSetting = 'compact' | 'comfortable' | 'loose';
type SyncStatus = 'idle' | 'running' | 'succeeded' | 'failed';
type UsageStatus = 'idle' | 'loading' | 'ready' | 'error';
type ProviderStatus = 'idle' | 'saving' | 'testing' | 'succeeded' | 'failed';

const uiCopy = {
  zh: {
    addFeed: '添加订阅',
    aiProvider: 'AI Provider',
    aiSettings: 'AI 设置',
    allReady: '正文已就绪，可以生成摘要或翻译。',
    appSubtitle: '同步 Feed，阅读文章，并用 AI 生成摘要、翻译和 Markdown 导出。',
    articles: '文章',
    auto: '自动',
    brief: '简短',
    browserPreview: '浏览器预览',
    calls: '调用',
    canonicalMarkdown: 'canonicalMarkdown',
    chinese: '中文',
    clear: '清空',
    clearSummary: '清空当前摘要或翻译结果',
    collapseAi: '收起 AI 面板',
    collapseArticles: '收起文章列表',
    collapseFeeds: '收起订阅栏',
    collapseNav: '收起左侧',
    collapseSummary: '收起摘要',
    compact: '紧凑',
    comfortable: '舒适',
    copy: '复制',
    copied: '已复制到剪贴板。',
    copyResult: '复制当前 AI 结果到剪贴板',
    copySummary: '复制摘要',
    copyTranslation: '复制译文',
    detail: '详细度',
    delete: '删除',
    disable: '停用',
    enable: '启用',
    english: '英文',
    export: '导出',
    exportMarkdown: '导出当前文章 Markdown，包含已有摘要和翻译',
    failed: '失败',
    feedUrlPlaceholder: 'Feed URL，留空默认源',
    feeds: '订阅源',
    fontSize: '字号',
    generate: '生成',
    generating: '生成中',
    help: '说明',
    helpBody: [
      '输入 Feed URL 后点击“同步订阅源”；留空点击会同步默认订阅源。',
      '在中间列表选择文章。正文加载完成后，可以直接生成摘要、翻译或导出 Markdown。',
      '首次使用 AI 前，请在“阅读设置”里填写模型服务的 Base URL、Model 和 API Key。',
      'AI 面板用于调整摘要语言、翻译语言和查看模型调用记录。',
      '点击阅读区左侧的小按钮可以收起或展开左侧列表，进入专注阅读。',
      'API Key 只保存在当前设备的本地浏览器存储中，不要写入代码或提交到 GitHub。'
    ],
    helpTitle: '使用说明',
    importOpml: '导入 OPML',
    interfaceLanguage: '界面语言',
    japanese: '日文',
    large: '大',
    lineHeight: '行距',
    localStorage: '本地存储',
    loadingArticles: '正在加载文章...',
    loadingContent: '正在加载正文...',
    loadingFeeds: '正在加载订阅源...',
    loadingUsage: '正在加载 usage...',
    loose: '宽松',
    medium: '中',
    invalidFeedUrl: 'Feed URL 格式不正确。请检查是否以 http:// 或 https:// 开头，然后重试。',
    noArticle: '选择一篇文章开始阅读',
    noArticleBody: '左侧同步订阅源，中间选择文章；随后可以阅读正文、生成摘要、翻译并导出 Markdown。',
    noArticleContent: '这篇文章还没有保存正文。请重新同步订阅源后再试。',
    noArticles: '当前没有匹配文章。可以切换订阅源、清空搜索词，或重新同步。',
    noFeeds: '还没有订阅源。输入 Feed URL 后同步，或留空同步默认源。',
    noUsage: '暂无 usage 记录。',
    openElectron: '请在 Electron 应用中运行真实 Feed 同步。',
    provider: 'Provider',
    providerApiKey: 'API Key',
    providerApiKeyHint: 'API Key 只保存在本机 localStorage，不会写入仓库。再次保存时如果留空，会沿用已保存的 key。',
    providerApiKeyPlaceholder: '粘贴 API key，保存后仅留在本机',
    providerBaseUrl: 'Base URL',
    providerBaseUrlPlaceholder: '例如 https://api.example.com/v1',
    providerConfigured: '模型服务已配置',
    providerMissing: '模型服务未配置',
    providerModel: 'Model',
    providerModelPlaceholder: '例如 gpt-4o-mini 或学校模型名称',
    providerSaved: '模型服务配置已保存。',
    providerSettings: '模型服务',
    providerSetupCta: '配置模型服务',
    providerSetupPrompt: '开始前建议先配置模型服务。配置后可以直接生成摘要、翻译，并记录用量。',
    providerRequiredAction: '请先配置模型服务，再使用摘要或翻译。',
    providerTest: '测试连接',
    providerTestFailed: '连接失败，请检查 Base URL、Model 和 API Key。',
    providerTestSucceeded: '连接成功，可以生成摘要和翻译。',
    saveProvider: '保存模型配置',
    read: '已读',
    readTooltip: '文章已读，点击标记为未读',
    readingSettings: '阅读设置',
    refresh: '刷新',
    refreshUsage: '刷新模型调用统计',
    regenerate: '重新生成',
    retranslate: '重新翻译',
    save: '收藏',
    saving: '保存中',
    saveTooltip: '点击收藏当前文章',
    saved: '已收藏',
    savedTooltip: '文章已收藏，点击取消收藏',
    searchPlaceholder: '搜索',
    settings: '设置',
    closeDialog: '关闭窗口',
    showArticles: '展开文章列表',
    showAi: '展开 AI 面板',
    showFeeds: '展开订阅栏',
    showNav: '展开左侧',
    showSummary: '展开摘要',
    small: '小',
    source: '原文',
    sourceTooltip: '在浏览器中打开文章原文',
    sourceLanguage: '源语言',
    standard: '标准',
    succeeded: '成功',
    summary: '摘要',
    summaryShownInBody: '摘要已生成，可在这里查看或复制。',
    summaryTooltip: '为当前文章生成摘要',
    summaryHint: '点击生成当前文章的摘要。',
    summarizing: '摘要中',
    syncFeeds: '同步订阅源',
    syncHelp: '留空会同步默认真实订阅源；填写 RSS/Atom 地址会只同步该订阅源。',
    syncing: '同步中',
    targetLanguage: '目标语言',
    tokens: 'tokens',
    translate: '翻译',
    translateTooltip: '将当前文章翻译为目标语言',
    translating: '翻译中',
    translationShownInBody: '译文已生成，可在这里查看或复制。',
    translationHint: '点击翻译当前文章正文。',
    unread: '未读',
    unreadTooltip: '点击标记文章为已读',
    usage: '用量',
    usageTooltip: '查看摘要和翻译的模型调用统计',
    usageRecords: 'Usage 记录',
    welcomeSteps: ['1. 同步订阅源', '2. 选择文章', '3. 摘要、翻译或导出']
  },
  en: {
    addFeed: 'Add Feed',
    aiProvider: 'AI Provider',
    aiSettings: 'AI Settings',
    allReady: 'Article content is ready for summary or translation.',
    appSubtitle: 'Sync feeds, read articles, and use AI for summaries, translations, and Markdown export.',
    articles: 'Articles',
    auto: 'Auto',
    brief: 'Brief',
    browserPreview: 'Browser preview',
    calls: 'Calls',
    canonicalMarkdown: 'canonicalMarkdown',
    chinese: 'Chinese',
    clear: 'Clear',
    clearSummary: 'Clear the current summary or translation result.',
    collapseAi: 'Collapse AI Panel',
    collapseArticles: 'Collapse Article List',
    collapseFeeds: 'Collapse Feeds',
    collapseNav: 'Collapse Sidebar',
    collapseSummary: 'Collapse Summary',
    compact: 'Compact',
    comfortable: 'Comfortable',
    copy: 'Copy',
    copied: 'Copied to clipboard.',
    copyResult: 'Copy the current AI result to clipboard.',
    copySummary: 'Copy summary',
    copyTranslation: 'Copy translation',
    detail: 'Detail',
    delete: 'Delete',
    disable: 'Disable',
    enable: 'Enable',
    english: 'English',
    export: 'Export',
    exportMarkdown: 'Export this article as Markdown, including summary and translation when available.',
    failed: 'Failed',
    feedUrlPlaceholder: 'Feed URL, empty for defaults',
    feeds: 'Feeds',
    fontSize: 'Font size',
    generate: 'Generate',
    generating: 'Generating',
    help: 'Help',
    helpBody: [
      'Enter a Feed URL and click Sync Feeds. Leave it empty to sync the default feeds.',
      'Select an article in the middle list. Once content loads, you can summarize, translate, or export Markdown.',
      'Before using AI, open Reading Settings and fill in the model Base URL, Model, and API Key.',
      'Use the AI panel to adjust summary language, translation language, and inspect usage records.',
      'Use the small button on the left edge of the reader to hide or show the lists for focused reading.',
      'Your API key is stored only in local browser storage on this device. Do not put it in code or commit it to GitHub.'
    ],
    helpTitle: 'How to Use',
    importOpml: 'Import OPML',
    interfaceLanguage: 'Interface language',
    japanese: 'Japanese',
    large: 'Large',
    lineHeight: 'Line height',
    localStorage: 'Local storage',
    loadingArticles: 'Loading articles...',
    loadingContent: 'Loading article content...',
    loadingFeeds: 'Loading feeds...',
    loadingUsage: 'Loading usage...',
    loose: 'Loose',
    medium: 'Medium',
    invalidFeedUrl: 'The Feed URL is invalid. Check that it starts with http:// or https://, then try again.',
    noArticle: 'Choose an article to start reading',
    noArticleBody: 'Sync feeds on the left, choose an article in the middle, then read, summarize, translate, or export it.',
    noArticleContent: 'This article has no saved content yet. Sync the feed again and try later.',
    noArticles: 'No matching articles. Switch feeds, clear the search field, or sync again.',
    noFeeds: 'No feeds yet. Enter a Feed URL, or leave it empty to sync default sources.',
    noUsage: 'No usage events yet.',
    openElectron: 'Open the Electron app to run the real Feed sync chain.',
    provider: 'Provider',
    providerApiKey: 'API Key',
    providerApiKeyHint: 'The API key is stored only in localStorage on this device. Leave it blank later to keep the saved key.',
    providerApiKeyPlaceholder: 'Paste your API key; it stays on this device',
    providerBaseUrl: 'Base URL',
    providerBaseUrlPlaceholder: 'For example, https://api.example.com/v1',
    providerConfigured: 'Model provider configured',
    providerMissing: 'Model provider not configured',
    providerModel: 'Model',
    providerModelPlaceholder: 'For example, gpt-4o-mini or your school model',
    providerSaved: 'Model provider settings saved.',
    providerSettings: 'Model Provider',
    providerSetupCta: 'Configure model',
    providerSetupPrompt: 'Set up a model provider before reading so summary, translation, and usage records are ready.',
    providerRequiredAction: 'Configure a model provider before using summary or translation.',
    providerTest: 'Test connection',
    providerTestFailed: 'Connection failed. Check Base URL, Model, and API Key.',
    providerTestSucceeded: 'Connection succeeded. Summary and translation are ready.',
    saveProvider: 'Save model settings',
    read: 'Read',
    readTooltip: 'This article is read. Click to mark it unread.',
    readingSettings: 'Reading Settings',
    refresh: 'Refresh',
    refreshUsage: 'Refresh model usage statistics.',
    regenerate: 'Regenerate',
    retranslate: 'Retranslate',
    save: 'Save',
    saving: 'Saving',
    saveTooltip: 'Save this article.',
    saved: 'Saved',
    savedTooltip: 'This article is saved. Click to unsave it.',
    searchPlaceholder: 'Search',
    settings: 'Settings',
    closeDialog: 'Close window',
    showArticles: 'Show Article List',
    showAi: 'Show AI Panel',
    showFeeds: 'Show Feeds',
    showNav: 'Show Sidebar',
    showSummary: 'Show Summary',
    small: 'Small',
    source: 'Source',
    sourceTooltip: 'Open the original article in your browser.',
    sourceLanguage: 'Source language',
    standard: 'Standard',
    succeeded: 'Succeeded',
    summary: 'Summary',
    summaryShownInBody: 'The summary is ready here for review or copying.',
    summaryTooltip: 'Generate a summary for the current article.',
    summaryHint: 'Generate a summary for the current article.',
    summarizing: 'Summarizing',
    syncFeeds: 'Sync feeds',
    syncHelp: 'Leave empty to sync default real feeds, or paste an RSS/Atom URL to sync only that feed.',
    syncing: 'Syncing',
    targetLanguage: 'Target language',
    tokens: 'tokens',
    translate: 'Translate',
    translateTooltip: 'Translate the current article to the target language.',
    translating: 'Translating',
    translationShownInBody: 'The translation is ready here for review or copying.',
    translationHint: 'Translate the current article content.',
    unread: 'Unread',
    unreadTooltip: 'Mark this article as read.',
    usage: 'Usage',
    usageTooltip: 'View model call statistics for summary and translation.',
    usageRecords: 'Usage records',
    welcomeSteps: ['1. Sync feeds', '2. Choose an article', '3. Summarize, translate, or export']
  }
} as const;

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

function downloadMarkdownExport(file: { fileName: string; markdown: string }) {
  const blob = new Blob([file.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
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
  onDelete,
  labels
}: {
  feed: Feed;
  selected: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  labels: {
    enable: string;
    disable: string;
    delete: string;
  };
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
        <button className="mini-button" type="button" title={feed.isEnabled === false ? labels.enable : labels.disable} onClick={onToggleEnabled}>
          {feed.isEnabled === false ? labels.enable : labels.disable}
        </button>
        <button className="mini-button is-danger" type="button" title={labels.delete} onClick={onDelete}>
          {labels.delete}
        </button>
      </span>
    </div>
  );
}

function ArticleRow({
  article,
  sourceName,
  selected,
  onSelect,
  labels
}: {
  article: Article;
  sourceName: string;
  selected: boolean;
  onSelect: () => void;
  labels: {
    read: string;
    unread: string;
    saved: string;
  };
}) {
  const articleState = article as typeof article & { isRead?: boolean; isStarred?: boolean };
  const isRead = Boolean(articleState.isRead ?? articleState.readState !== 'unread');
  const isStarred = Boolean(articleState.isStarred ?? articleState.readState === 'saved');

  return (
    <button
      className={`article-row ${selected ? 'is-selected' : ''} ${isRead ? 'is-read' : 'is-unread'} ${isStarred ? 'is-starred' : ''}`}
      type="button"
      title={article.title}
      onClick={onSelect}
    >
      <span className="article-row-header">
        <span className={`read-dot ${isRead ? 'read-dot-reading' : 'read-dot-unread'}`} />
        <span>{sourceName}</span>
        <span>{formatDate(article.publishedAt)}</span>
        <span>{article.estimatedMinutes} min</span>
        <span className={`article-state-badge ${isRead ? 'is-read' : 'is-unread'}`}>{isRead ? labels.read : labels.unread}</span>
        {isStarred ? <span className="article-state-badge is-starred">{labels.saved}</span> : null}
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

function EmptyState({
  actions,
  message,
  notice,
  steps,
  title
}: {
  actions?: ReactNode;
  message: string;
  notice?: ReactNode;
  steps?: readonly string[];
  title: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-card">
        <BookOpen size={30} aria-hidden="true" />
        <h2>{title}</h2>
        <p>{message}</p>
        {steps ? (
          <div className="empty-steps" aria-label={title}>
            {steps.map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
        ) : null}
        {notice ? <div className="empty-notice">{notice}</div> : null}
        {actions ? <div className="empty-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

function MarkdownView({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = [];
  const lines = markdown.split('\n');
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    if (text) {
      blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(text)}</p>);
    }
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    blocks.push(
      <pre className="markdown-code" key={`code-${blocks.length}`}>
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 2, 5);
      blocks.push(renderMarkdownHeading(level, heading[2], `h-${blocks.length}`));
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
      continue;
    }

    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph();
      listItems.push(numbered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  return <div className="markdown-output">{blocks}</div>;
}

function renderMarkdownHeading(level: number, text: string, key: string) {
  if (level <= 3) {
    return <h3 key={key}>{renderInlineMarkdown(text)}</h3>;
  }

  if (level === 4) {
    return <h4 key={key}>{renderInlineMarkdown(text)}</h4>;
  }

  return <h5 key={key}>{renderInlineMarkdown(text)}</h5>;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={`code-${match.index}`}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a href={link[2]} key={`link-${match.index}`} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function DialogShell({
  children,
  icon,
  onClose,
  title,
  closeLabel
}: {
  children: ReactNode;
  icon: ReactNode;
  onClose: () => void;
  title: string;
  closeLabel: string;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div className="dialog-title">
            {icon}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>
  );
}

export function ReaderApp() {
  const [agentUiPort, setAgentUiPort] = useState<Week3AgentUiPort>(() => createBrowserWeek3AgentUiPort());
  const [dataPort, setDataPort] = useState<Week2ReaderDataPort>(() => emptyReaderDataPort);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [selectedContent, setSelectedContent] = useState<ArticleContent | null>(null);
  const [searchText, setSearchText] = useState('');
  const [feedUrlInput, setFeedUrlInput] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('summary');
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('zh');
  const [isFeedsCollapsed, setIsFeedsCollapsed] = useState(false);
  const [isArticleListCollapsed, setIsArticleListCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(true);
  const [fontSize, setFontSize] = useState<FontSizeSetting>('medium');
  const [lineHeight, setLineHeight] = useState<LineHeightSetting>('comfortable');
  const [feedsStatus, setFeedsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [articlesStatus, setArticlesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [contentStatus, setContentStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState('输入 Feed URL 后点击“同步订阅源”；也可以留空同步默认源。');
  const [opmlSummary, setOpmlSummary] = useState<{ importedCount: number; skippedCount: number; messages: string[] } | null>(
    null
  );
  const [summaryTargetLanguage, setSummaryTargetLanguage] = useState('zh-CN');
  const [summaryDetailLevel, setSummaryDetailLevel] = useState<Week3SummaryDetailLevel>('brief');
  const [summaryStatus, setSummaryStatus] = useState<AgentRunStatus>('idle');
  const [summaryResult, setSummaryResult] = useState<Week3SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState('zh-CN');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [translationStatus, setTranslationStatus] = useState<AgentRunStatus>('idle');
  const [translationResult, setTranslationResult] = useState<Week3TranslationResult | null>(null);
  const [translationError, setTranslationError] = useState('');
  const [usageEvents, setUsageEvents] = useState<LLMUsageEvent[]>([]);
  const [usageStatus, setUsageStatus] = useState<UsageStatus>('idle');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [providerModel, setProviderModel] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('idle');
  const [providerMessage, setProviderMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [feedsWidth, setFeedsWidth] = useState(300);
  const [articlesWidth, setArticlesWidth] = useState(360);
  const [aiWidth, setAiWidth] = useState(340);
  const resizeRef = useRef<{ panel: 'feeds' | 'articles' | 'ai'; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const config = loadReaderLLMProviderConfig();
    setProviderConfigured(Boolean(config));
    if (config) {
      setProviderBaseUrl(config.baseUrl);
      setProviderModel(config.model);
    }
  }, []);

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

  useEffect(() => {
    setSummaryStatus('idle');
    setSummaryResult(null);
    setSummaryError('');
    setTranslationStatus('idle');
    setTranslationResult(null);
    setTranslationError('');
    setExportMessage('');
  }, [selectedArticleId]);

  useEffect(() => {
    void refreshUsageEvents();
  }, [agentUiPort]);

  useEffect(() => {
    if (!activeDialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveDialog(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!resizeRef.current) return;
      const { panel, startX, startWidth } = resizeRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(600, startWidth + delta));
      if (panel === 'feeds') setFeedsWidth(newWidth);
      else if (panel === 'articles') setArticlesWidth(newWidth);
      else setAiWidth(newWidth);
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const selectedArticle = articles.find((article) => article.id === selectedArticleId);
  const selectedArticleState = selectedArticle as (typeof selectedArticle & { isRead?: boolean; isStarred?: boolean });
  const selectedArticleIsRead = Boolean(selectedArticleState?.isRead ?? selectedArticleState?.readState !== 'unread');
  const selectedArticleIsStarred = Boolean(selectedArticleState?.isStarred ?? selectedArticleState?.readState === 'saved');
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId);
  const feedTitleById = useMemo(() => new Map(feeds.map((feed) => [feed.id, feed.title])), [feeds]);
  const usageSummary = useMemo(() => summarizeUsage(usageEvents, { recentLimit: 6 }), [usageEvents]);
  const runtime = window.mercury;
  const readerClassName = `reader-content reader-font-${fontSize} reader-line-${lineHeight}`;
  const hasCanonicalMarkdown = Boolean(selectedContent?.canonicalMarkdown.trim());
  const currentSummaryMarkdown = summaryResult?.articleId === selectedArticleId ? summaryResult.markdown : '';
  const currentTranslationMarkdown =
    translationResult?.articleId === selectedArticleId ? translationResult.markdown : '';
  const copy = uiCopy[uiLanguage];
  const shellClassName = [
    'app-shell',
    isFeedsCollapsed ? 'is-feeds-collapsed' : '',
    isArticleListCollapsed ? 'is-articles-collapsed' : '',
    isInspectorCollapsed ? 'is-ai-collapsed' : 'is-ai-open'
  ]
    .filter(Boolean)
    .join(' ');

  const gridStyle = {
    '--feeds-w': isFeedsCollapsed ? '44px' : `${feedsWidth}px`,
    '--articles-w': isArticleListCollapsed ? '44px' : `${articlesWidth}px`,
    '--ai-w': isInspectorCollapsed ? '44px' : `${aiWidth}px`,
  } as Record<string, string>;

  useEffect(() => {
    if (syncStatus === 'idle') {
      setSyncMessage(copy.syncHelp);
    }
  }, [copy.syncHelp, syncStatus]);

  function tooltipProps(text: string) {
    const placeTooltip = (rect: DOMRect) => {
      const tooltipWidth = Math.min(280, window.innerWidth - 32);
      return {
        text,
        x: Math.min(Math.max(rect.left + rect.width / 2, tooltipWidth / 2 + 16), window.innerWidth - tooltipWidth / 2 - 16),
        y: rect.bottom + 10
      };
    };

    return {
      'data-tooltip': text,
      onMouseEnter(event: MouseEvent<HTMLElement>) {
        setTooltip(placeTooltip(event.currentTarget.getBoundingClientRect()));
      },
      onMouseLeave() {
        setTooltip(null);
      },
      onFocus(event: FocusEvent<HTMLElement>) {
        setTooltip(placeTooltip(event.currentTarget.getBoundingClientRect()));
      },
      onBlur() {
        setTooltip(null);
      }
    };
  }

  function openAiPanel(panel?: ActivePanel) {
    if (panel) {
      setActivePanel(panel);
    }
    setIsInspectorCollapsed(false);
  }

  function closeAiPanel() {
    setIsInspectorCollapsed(true);
  }

  function toggleAiPanel() {
    if (isInspectorCollapsed) {
      openAiPanel(activePanel);
    } else {
      closeAiPanel();
    }
  }

  function startResize(e: MouseEvent<HTMLElement>, panel: 'feeds' | 'articles' | 'ai') {
    e.preventDefault();
    const startWidth = panel === 'feeds' ? feedsWidth : panel === 'articles' ? articlesWidth : aiWidth;
    resizeRef.current = { panel, startX: e.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  async function refreshUsageEvents() {
    if (!agentUiPort.listUsageEvents) {
      return;
    }

    setUsageStatus('loading');
    try {
      setUsageEvents(await agentUiPort.listUsageEvents());
      setUsageStatus('ready');
    } catch {
      setUsageStatus('error');
    }
  }

  function createSelectedArticleInput() {
    if (!selectedArticle || !selectedContent?.canonicalMarkdown.trim()) {
      throw new Error('Select an article with canonicalMarkdown before running AI processing.');
    }

    return {
      articleId: selectedArticle.id,
      title: selectedArticle.title,
      sourceUrl: selectedArticle.url,
      feedTitle: feedTitleById.get(selectedArticle.feedId),
      author: selectedArticle.author,
      publishedAt: selectedArticle.publishedAt,
      canonicalMarkdown: selectedContent.canonicalMarkdown
    };
  }

  async function handleGenerateSummary(regenerate = false) {
    openAiPanel('summary');

    if (!ensureProviderConfigured('summary')) {
      return;
    }

    setSummaryStatus('running');
    setSummaryError('');

    try {
      const result = await agentUiPort.generateSummary({
        ...createSelectedArticleInput(),
        targetLanguage: summaryTargetLanguage,
        detailLevel: summaryDetailLevel,
        regenerate
      });
      setSummaryResult(result);
      setSummaryStatus('succeeded');
      await refreshUsageEvents();
    } catch (error) {
      setSummaryStatus('failed');
      setSummaryError(error instanceof Error ? error.message : 'Summary generation failed.');
      await refreshUsageEvents();
    }
  }

  async function handleTranslateArticle(regenerate = false) {
    openAiPanel('translation');

    if (!ensureProviderConfigured('translation')) {
      return;
    }

    setTranslationStatus('running');
    setTranslationError('');

    try {
      const result = await agentUiPort.translateArticle({
        ...createSelectedArticleInput(),
        sourceLanguage: sourceLanguage === 'auto' ? undefined : sourceLanguage,
        targetLanguage: translationTargetLanguage,
        regenerate
      });
      setTranslationResult(result);
      setTranslationStatus('succeeded');
      await refreshUsageEvents();
    } catch (error) {
      setTranslationStatus('failed');
      setTranslationError(error instanceof Error ? error.message : 'Translation failed.');
      await refreshUsageEvents();
    }
  }

  async function handleExportCurrentArticle() {
    if (!selectedArticle || !selectedContent?.canonicalMarkdown.trim()) return;

    try {
      const file = await agentUiPort.exportCurrentArticle({
        title: selectedArticle.title,
        url: selectedArticle.url,
        author: selectedArticle.author,
        publishedAt: selectedArticle.publishedAt,
        feedTitle: feedTitleById.get(selectedArticle.feedId),
        canonicalMarkdown: selectedContent.canonicalMarkdown,
        summaryMarkdown: summaryResult?.articleId === selectedArticle.id ? summaryResult.markdown : undefined,
        translationMarkdown:
          translationResult?.articleId === selectedArticle.id ? translationResult.markdown : undefined
      });
      downloadMarkdownExport(file);
      setExportMessage(`${copy.export}: ${file.fileName}`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Markdown export failed.');
    }
  }

  async function handleCopyAgentOutput(output?: string) {
    if (!output?.trim()) return;
    await navigator.clipboard?.writeText(output);
    setExportMessage(copy.copied);
  }

  function ensureProviderConfigured(agentType: 'summary' | 'translation') {
    if (loadReaderLLMProviderConfig()) {
      return true;
    }

    setProviderConfigured(false);
    setProviderStatus('failed');
    setProviderMessage(copy.providerRequiredAction);
    setActiveDialog('settings');

    if (agentType === 'summary') {
      setSummaryStatus('failed');
      setSummaryError(copy.providerRequiredAction);
    } else {
      setTranslationStatus('failed');
      setTranslationError(copy.providerRequiredAction);
    }

    return false;
  }

  async function handleSaveProviderConfig() {
    setProviderStatus('saving');
    setProviderMessage('');

    try {
      const config = saveReaderLLMProviderConfig({
        baseUrl: providerBaseUrl,
        model: providerModel,
        apiKey: providerApiKey
      });
      setProviderBaseUrl(config.baseUrl);
      setProviderModel(config.model);
      setProviderApiKey('');
      setProviderConfigured(true);
      setAgentUiPort(createBrowserWeek3AgentUiPort());
      setProviderStatus('succeeded');
      setProviderMessage(copy.providerSaved);
      await refreshUsageEvents();
    } catch (error) {
      setProviderStatus('failed');
      setProviderMessage(error instanceof Error ? error.message : copy.providerTestFailed);
    }
  }

  async function handleTestProviderConnection() {
    setProviderStatus('testing');
    setProviderMessage('');

    try {
      if (providerBaseUrl.trim() && providerModel.trim()) {
        const config = saveReaderLLMProviderConfig({
          baseUrl: providerBaseUrl,
          model: providerModel,
          apiKey: providerApiKey
        });
        setProviderBaseUrl(config.baseUrl);
        setProviderModel(config.model);
        setProviderApiKey('');
        setProviderConfigured(true);
      }

      const port = createBrowserWeek3AgentUiPort();
      setAgentUiPort(port);
      const result = await port.testConnection?.();
      await refreshUsageEvents();

      if (result?.status === 'succeeded') {
        setProviderStatus('succeeded');
        setProviderMessage(`${copy.providerTestSucceeded} ${result.latencyMs ?? 0}ms`);
      } else {
        setProviderStatus('failed');
        setProviderMessage(result?.errorMessage || copy.providerTestFailed);
      }
    } catch (error) {
      await refreshUsageEvents();
      setProviderStatus('failed');
      setProviderMessage(error instanceof Error ? error.message : copy.providerTestFailed);
    }
  }

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
      setSyncMessage(copy.openElectron);
      return;
    }

    const feedUrl = feedUrlInput.trim();
    const feedUrls = feedUrl ? [feedUrl] : undefined;

    if (feedUrl) {
      try {
        const parsedUrl = new URL(feedUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error(copy.invalidFeedUrl);
        }
      } catch {
        setSyncStatus('failed');
        setSyncMessage(copy.invalidFeedUrl);
        return;
      }
    }

    setSyncStatus('running');
    setSyncMessage(feedUrl ? `${copy.syncing} ${feedUrl}...` : `${copy.syncing}...`);
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
    <main className={shellClassName} style={gridStyle}>
      <aside className="sidebar" aria-label={copy.feeds}>
        {!isFeedsCollapsed && <div className="resize-handle" onMouseDown={(e) => startResize(e, 'feeds')} />}
        <div className="brand-block">
          <div>
            <p className="eyebrow">Mercury</p>
            <h1>AI Reader</h1>
            <p className="brand-subtitle">{copy.appSubtitle}</p>
          </div>
          <div className="brand-actions">
            <button
              className={activeDialog === 'help' ? 'icon-button is-active' : 'icon-button'}
              type="button"
              aria-label={copy.help}
              {...tooltipProps(copy.helpTitle)}
              onClick={() => setActiveDialog('help')}
            >
              <HelpCircle size={18} aria-hidden="true" />
            </button>
            <button
              className={activeDialog === 'settings' ? 'icon-button is-active' : 'icon-button'}
              type="button"
              aria-label={copy.settings}
              {...tooltipProps(copy.readingSettings)}
              onClick={() => setActiveDialog('settings')}
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="sidebar-actions">
          <button className="primary-button" type="button" {...tooltipProps(copy.syncHelp)} onClick={handleRunWeek2Sync} disabled={syncStatus === 'running'}>
            {syncStatus === 'running' ? <RefreshCw className="spin-icon" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
            {syncStatus === 'running' ? copy.syncing : copy.addFeed}
          </button>
          <label className={syncStatus === 'running' ? 'icon-button is-disabled' : 'icon-button'} aria-label={copy.importOpml} {...tooltipProps(copy.importOpml)}>
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
            placeholder={copy.feedUrlPlaceholder}
            type="url"
            value={feedUrlInput}
            onChange={(event) => setFeedUrlInput(event.target.value)}
          />
        </label>

        <div className={`sync-message sync-message-${syncStatus}`} aria-live="polite">
          {syncMessage}
        </div>

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
            placeholder={copy.searchPlaceholder}
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>

        <div className="feed-list">
          {feedsStatus === 'loading' ? <span className="state-line">{copy.loadingFeeds}</span> : null}
          {feedsStatus === 'error' ? <span className="state-line state-line-error">Feeds failed to load</span> : null}
          {feedsStatus === 'ready' && feeds.length === 0 ? (
            <span className="state-line">{copy.noFeeds}</span>
          ) : null}
          {feeds.map((feed) => (
            <FeedRow
              feed={feed}
              key={feed.id}
              selected={feed.id === selectedFeedId}
              onSelect={() => handleFeedSelect(feed.id)}
              onToggleEnabled={() => void handleFeedSubscriptionChange(feed, { isEnabled: feed.isEnabled === false })}
              onDelete={() => void handleFeedSubscriptionChange(feed, { isDeleted: true })}
              labels={{ enable: copy.enable, disable: copy.disable, delete: copy.delete }}
            />
          ))}
        </div>

        <div className="runtime-strip">
          <Cpu size={16} aria-hidden="true" />
          <span>{runtime ? `${runtime.platform} / Electron ${runtime.versions.electron}` : copy.browserPreview}</span>
        </div>
        <button
          className="column-edge-toggle feed-edge-toggle"
          type="button"
          aria-label={isFeedsCollapsed ? copy.showFeeds : copy.collapseFeeds}
          {...tooltipProps(isFeedsCollapsed ? copy.showFeeds : copy.collapseFeeds)}
          onClick={() => setIsFeedsCollapsed((current) => !current)}
        >
          {isFeedsCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </aside>

      <section className="article-list-panel" aria-label={copy.articles}>
        {!isArticleListCollapsed && <div className="resize-handle" onMouseDown={(e) => startResize(e, 'articles')} />}
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{selectedFeed?.title ?? 'Feeds'}</p>
            <h2>{copy.articles}</h2>
          </div>
          <span className="count-label">{articles.length}</span>
        </div>

        <div className="article-list">
          {articlesStatus === 'loading' ? <span className="state-line">{copy.loadingArticles}</span> : null}
          {articlesStatus === 'error' ? (
            <span className="state-line state-line-error">Articles failed to load</span>
          ) : null}
          {articlesStatus === 'ready' && articles.length === 0 ? (
            <span className="state-line">{copy.noArticles}</span>
          ) : null}
          {articles.map((article) => (
            <ArticleRow
              article={article}
              key={article.id}
              sourceName={feedTitleById.get(article.feedId) ?? 'Unknown feed'}
              selected={article.id === selectedArticle?.id}
              onSelect={() => setSelectedArticleId(article.id)}
              labels={{ read: copy.read, unread: copy.unread, saved: copy.saved }}
            />
          ))}
        </div>
        <button
          className="column-edge-toggle article-edge-toggle"
          type="button"
          aria-label={isArticleListCollapsed ? copy.showArticles : copy.collapseArticles}
          {...tooltipProps(isArticleListCollapsed ? copy.showArticles : copy.collapseArticles)}
          onClick={() => setIsArticleListCollapsed((current) => !current)}
        >
          {isArticleListCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </section>

      <aside className={`inspector-panel ${isInspectorCollapsed ? 'is-collapsed' : ''}`}>
        <button
          className="column-edge-toggle ai-edge-toggle"
          type="button"
          aria-label={isInspectorCollapsed ? copy.showAi : copy.collapseAi}
          title={isInspectorCollapsed ? copy.showAi : copy.collapseAi}
          onClick={toggleAiPanel}
        >
          {isInspectorCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
        {!isInspectorCollapsed && <div className="resize-handle" onMouseDown={(e) => startResize(e, 'ai')} />}

        {!isInspectorCollapsed && activePanel === 'usage' ? (
          <div className="inspector-section">
            <div className="inspector-title">
              <Database size={17} aria-hidden="true" />
              <span>{copy.usage}</span>
            </div>
            <div className="usage-total">{formatTokenCount(usageSummary.totalTokens)} {copy.tokens}</div>
            <div className="usage-metrics">
              <span>
                <strong>{usageSummary.totalCalls}</strong>
                {copy.calls}
              </span>
              <span>
                <strong>{usageSummary.succeededCalls}</strong>
                {copy.succeeded}
              </span>
              <span>
                <strong>{usageSummary.failedCalls}</strong>
                {copy.failed}
              </span>
            </div>
            <div className="usage-breakdown">
              {usageSummary.byPurpose.length === 0 ? (
                <span>{copy.noUsage}</span>
              ) : (
                usageSummary.byPurpose.map((row) => (
                  <span key={row.purpose}>
                    {row.purpose}: {row.calls} {copy.calls}, {formatTokenCount(row.totalTokens)} {copy.tokens}
                  </span>
                ))
              )}
            </div>
            <div className="usage-list">
              {usageStatus === 'loading' ? <span className="state-line">{copy.loadingUsage}</span> : null}
              {usageStatus === 'error' ? (
                <span className="state-line state-line-error">Usage failed to load</span>
              ) : null}
              {usageSummary.recent.map((event) => (
                <div className="usage-row" key={event.id}>
                  <span>{event.purpose}</span>
                  <strong>{formatTokenCount(event.totalTokens ?? 0)}</strong>
                  <span className={`usage-status usage-status-${event.status}`}>{event.status}</span>
                </div>
              ))}
            </div>
            <button className="tool-button is-full" type="button" title={copy.refresh} onClick={() => void refreshUsageEvents()}>
              <RefreshCw size={16} aria-hidden="true" />
              {copy.refresh}
            </button>
          </div>
        ) : null}

        {!isInspectorCollapsed && (activePanel === 'summary' || activePanel === 'translation') ? (
          <div className="inspector-section">
            <div className="inspector-title">
              {activePanel === 'summary' ? (
                <Sparkles size={17} aria-hidden="true" />
              ) : (
                <Languages size={17} aria-hidden="true" />
              )}
              <span>{activePanel === 'summary' ? copy.summary : copy.translate}</span>
            </div>
            {activePanel === 'summary' ? (
              <div className="agent-controls">
                <label className="setting-group">
                  <span className="setting-label">{copy.targetLanguage}</span>
                  <select value={summaryTargetLanguage} onChange={(event) => setSummaryTargetLanguage(event.target.value)}>
                    <option value="zh-CN">{copy.chinese}</option>
                    <option value="en-US">{copy.english}</option>
                    <option value="ja-JP">{copy.japanese}</option>
                  </select>
                </label>
                <div className="setting-group">
                  <span className="setting-label">{copy.detail}</span>
                  <div className="segmented-control" role="group" aria-label={copy.detail}>
                    {(['brief', 'standard'] as const).map((value) => (
                      <button
                        className={summaryDetailLevel === value ? 'is-selected' : ''}
                        key={value}
                        type="button"
                        title={copy[value]}
                        onClick={() => setSummaryDetailLevel(value)}
                      >
                        {copy[value]}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="primary-button is-compact"
                  type="button"
                  disabled={!hasCanonicalMarkdown || summaryStatus === 'running'}
                  title={currentSummaryMarkdown ? copy.regenerate : copy.generate}
                  onClick={() => void handleGenerateSummary(Boolean(currentSummaryMarkdown))}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {summaryStatus === 'running' ? copy.generating : currentSummaryMarkdown ? copy.regenerate : copy.generate}
                </button>
              </div>
            ) : (
              <div className="agent-controls">
                <label className="setting-group">
                  <span className="setting-label">{copy.targetLanguage}</span>
                  <select
                    value={translationTargetLanguage}
                    onChange={(event) => setTranslationTargetLanguage(event.target.value)}
                  >
                    <option value="zh-CN">{copy.chinese}</option>
                    <option value="en-US">{copy.english}</option>
                    <option value="ja-JP">{copy.japanese}</option>
                  </select>
                </label>
                <label className="setting-group">
                  <span className="setting-label">{copy.sourceLanguage}</span>
                  <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
                    <option value="auto">{copy.auto}</option>
                    <option value="en-US">{copy.english}</option>
                    <option value="zh-CN">{copy.chinese}</option>
                    <option value="ja-JP">{copy.japanese}</option>
                  </select>
                </label>
                <button
                  className="primary-button is-compact"
                  type="button"
                  disabled={!hasCanonicalMarkdown || translationStatus === 'running'}
                  title={currentTranslationMarkdown ? copy.retranslate : copy.translate}
                  onClick={() => void handleTranslateArticle(Boolean(currentTranslationMarkdown))}
                >
                  <Languages size={16} aria-hidden="true" />
                  {translationStatus === 'running' ? copy.translating : currentTranslationMarkdown ? copy.retranslate : copy.translate}
                </button>
              </div>
            )}
            <div className="agent-status-list">
              <div className="agent-status-row">
                <span>{activePanel}</span>
                <StatusPill status={activePanel === 'summary' ? summaryStatus : translationStatus} />
              </div>
            </div>
            {activePanel === 'summary' && summaryError ? <p className="agent-error">{summaryError}</p> : null}
            {activePanel === 'translation' && translationError ? (
              <p className="agent-error">{translationError}</p>
            ) : null}
            <div className="agent-output">
              {activePanel === 'summary' && currentSummaryMarkdown ? (
                <MarkdownView markdown={currentSummaryMarkdown} />
              ) : activePanel === 'translation' && currentTranslationMarkdown ? (
                <MarkdownView markdown={currentTranslationMarkdown} />
              ) : (
                <p className="agent-output-placeholder">
                  {activePanel === 'summary'
                    ? hasCanonicalMarkdown
                      ? copy.summaryHint
                      : 'Sync and select an article with canonicalMarkdown before running AI processing.'
                    : hasCanonicalMarkdown
                      ? copy.translationHint
                      : 'Sync and select an article with canonicalMarkdown before running AI processing.'}
                </p>
              )}
            </div>
            <div className="inspector-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={copy.regenerate}
                title={copy.regenerate}
                disabled={!hasCanonicalMarkdown}
                onClick={() =>
                  activePanel === 'summary'
                    ? void handleGenerateSummary(true)
                    : void handleTranslateArticle(true)
                }
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
              <button
                className="tool-button agent-copy-button"
                type="button"
                aria-label={activePanel === 'summary' ? copy.copySummary : copy.copyTranslation}
                title={activePanel === 'summary' ? copy.copySummary : copy.copyTranslation}
                disabled={activePanel === 'summary' ? !currentSummaryMarkdown : !currentTranslationMarkdown}
                onClick={() =>
                  void handleCopyAgentOutput(
                    activePanel === 'summary' ? currentSummaryMarkdown : currentTranslationMarkdown
                  )
                }
              >
                <Copy size={16} aria-hidden="true" />
                {activePanel === 'summary' ? copy.copySummary : copy.copyTranslation}
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={copy.clear}
                title={copy.clear}
                onClick={() => {
                  if (activePanel === 'summary') {
                    setSummaryStatus('idle');
                    setSummaryResult(null);
                    setSummaryError('');
                  } else {
                    setTranslationStatus('idle');
                    setTranslationResult(null);
                    setTranslationError('');
                  }
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="provider-line">
              <Wifi size={16} aria-hidden="true" />
              <span>
                {activePanel === 'summary' && currentSummaryMarkdown && summaryResult
                  ? `${summaryResult.providerName} / ${summaryResult.model}`
                  : activePanel === 'translation' && currentTranslationMarkdown && translationResult
                    ? `${translationResult.providerName} / ${translationResult.model}`
                    : providerConfigured
                      ? copy.providerConfigured
                      : copy.providerMissing}
              </span>
            </div>
          </div>
        ) : null}
      </aside>

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
                <a className="tool-button" href={selectedArticle.url} target="_blank" rel="noreferrer" {...tooltipProps(copy.sourceTooltip)}>
                  <ExternalLink size={17} aria-hidden="true" />
                  {copy.source}
                </a>
                <button
                  className={selectedArticleIsRead ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  aria-label={selectedArticleIsRead ? copy.readTooltip : copy.unreadTooltip}
                  {...tooltipProps(selectedArticleIsRead ? copy.readTooltip : copy.unreadTooltip)}
                  onClick={() => void handleArticleStateChange({ isRead: !selectedArticleIsRead })}
                >
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {selectedArticleIsRead ? copy.read : copy.unread}
                </button>
                <button
                  className={selectedArticleIsStarred ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  aria-label={selectedArticleIsStarred ? copy.savedTooltip : copy.saveTooltip}
                  {...tooltipProps(selectedArticleIsStarred ? copy.savedTooltip : copy.saveTooltip)}
                  onClick={() => void handleArticleStateChange({ isStarred: !selectedArticleIsStarred })}
                >
                  <Star size={17} aria-hidden="true" />
                  {selectedArticleIsStarred ? copy.saved : copy.save}
                </button>
                <button
                  className={activePanel === 'summary' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  disabled={summaryStatus === 'running'}
                  aria-label={copy.summary}
                  {...tooltipProps(copy.summaryTooltip)}
                  onClick={() =>
                    hasCanonicalMarkdown ? void handleGenerateSummary(Boolean(currentSummaryMarkdown)) : openAiPanel('summary')
                  }
                >
                  <Sparkles size={17} aria-hidden="true" />
                  {summaryStatus === 'running' ? copy.summarizing : copy.summary}
                </button>
                <button
                  className={activePanel === 'translation' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  disabled={translationStatus === 'running'}
                  aria-label={copy.translate}
                  {...tooltipProps(copy.translateTooltip)}
                  onClick={() =>
                    hasCanonicalMarkdown
                      ? void handleTranslateArticle(Boolean(currentTranslationMarkdown))
                      : openAiPanel('translation')
                  }
                >
                  <Languages size={17} aria-hidden="true" />
                  {translationStatus === 'running' ? copy.translating : copy.translate}
                </button>
                <button
                  className={activePanel === 'usage' ? 'tool-button is-active' : 'tool-button'}
                  type="button"
                  aria-label={copy.usage}
                  {...tooltipProps(copy.usageTooltip)}
                  onClick={() => {
                    openAiPanel('usage');
                  }}
                >
                  <BarChart3 size={17} aria-hidden="true" />
                  {copy.usage}
                </button>
                <button
                  className="tool-button"
                  type="button"
                  disabled={!hasCanonicalMarkdown}
                  aria-label={copy.export}
                  {...tooltipProps(copy.exportMarkdown)}
                  onClick={() => void handleExportCurrentArticle()}
                >
                  <Download size={17} aria-hidden="true" />
                  {copy.export}
                </button>
              </div>
              {exportMessage ? <div className="reader-action-message">{exportMessage}</div> : null}
            </header>

            <div className="reader-grid">
              {contentStatus === 'loading' ? (
                <div className="reader-loading">
                  <Clock size={20} aria-hidden="true" />
                  {copy.loadingContent}
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
                  {copy.noArticleContent}
                </div>
              ) : null}
              {contentStatus === 'ready' && selectedContent ? (
                <article className={readerClassName}>
                  <div dangerouslySetInnerHTML={{ __html: selectedContent.cleanedHtml }} />
                </article>
              ) : null}

            </div>

          </>
        ) : (
          <EmptyState
            title={copy.noArticle}
            message={copy.noArticleBody}
            steps={copy.welcomeSteps}
            notice={
              <>
                <Wifi size={18} aria-hidden="true" />
                <span>{providerConfigured ? copy.providerConfigured : copy.providerSetupPrompt}</span>
              </>
            }
            actions={
              <>
                <button className="primary-button" type="button" onClick={handleRunWeek2Sync} disabled={syncStatus === 'running'}>
                  {syncStatus === 'running' ? <RefreshCw className="spin-icon" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                  {syncStatus === 'running' ? copy.syncing : copy.syncFeeds}
                </button>
                <button
                  className={providerConfigured ? 'tool-button' : 'tool-button is-active'}
                  type="button"
                  onClick={() => {
                    if (!providerConfigured) {
                      setProviderStatus('failed');
                      setProviderMessage(copy.providerSetupPrompt);
                    }
                    setActiveDialog('settings');
                  }}
                >
                  <Settings size={17} aria-hidden="true" />
                  {providerConfigured ? copy.providerSettings : copy.providerSetupCta}
                </button>
                <button
                  className="tool-button"
                  type="button"
                  onClick={() => setActiveDialog('help')}
                >
                  <HelpCircle size={17} aria-hidden="true" />
                  {copy.help}
                </button>
              </>
            }
          />
        )}
      </section>
      {activeDialog === 'help' ? (
        <DialogShell
          title={copy.helpTitle}
          closeLabel={copy.closeDialog}
          icon={<HelpCircle size={20} aria-hidden="true" />}
          onClose={() => setActiveDialog(null)}
        >
          <div className="help-panel">
            {copy.helpBody.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </DialogShell>
      ) : null}
      {activeDialog === 'settings' ? (
        <DialogShell
          title={copy.readingSettings}
          closeLabel={copy.closeDialog}
          icon={<Settings size={20} aria-hidden="true" />}
          onClose={() => setActiveDialog(null)}
        >
          <label className="setting-group">
            <span className="setting-label">{copy.interfaceLanguage}</span>
            <select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UiLanguage)}>
              <option value="zh">{copy.chinese}</option>
              <option value="en">{copy.english}</option>
            </select>
          </label>
          <div className="setting-group">
            <span className="setting-label">{copy.fontSize}</span>
            <div className="segmented-control" role="group" aria-label={copy.fontSize}>
              {(['small', 'medium', 'large'] as const).map((value) => (
                <button
                  className={fontSize === value ? 'is-selected' : ''}
                  key={value}
                  type="button"
                  title={copy[value]}
                  onClick={() => setFontSize(value)}
                >
                  {copy[value]}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-group">
            <span className="setting-label">{copy.lineHeight}</span>
            <div className="segmented-control" role="group" aria-label={copy.lineHeight}>
              {(['compact', 'comfortable', 'loose'] as const).map((value) => (
                <button
                  className={lineHeight === value ? 'is-selected' : ''}
                  key={value}
                  type="button"
                  title={copy[value]}
                  onClick={() => setLineHeight(value)}
                >
                  {copy[value]}
                </button>
              ))}
            </div>
          </div>
          <section className="settings-section" aria-label={copy.providerSettings}>
            <div className="settings-section-header">
              <Wifi size={18} aria-hidden="true" />
              <div>
                <h3>{copy.providerSettings}</h3>
                <p>{providerConfigured ? copy.providerConfigured : copy.providerMissing}</p>
              </div>
            </div>
            <label className="setting-group">
              <span className="setting-label">{copy.providerBaseUrl}</span>
              <input
                className="setting-input"
                placeholder={copy.providerBaseUrlPlaceholder}
                type="url"
                value={providerBaseUrl}
                onChange={(event) => setProviderBaseUrl(event.target.value)}
              />
            </label>
            <label className="setting-group">
              <span className="setting-label">{copy.providerModel}</span>
              <input
                className="setting-input"
                placeholder={copy.providerModelPlaceholder}
                type="text"
                value={providerModel}
                onChange={(event) => setProviderModel(event.target.value)}
              />
            </label>
            <label className="setting-group">
              <span className="setting-label">{copy.providerApiKey}</span>
              <input
                autoComplete="off"
                className="setting-input"
                placeholder={copy.providerApiKeyPlaceholder}
                type="password"
                value={providerApiKey}
                onChange={(event) => setProviderApiKey(event.target.value)}
              />
            </label>
            <p className="settings-note">{copy.providerApiKeyHint}</p>
            <div className="settings-actions">
              <button
                className="tool-button"
                type="button"
                disabled={providerStatus === 'saving' || providerStatus === 'testing'}
                onClick={() => void handleSaveProviderConfig()}
              >
                <Settings size={16} aria-hidden="true" />
                {providerStatus === 'saving' ? copy.saving : copy.saveProvider}
              </button>
              <button
                className="primary-button is-compact"
                type="button"
                disabled={providerStatus === 'saving' || providerStatus === 'testing'}
                onClick={() => void handleTestProviderConnection()}
              >
                {providerStatus === 'testing' ? <RefreshCw className="spin-icon" size={16} aria-hidden="true" /> : <Wifi size={16} aria-hidden="true" />}
                {copy.providerTest}
              </button>
            </div>
            {providerMessage ? (
              <p className={providerStatus === 'failed' ? 'agent-error' : 'settings-success'}>{providerMessage}</p>
            ) : null}
          </section>
        </DialogShell>
      ) : null}
      {tooltip ? (
        <div
          className="app-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y
          }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </main>
  );
}
