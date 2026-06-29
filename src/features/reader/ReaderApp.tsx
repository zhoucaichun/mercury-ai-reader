import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
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
  Highlighter,
  Languages,
  List,
  LayoutList,
  PanelLeftClose,
  PanelLeftOpen,
  Pen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  Trash2,
  Type,
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
  activateReaderLLMProviderProfile,
  createBrowserWeek3AgentUiPort,
  deleteReaderLLMProviderProfile,
  loadReaderLLMProviderConfig,
  loadReaderLLMProviderProfiles,
  saveReaderLLMProviderConfig,
  type Week3AgentUiPort,
  type Week3LLMProviderConfig,
  type Week3SummaryDetailLevel,
  type Week3SummaryResult,
  type Week3TranslationResult
} from './week3AgentUiPort';

type ActivePanel = AgentTaskType | 'usage' | 'notes';
type DialogType = 'help' | 'settings' | null;
type UiLanguage = 'zh' | 'en';
type FontSizeSetting = 'small' | 'medium' | 'large';
type LineHeightSetting = 'compact' | 'comfortable' | 'loose';
type SyncStatus = 'idle' | 'running' | 'succeeded' | 'failed';
type UsageStatus = 'idle' | 'loading' | 'ready' | 'error';
type ProviderStatus = 'idle' | 'saving' | 'testing' | 'succeeded' | 'failed';
type ThemeSetting = 'green' | 'light' | 'dark'
  | 'luting' | 'yuanshan' | 'taozhi' | 'chuangsha' | 'taowan'
  | 'shulin' | 'xiuri' | 'xinglin' | 'xuejin';
type ArticleFilterType = 'all' | 'unread' | 'read' | 'saved';

type AnnotationType = 'highlight' | 'underline';

interface HighlightEntry {
  text: string;
  color: string;
  type: AnnotationType;
}

type AgentProgressPhase = 'preparing' | 'requesting' | 'generating' | 'saving' | 'succeeded' | 'failed';

interface AgentProgressState {
  phase: AgentProgressPhase;
  startedAt: number;
  articleTitle: string;
  estimatedInputTokens: number;
}

interface NoteEntry {
  id: string;
  text: string;
  note: string;
  createdAt: string;
}

interface AiHistoryEntry {
  id: string;
  type: 'summary' | 'translation';
  markdown: string;
  targetLanguage: string;
  sourceLanguage?: string;
  detailLevel?: string;
  providerName: string;
  model: string;
  createdAt: string;
}

function loadAiHistory(articleId: string): AiHistoryEntry[] {
  try {
    const raw = localStorage.getItem(`mercury-ai-history-${articleId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAiHistory(articleId: string, entries: AiHistoryEntry[]): void {
  // Keep at most 20 entries per article
  const trimmed = entries.slice(0, 20);
  localStorage.setItem(`mercury-ai-history-${articleId}`, JSON.stringify(trimmed));
}

const HIGHLIGHT_COLORS = [
  { name: 'yellow', value: 'rgba(255, 235, 59, 0.4)' },
  { name: 'green', value: 'rgba(76, 175, 80, 0.3)' },
  { name: 'blue', value: 'rgba(33, 150, 243, 0.3)' },
  { name: 'pink', value: 'rgba(233, 30, 99, 0.25)' },
  { name: 'orange', value: 'rgba(255, 152, 0, 0.35)' },
];

const SUMMARY_PROVIDER_PROFILE_KEY = 'mercury.reader.summaryProviderProfile';
const TRANSLATION_PROVIDER_PROFILE_KEY = 'mercury.reader.translationProviderProfile';

function providerProfileKey(profile: Pick<Week3LLMProviderConfig, 'baseUrl' | 'model'>): string {
  return `${profile.baseUrl}::${profile.model}`;
}

function loadProviderProfileKey(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
}

function saveProviderProfileKey(storageKey: string, key: string): void {
  try {
    if (key) {
      localStorage.setItem(storageKey, key);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // Ignore storage failures; the current provider can still be used.
  }
}

function loadNotes(): Record<string, NoteEntry[]> {
  try {
    const raw = localStorage.getItem('mercury-notes');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, NoteEntry[]>;
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, NoteEntry[]>) {
  localStorage.setItem('mercury-notes', JSON.stringify(notes));
}

function loadReadingProgress(): Map<string, number> {
  try {
    const raw = localStorage.getItem('mercury-reading-progress');
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveReadingProgress(progress: Map<string, number>) {
  const obj: Record<string, number> = {};
  progress.forEach((v, k) => { obj[k] = v; });
  localStorage.setItem('mercury-reading-progress', JSON.stringify(obj));
}

function loadArticleTags(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('mercury-article-tags');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function saveArticleTags(tags: Record<string, string[]>) {
  localStorage.setItem('mercury-article-tags', JSON.stringify(tags));
}

function loadHighlights(): Record<string, HighlightEntry[]> {
  try {
    const raw = localStorage.getItem('mercury-highlights');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, HighlightEntry[]>;
  } catch {
    return {};
  }
}

function saveHighlights(highlights: Record<string, HighlightEntry[]>) {
  localStorage.setItem('mercury-highlights', JSON.stringify(highlights));
}

const uiCopy = {
  zh: {
    addFeed: '添加订阅',
    addTag: '+ 标签',
    aiProvider: 'AI Provider',
    aiSettings: 'AI 设置',
    all: '全部',
    allReady: '正文已就绪，可以生成摘要或翻译。',
    appSubtitle: '',
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
    filterAll: '全部',
    filterUnread: '未读',
    filterRead: '已读',
    filterSaved: '收藏',
    fontSize: '字号',
    generate: '生成',
    generating: '生成中',
    help: '说明',
    helpSections: [
      { title: '订阅管理', items: [
        '输入 Feed URL 后点击"添加订阅"同步文章；留空点击会同步默认订阅源。',
        '支持导入 OPML 文件，批量添加订阅源。',
        '每个订阅源可以单独停用或删除。'
      ]},
      { title: '文章阅读', items: [
        '在中间列表选择文章，支持按 全部/未读/已读/收藏 筛选，也可按标签筛选。',
        '列表支持简洁/详细两种视图模式，点击列表标题栏的图标切换。',
        '阅读区支持拖拽调整三栏宽度，点击边缘按钮可收起/展开面板进入专注阅读。',
        '短文章自动标记为已读；长文章根据滚动进度计算阅读百分比。'
      ]},
      { title: 'AI 功能（摘要 & 翻译）', items: [
        '首次使用前，请在"阅读设置"里配置模型服务的 Base URL、Model 和 API Key。',
        '全文翻译：逐段异步翻译，支持对照阅读模式（原文+译文并排显示）。',
        '划词翻译：选中文字后在弹出菜单中点击翻译图标，结果可一键保存到笔记。',
        '摘要生成：支持选择目标语言和详细程度（简要/标准/详细）。'
      ]},
      { title: '标注与笔记', items: [
        '选中文字后可高亮标注（多种颜色）、添加下划线、或附加笔记。',
        '所有标注和笔记保存在本地，在笔记面板中集中查看。'
      ]},
      { title: '标签管理', items: [
        '点击工具栏的标签图标为文章添加标签，输入框点击即显示已有标签建议。',
        '文章标题下方显示已添加的标签，点击 × 移除单个标签。',
        '在筛选下拉菜单中可按标签筛选文章，也可全局删除某类标签（需二次确认）。'
      ]},
      { title: '数据安全', items: [
        'API Key 只保存在当前设备；桌面端会加密保存，不会上传到任何服务器。',
        '所有阅读数据（进度、标注、笔记、标签）均存储在本地。'
      ]}
    ],
    helpTitle: '使用说明',
    highlight: '高亮',
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
    providerApiKeyHint: 'API Key 只保存在本机；桌面端会加密保存，不会写入仓库或上传服务器。再次保存时如果留空，会沿用已保存的 key。',
    providerApiKeyPlaceholder: '粘贴 API key，保存后仅留在本机',
    providerBaseUrl: 'Base URL',
    providerBaseUrlPlaceholder: '例如 https://api.example.com/v1',
    providerConfigured: '模型服务已配置',
    providerMissing: '模型服务未配置',
    providerModel: 'Model',
    providerModelPlaceholder: '例如 gpt-4o-mini 或学校模型名称',
    providerSaved: '模型服务配置已保存。',
    providerSwitched: '已切换模型配置。',
    providerProfiles: '已保存模型配置',
    providerProfilesEmpty: '保存模型配置后会显示在这里，方便快速切换。',
    providerUseDefault: '使用当前模型',
    providerUseForSummary: '摘要默认模型',
    providerUseForTranslation: '翻译默认模型',
    providerSettings: '模型服务',
    providerSetupCta: '配置模型服务',
    providerSetupPrompt: '开始前建议先配置模型服务。配置后可以直接生成摘要、翻译，并记录用量。',
    providerRequiredAction: '请先配置模型服务，再使用摘要或翻译。',
    providerTest: '测试连接',
    providerTestFailed: '连接失败，请检查 Base URL、Model 和 API Key。',
    providerTestSucceeded: '连接成功。',
    read: '已读',
    readTooltip: '文章已读，点击标记为未读',
    readingSettings: '阅读设置',
    refresh: '刷新',
    refreshUsage: '刷新模型调用统计',
    regenerate: '重新生成',
    retranslate: '重新翻译',
    useProvider: '使用',
    currentProvider: '当前',
    save: '收藏',
    saving: '保存中',
    saveProvider: '保存模型配置',
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
    summaryModel: '摘要模型 / Summary Model',
    summaryShownInBody: '摘要已生成，可在这里查看或复制。',
    summaryTooltip: '为当前文章生成摘要',
    summaryHint: '点击生成当前文章的摘要。',
    summarizing: '摘要中',
    syncFeeds: '同步订阅源',
    syncHelp: '留空会同步默认真实订阅源；填写 RSS/Atom 地址会只同步该订阅源。',
    syncing: '同步中',
    tagFilterAll: '全部标签',
    targetLanguage: '目标语言',
    theme: '主题',
    themeGreen: '绿色护眼',
    themeLight: '明亮',
    themeDark: '夜间',
    themeLuting: '芦汀初雪',
    themeYuanshan: '远山素影',
    themeTaozhi: '桃枝照水',
    themeChuangsha: '窗纱香灰',
    themeTaowan: '陶碗酒痕',
    themeShulin: '疏林茶烟',
    themeXiuri: '绣日摇风',
    themeXinglin: '杏林朝露',
    themeXuejin: '雪尽霜余',
    tokens: 'tokens',
    translate: '翻译',
    translateTooltip: '将当前文章翻译为目标语言',
    translating: '翻译中',
    translationModel: '翻译模型 / Translation Model',
    translationShownInBody: '译文已生成，可在这里查看或复制。',
    translationHint: '点击翻译当前文章正文。',
    bilingualOn: '对照阅读：开',
    bilingualOff: '对照阅读：关',
    addSummaryToNotes: '添加摘要到笔记',
    summaryAlreadyAdded: '已添加',
    notes: '笔记',
    noteInput: '输入笔记...',
    addNote: '添加笔记',
    underline: '划线',
    addToNotes: '添加到笔记',
    translateSelection: '翻译',
    addTranslationToNotes: '添加原文及翻译到笔记',
    noNotes: '暂无笔记，选中文字可以添加划线、高亮或笔记。',
    unread: '未读',
    unreadTooltip: '点击标记文章为已读',
    usage: '用量',
    usageTooltip: '查看摘要和翻译的模型调用统计',
    usageRecords: 'Usage 记录',
    history: '历史记录',
    noHistory: '暂无历史记录。',
    restoreHistory: '恢复此结果',
    deleteHistory: '删除',
    historyTime: '时间',
    welcomeSteps: ['1. 同步订阅源', '2. 选择文章', '3. 摘要、翻译或导出']
  },
  en: {
    addFeed: 'Add Feed',
    addTag: '+ Tag',
    aiProvider: 'AI Provider',
    aiSettings: 'AI Settings',
    all: 'All',
    allReady: 'Article content is ready for summary or translation.',
    appSubtitle: '',
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
    filterAll: 'All',
    filterUnread: 'Unread',
    filterRead: 'Read',
    filterSaved: 'Saved',
    fontSize: 'Font size',
    generate: 'Generate',
    generating: 'Generating',
    help: 'Help',
    helpSections: [
      { title: 'Feed Management', items: [
        'Enter a Feed URL and click "Add Subscription" to sync articles; leave empty to sync default feeds.',
        'Import OPML files to add subscriptions in bulk.',
        'Each feed can be individually disabled or deleted.'
      ]},
      { title: 'Article Reading', items: [
        'Select an article in the middle list. Filter by All / Unread / Read / Saved, or filter by tag.',
        'Toggle between compact and detail view modes using the icon in the list header.',
        'Drag panel edges to resize the three-column layout. Collapse panels for focused reading.',
        'Short articles are automatically marked as read; longer articles track scroll progress.'
      ]},
      { title: 'AI Features (Summary & Translation)', items: [
        'Before first use, configure model Base URL, Model, and API Key in Reading Settings.',
        'Full translation: paragraphs are translated asynchronously, with bilingual reading mode (side-by-side).',
        'Selection translation: select text and click the translate icon in the popup. Save results to notes.',
        'Summary: choose target language and detail level (brief / standard / detailed).'
      ]},
      { title: 'Annotations & Notes', items: [
        'Select text to highlight (multiple colors), underline, or attach a note.',
        'All annotations and notes are saved locally and can be viewed in the Notes panel.'
      ]},
      { title: 'Tag Management', items: [
        'Click the tag icon in the toolbar to add tags. Click the input to see existing tag suggestions.',
        'Tags appear below the article title; click × to remove individual tags.',
        'Filter articles by tag in the dropdown. Delete a tag globally from all articles (with confirmation).'
      ]},
      { title: 'Data & Security', items: [
        'API keys stay on this device; the desktop app stores them encrypted and never uploads them.',
        'All reading data (progress, annotations, notes, tags) is stored locally.'
      ]}
    ],
    helpTitle: 'How to Use',
    highlight: 'Highlight',
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
    providerApiKeyHint: 'The API key stays on this device; the desktop app stores it encrypted and never uploads it. Leave it blank later to keep the saved key.',
    providerApiKeyPlaceholder: 'Paste your API key; it stays on this device',
    providerBaseUrl: 'Base URL',
    providerBaseUrlPlaceholder: 'For example, https://api.example.com/v1',
    providerConfigured: 'Model provider configured',
    providerMissing: 'Model provider not configured',
    providerModel: 'Model',
    providerModelPlaceholder: 'For example, gpt-4o-mini or your school model',
    providerSaved: 'Model provider settings saved.',
    providerSwitched: 'Model provider switched.',
    providerProfiles: 'Saved model providers',
    providerProfilesEmpty: 'Saved model providers will appear here for quick switching.',
    providerUseDefault: 'Use current model',
    providerUseForSummary: 'Summary model',
    providerUseForTranslation: 'Translation model',
    providerSettings: 'Model Provider',
    providerSetupCta: 'Configure model',
    providerSetupPrompt: 'Set up a model provider before reading so summary, translation, and usage records are ready.',
    providerRequiredAction: 'Configure a model provider before using summary or translation.',
    providerTest: 'Test connection',
    providerTestFailed: 'Connection failed. Check Base URL, Model, and API Key.',
    providerTestSucceeded: 'Connection succeeded.',
    read: 'Read',
    readTooltip: 'This article is read. Click to mark it unread.',
    readingSettings: 'Reading Settings',
    refresh: 'Refresh',
    refreshUsage: 'Refresh model usage statistics.',
    regenerate: 'Regenerate',
    retranslate: 'Retranslate',
    useProvider: 'Use',
    currentProvider: 'Current',
    save: 'Save',
    saving: 'Saving',
    saveProvider: 'Save model settings',
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
    summaryModel: 'Summary Model',
    summaryShownInBody: 'The summary is ready here for review or copying.',
    summaryTooltip: 'Generate a summary for the current article.',
    summaryHint: 'Generate a summary for the current article.',
    summarizing: 'Summarizing',
    syncFeeds: 'Sync feeds',
    syncHelp: 'Leave empty to sync default real feeds, or paste an RSS/Atom URL to sync only that feed.',
    syncing: 'Syncing',
    tagFilterAll: 'All tags',
    targetLanguage: 'Target language',
    theme: 'Theme',
    themeGreen: 'Green',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeLuting: 'Reed Snow',
    themeYuanshan: 'Mountain',
    themeTaozhi: 'Peach',
    themeChuangsha: 'Lavender',
    themeTaowan: 'Wine',
    themeShulin: 'Tea',
    themeXiuri: 'Sunset',
    themeXinglin: 'Apricot',
    themeXuejin: 'Frost',
    tokens: 'tokens',
    translate: 'Translate',
    translateTooltip: 'Translate the current article to the target language.',
    translating: 'Translating',
    translationModel: 'Translation Model',
    translationShownInBody: 'The translation is ready here for review or copying.',
    translationHint: 'Translate the current article content.',
    bilingualOn: 'Bilingual: On',
    bilingualOff: 'Bilingual: Off',
    addSummaryToNotes: 'Add summary to notes',
    summaryAlreadyAdded: 'Already added',
    notes: 'Notes',
    noteInput: 'Enter a note...',
    addNote: 'Add note',
    underline: 'Underline',
    addToNotes: 'Add to notes',
    translateSelection: 'Translate',
    addTranslationToNotes: 'Add original & translation to notes',
    noNotes: 'No notes yet. Select text to add highlights or notes.',
    unread: 'Unread',
    unreadTooltip: 'Mark this article as read.',
    usage: 'Usage',
    usageTooltip: 'View model call statistics for summary and translation.',
    usageRecords: 'Usage records',
    history: 'History',
    noHistory: 'No history yet.',
    restoreHistory: 'Restore this result',
    deleteHistory: 'Delete',
    historyTime: 'Time',
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

const agentProgressCopy = {
  zh: {
    elapsed: '已等待',
    estimatedInput: '输入约',
    nonStreamingHint: '当前模型正在生成，支持的模型会尽快返回结果。',
    preparing: '正在准备文章内容和 Prompt',
    requesting: '正在连接模型服务',
    generating: '模型正在生成，请稍等',
    saving: '正在保存结果和用量记录',
    succeeded: '生成完成',
    failed: '生成失败'
  },
  en: {
    elapsed: 'Elapsed',
    estimatedInput: 'Input about',
    nonStreamingHint: 'The model is generating now; supported providers will return as soon as possible.',
    preparing: 'Preparing article content and prompt',
    requesting: 'Requesting the model provider',
    generating: 'The model is generating',
    saving: 'Saving result and usage record',
    succeeded: 'Completed',
    failed: 'Failed'
  }
} as const;

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
}, contentLoader?: (articleId: string) => Promise<ArticleContent | null>): Week2ReaderDataPort {
  return {
    async listFeeds() {
      return input.feeds;
    },

    async listArticles(query = {}) {
      return input.articles.filter((article) => matchesArticleQuery(article, query));
    },

    async getArticleContent(articleId: string) {
      return input.contents.find((content) => content.articleId === articleId) ?? contentLoader?.(articleId) ?? null;
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
  labels,
  progress,
  customTags,
  compact
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
  progress?: number;
  customTags?: string[];
  compact?: boolean;
}) {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const articleState = article as typeof article & { isRead?: boolean; isStarred?: boolean };
  const isRead = Boolean(articleState.isRead ?? articleState.readState !== 'unread');
  const isStarred = Boolean(articleState.isStarred ?? articleState.readState === 'saved');

  const allTags = [
    ...article.tags.map(t => ({ label: t, custom: false })),
    ...(customTags ?? []).map(t => ({ label: t, custom: true }))
  ];
  const maxVisible = 3;
  const visibleTags = tagsExpanded ? allTags : allTags.slice(0, maxVisible);
  const hiddenCount = allTags.length - maxVisible;

  if (compact) {
    return (
      <button
        className={`article-row article-row-compact ${selected ? 'is-selected' : ''} ${isRead ? 'is-read' : 'is-unread'}`}
        type="button"
        title={article.title}
        onClick={onSelect}
      >
        <span className={`read-dot ${isRead ? 'read-dot-reading' : 'read-dot-unread'}`} />
        <span className="article-row-title">{article.title || article.url || '(Untitled)'}</span>
        {typeof progress === 'number' && progress > 0 ? (
          <span className="article-progress-bar" style={{ width: `${progress}%` }} />
        ) : null}
      </button>
    );
  }

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
      <span className="article-row-title">{article.title || article.url || '(Untitled)'}</span>
      <span className="article-row-excerpt">{article.excerpt}</span>
      {allTags.length > 0 ? (
        <span className="tag-list">
          {visibleTags.map((t) => (
            <span className={t.custom ? 'tag custom-tag' : 'tag'} key={`${t.custom ? 'c-' : ''}${t.label}`}>
              {t.label}
            </span>
          ))}
          {hiddenCount > 0 && !tagsExpanded ? (
            <span
              className="tag tag-more"
              role="button"
              title={`+${hiddenCount} more tags`}
              onClick={(e) => { e.stopPropagation(); setTagsExpanded(true); }}
            >
              +{hiddenCount}…
            </span>
          ) : null}
          {tagsExpanded && hiddenCount > 0 ? (
            <span
              className="tag tag-more"
              role="button"
              title="Collapse tags"
              onClick={(e) => { e.stopPropagation(); setTagsExpanded(false); }}
            >
              ‹
            </span>
          ) : null}
        </span>
      ) : null}
      {typeof progress === 'number' && progress > 0 ? (
        <span className="article-progress-bar" style={{ width: `${progress}%` }} />
      ) : null}
    </button>
  );
}

function StatusPill({ status }: { status: AgentRunStatus }) {
  return <span className={`agent-status agent-status-${status}`}>{agentStatusLabels[status]}</span>;
}

function AgentProgressCard({
  copy,
  elapsedMs,
  progress
}: {
  copy: (typeof agentProgressCopy)[UiLanguage];
  elapsedMs: number;
  progress: AgentProgressState;
}) {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const phaseText = copy[progress.phase];

  return (
    <div className={`agent-progress-card agent-progress-${progress.phase}`}>
      <div className="agent-progress-heading">
        {progress.phase === 'succeeded' ? (
          <CheckCircle2 size={16} aria-hidden="true" />
        ) : progress.phase === 'failed' ? (
          <CircleAlert size={16} aria-hidden="true" />
        ) : (
          <RefreshCw className="spin-icon" size={16} aria-hidden="true" />
        )}
        <span>{phaseText}</span>
      </div>
      <div className="agent-progress-meta">
        <span>
          {copy.elapsed} {elapsedSeconds}s
        </span>
        <span>
          {copy.estimatedInput} {formatTokenCount(progress.estimatedInputTokens)} tokens
        </span>
      </div>
      <strong className="agent-progress-article">{progress.articleTitle}</strong>
      <p>{copy.nonStreamingHint}</p>
    </div>
  );
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

function BilingualView({ original, translation }: { original: string; translation: string }) {
  // Split into paragraphs, filtering out headings (lines starting with #) from original for alignment
  const origLines = original.split(/\n\n+/).filter(p => p.trim());
  const transParagraphs = translation.split(/\n\n+/).filter(p => p.trim());

  // Separate headings from body paragraphs in original
  const origBlocks: Array<{ type: 'heading' | 'paragraph'; text: string }> = [];
  for (const line of origLines) {
    if (/^#{1,6}\s/.test(line.trim())) {
      origBlocks.push({ type: 'heading', text: line });
    } else {
      origBlocks.push({ type: 'paragraph', text: line });
    }
  }

  // Align translation only with body paragraphs (skip headings)
  const bodyParagraphs = origBlocks.filter(b => b.type === 'paragraph');
  let transIdx = 0;
  const blocks: ReactNode[] = [];

  for (let i = 0; i < origBlocks.length; i++) {
    const block = origBlocks[i];
    if (block.type === 'heading') {
      // Render heading without translation pair
      blocks.push(
        <div className="bilingual-block bilingual-heading" key={`bi-h-${i}`}>
          <MarkdownView markdown={block.text} />
        </div>
      );
    } else {
      // Body paragraph — pair with translation
      const bodyIdx = bodyParagraphs.indexOf(block);
      const trans = transParagraphs[bodyIdx] ?? transParagraphs[transIdx];
      blocks.push(
        <div className="bilingual-block" key={`bi-${i}`}>
          <p className="bilingual-original">{block.text}</p>
          {trans ? <p className="bilingual-translation">{trans}</p> : null}
        </div>
      );
      transIdx++;
    }
  }

  // Any remaining translation paragraphs
  for (let i = bodyParagraphs.length; i < transParagraphs.length; i++) {
    blocks.push(
      <div className="bilingual-block" key={`bi-extra-${i}`}>
        <p className="bilingual-translation">{transParagraphs[i]}</p>
      </div>
    );
  }

  return <div className="bilingual-view">{blocks}</div>;
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
  const [syncMessage, setSyncMessage] = useState('输入 Feed URL 后点击"同步订阅源"；也可以留空同步默认源。');
  const [opmlSummary, setOpmlSummary] = useState<{ importedCount: number; skippedCount: number; messages: string[] } | null>(
    null
  );
  const [summaryTargetLanguage, setSummaryTargetLanguage] = useState('zh-CN');
  const [summaryDetailLevel, setSummaryDetailLevel] = useState<Week3SummaryDetailLevel>('brief');
  const [summaryStatus, setSummaryStatus] = useState<AgentRunStatus>('idle');
  const [summaryResult, setSummaryResult] = useState<Week3SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryProgress, setSummaryProgress] = useState<AgentProgressState | null>(null);
  const [summaryAddedToNotes, setSummaryAddedToNotes] = useState(false);
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState('zh-CN');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [translationStatus, setTranslationStatus] = useState<AgentRunStatus>('idle');
  const [translationResult, setTranslationResult] = useState<Week3TranslationResult | null>(null);
  const [translationError, setTranslationError] = useState('');
  // Per-paragraph async translation state
  const [paragraphTranslations, setParagraphTranslations] = useState<Map<number, string>>(new Map());
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [paragraphTranslationProgress, setParagraphTranslationProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
  const [translationProgress, setTranslationProgress] = useState<AgentProgressState | null>(null);
  const translationAbortRef = useRef<AbortController | null>(null);
  const [usageEvents, setUsageEvents] = useState<LLMUsageEvent[]>([]);
  const [usageStatus, setUsageStatus] = useState<UsageStatus>('idle');
  const [providerBaseUrl, setProviderBaseUrl] = useState('');
  const [providerModel, setProviderModel] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [providerProfiles, setProviderProfiles] = useState<Week3LLMProviderConfig[]>([]);
  const [summaryProviderProfileKey, setSummaryProviderProfileKey] = useState(() =>
    loadProviderProfileKey(SUMMARY_PROVIDER_PROFILE_KEY)
  );
  const [translationProviderProfileKey, setTranslationProviderProfileKey] = useState(() =>
    loadProviderProfileKey(TRANSLATION_PROVIDER_PROFILE_KEY)
  );
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('idle');
  const [providerMessage, setProviderMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  // Default widths: calculate 1/5 of viewport for feeds on first load
  const [feedsWidth, setFeedsWidth] = useState(() => Math.max(240, Math.round(window.innerWidth / 5)));
  const [articlesWidth, setArticlesWidth] = useState(() => Math.max(280, Math.round(window.innerWidth / 5)));
  const [aiWidth, setAiWidth] = useState(() => Math.max(280, Math.round(window.innerWidth / 5)));
  const resizeRef = useRef<{ panel: 'feeds' | 'articles' | 'ai'; startX: number; startWidth: number } | null>(null);
  const [agentProgressNow, setAgentProgressNow] = useState(Date.now());

  // Feature 4: Theme
  const [theme, setTheme] = useState<ThemeSetting>(() => {
    const saved = localStorage.getItem('mercury-theme');
    const valid: ThemeSetting[] = ['green', 'light', 'dark', 'luting', 'yuanshan', 'taozhi', 'chuangsha', 'taowan', 'shulin', 'xiuri', 'xinglin', 'xuejin'];
    return valid.includes(saved as ThemeSetting) ? (saved as ThemeSetting) : 'luting';
  });

  // Feature 7: Reading progress
  const [readingProgress, setReadingProgress] = useState<Map<string, number>>(() => loadReadingProgress());
  const readerGridRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const prevArticleIdRef = useRef<string>('');

  // Feature 8: Article tagging and filtering
  const [articleTags, setArticleTags] = useState<Record<string, string[]>>(() => loadArticleTags());
  const [articleFilter, setArticleFilter] = useState<ArticleFilterType>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [articleViewMode, setArticleViewMode] = useState<'compact' | 'detail'>('detail');

  // Feature 6: Bilingual mode toggle
  const [bilingualMode, setBilingualMode] = useState(true);

  // Feature 9: Highlighting and Notes
  const [highlights, setHighlights] = useState<Record<string, HighlightEntry[]>>(() => loadHighlights());
  const [highlightPopup, setHighlightPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [articleNotes, setArticleNotes] = useState<Record<string, NoteEntry[]>>(() => loadNotes());
  const [noteInput, setNoteInput] = useState('');
  const [annotationNoteMode, setAnnotationNoteMode] = useState(false);
  const [annotationNoteText, setAnnotationNoteText] = useState('');
  const [inlineTranslation, setInlineTranslation] = useState<{ text: string; translation: string; loading: boolean } | null>(null);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null);

  // AI history per article
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Toast notification system
  const [toasts, setToasts] = useState<{ id: number; message: string; status: string }[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((message: string, status: string = 'succeeded') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, status }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Save theme to localStorage on change
  useEffect(() => {
    localStorage.setItem('mercury-theme', theme);
  }, [theme]);

  // Save scroll position when switching away from an article
  useEffect(() => {
    const el = readerGridRef.current;
    if (prevArticleIdRef.current && el) {
      scrollPositionsRef.current.set(prevArticleIdRef.current, el.scrollTop);
    }
    prevArticleIdRef.current = selectedArticleId;
    // Clear per-paragraph translations when switching articles
    setParagraphTranslations(new Map());
    setTranslatedTitle('');
    setParagraphTranslationProgress({ total: 0, completed: 0 });
    // Load AI history for this article
    setAiHistory(selectedArticleId ? loadAiHistory(selectedArticleId) : []);
    setShowHistory(false);
  }, [selectedArticleId]);

  // Restore scroll position once content is ready
  useEffect(() => {
    if (contentStatus !== 'ready' || !selectedArticleId) return;
    const el = readerGridRef.current;
    if (!el) return;
    const saved = scrollPositionsRef.current.get(selectedArticleId) ?? 0;
    // Use double-rAF to ensure DOM has painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = saved;
        // If content fits without scrolling, mark as 100% read
        if (el.scrollHeight <= el.clientHeight) {
          setReadingProgress((prev) => {
            const next = new Map(prev);
            next.set(selectedArticleId, 100);
            saveReadingProgress(next);
            return next;
          });
        }
      });
    });
  }, [contentStatus, selectedArticleId]);

  useEffect(() => {
    const config = loadReaderLLMProviderConfig();
    setProviderConfigured(Boolean(config));
    if (config) {
      setProviderBaseUrl(config.baseUrl);
      setProviderModel(config.model);
    }
    setProviderProfiles(loadReaderLLMProviderProfiles());
  }, []);

  useEffect(() => {
    if (summaryStatus !== 'running' && translationStatus !== 'running') {
      return;
    }

    setAgentProgressNow(Date.now());
    const timer = window.setInterval(() => {
      setAgentProgressNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [summaryStatus, translationStatus]);

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
    setSummaryProgress(null);
    setTranslationStatus('idle');
    setTranslationResult(null);
    setTranslationError('');
    setTranslationProgress(null);
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
      const delta = panel === 'ai' ? startX - e.clientX : e.clientX - startX;
      const minW = panel === 'feeds' ? 240 : 200;
      const newWidth = Math.max(minW, Math.min(600, startWidth + delta));
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

  // Feature 7: Reading progress scroll handler
  const handleReaderScroll = useCallback(() => {
    // Dismiss annotation popup and inline translation on scroll
    setHighlightPopup(null);
    setInlineTranslation(null);
    setAnnotationNoteMode(false);
    setAnnotationNoteText('');
    window.getSelection()?.removeAllRanges();

    if (!readerGridRef.current || !selectedArticleId) return;
    const el = readerGridRef.current;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight - el.clientHeight;
    // If content fits without scrolling, it's fully visible → 100%
    const progress = scrollHeight <= 0 ? 100 : Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
    setReadingProgress((prev) => {
      const next = new Map(prev);
      next.set(selectedArticleId, progress);
      saveReadingProgress(next);
      return next;
    });
  }, [selectedArticleId]);

  // Feature 9: Handle text selection for highlighting
  const handleReaderMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selectedArticleId) {
      setHighlightPopup(null);
      setInlineTranslation(null);
      setAnnotationNoteMode(false);
      setAnnotationNoteText('');
      return;
    }
    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setHighlightPopup(null);
      setAnnotationNoteMode(false);
      setAnnotationNoteText('');
      setInlineTranslation(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    // Clear previous inline translation when selecting new text
    setInlineTranslation(null);
    setAnnotationNoteMode(false);
    setAnnotationNoteText('');
    // Clamp popup position within viewport
    const popupWidth = 240; // approximate popup width
    const popupHeight = 60; // approximate popup height
    let px = rect.left + rect.width / 2;
    let py = rect.top - 10;
    // Horizontal: keep popup centered but within viewport
    px = Math.max(popupWidth / 2 + 8, Math.min(window.innerWidth - popupWidth / 2 - 8, px));
    // Vertical: if too close to top, show below the selection instead
    if (py < popupHeight + 8) {
      py = rect.bottom + 10;
    }
    setHighlightPopup({
      x: px,
      y: py,
      text
    });
  }, [selectedArticleId]);

  const addAnnotation = useCallback((annotationType: AnnotationType) => {
    if (!highlightPopup || !selectedArticleId) return;
    setHighlights((prev) => {
      const next = { ...prev };
      const existing = next[selectedArticleId] || [];
      next[selectedArticleId] = [...existing, { text: highlightPopup.text, color: selectedColor, type: annotationType }];
      saveHighlights(next);
      return next;
    });
    setHighlightPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [highlightPopup, selectedArticleId, selectedColor]);

  // Add selected text with an annotation note
  const addTextToNotes = useCallback((text: string, annotation?: string) => {
    if (!selectedArticleId || !text.trim()) return;
    // Check for duplicate: same text already exists
    const existing = articleNotes[selectedArticleId] || [];
    if (existing.some(n => n.text === text && !annotation)) return;
    setArticleNotes((prev) => {
      const next = { ...prev };
      const list = next[selectedArticleId] || [];
      next[selectedArticleId] = [...list, { id: `n-${Date.now()}`, text, note: annotation || '', createdAt: new Date().toISOString() }];
      saveNotes(next);
      return next;
    });
    setHighlightPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedArticleId, articleNotes]);

  const addFreeNote = useCallback((note: string) => {
    if (!selectedArticleId || !note.trim()) return;
    setArticleNotes((prev) => {
      const next = { ...prev };
      const existing = next[selectedArticleId] || [];
      next[selectedArticleId] = [...existing, { id: `n-${Date.now()}`, text: '', note, createdAt: new Date().toISOString() }];
      saveNotes(next);
      return next;
    });
    setNoteInput('');
  }, [selectedArticleId]);

  const deleteNote = useCallback((noteId: string) => {
    if (!selectedArticleId) return;
    setArticleNotes((prev) => {
      const next = { ...prev };
      next[selectedArticleId] = (next[selectedArticleId] || []).filter(n => n.id !== noteId);
      saveNotes(next);
      return next;
    });
  }, [selectedArticleId]);

  // Feature 9: Apply highlights to content
  const applyHighlightsToHtml = useCallback((html: string, articleId: string): string => {
    const articleHighlights = highlights[articleId];
    if (!articleHighlights || articleHighlights.length === 0) return html;
    let result = html;
    for (const hl of articleHighlights) {
      const escapedText = hl.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const className = hl.type === 'underline' ? 'reader-underline' : 'reader-highlight';
      const style = hl.type === 'underline'
        ? `border-bottom:2px solid ${hl.color};padding-bottom:1px`
        : `background:${hl.color}`;
      // Use DOMParser for robust text matching (handles entities, whitespace, nested tags)
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${result}</body>`, 'text/html');
      const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      for (const tNode of textNodes) {
        const idx = tNode.textContent?.indexOf(hl.text) ?? -1;
        if (idx === -1) continue;
        const before = tNode.splitText(idx);
        const after = before.splitText(hl.text.length);
        const mark = doc.createElement('mark');
        mark.className = className;
        mark.setAttribute('style', style);
        mark.textContent = before.textContent;
        before.parentNode?.replaceChild(mark, before);
        void after; // keep rest of text
        break; // only first occurrence per highlight
      }
      result = doc.body.innerHTML;
    }
    return result;
  }, [highlights]);

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
  const currentAgentProgress = activePanel === 'summary' ? summaryProgress : translationProgress;
  const currentAgentProgressElapsed = currentAgentProgress
    ? agentProgressNow - currentAgentProgress.startedAt
    : 0;

  // Feature 8: Compute all unique custom tags for filter dropdown
  const allCustomTags = useMemo(() => {
    const tagSet = new Set<string>();
    Object.values(articleTags).forEach(tags => tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [articleTags]);

  // Feature 8: Filter articles
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const articleState = article as typeof article & { isRead?: boolean; isStarred?: boolean };
      const isRead = Boolean(articleState.isRead ?? articleState.readState !== 'unread');
      const isStarred = Boolean(articleState.isStarred ?? articleState.readState === 'saved');

      if (articleFilter === 'unread' && isRead) return false;
      if (articleFilter === 'read' && !isRead) return false;
      if (articleFilter === 'saved' && !isStarred) return false;

      if (tagFilter) {
        const custom = articleTags[article.id] || [];
        const allTags = [...article.tags, ...custom];
        if (!allTags.includes(tagFilter)) return false;
      }

      return true;
    });
  }, [articles, articleFilter, tagFilter, articleTags]);

  // Feature 6: Bilingual view check
  const showBilingualView = Boolean(
    bilingualMode &&
    selectedContent?.cleanedHtml &&
    paragraphTranslations.size > 0
  );

  const shellClassName = [
    'app-shell',
    `theme-${theme}`,
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
      contentId: selectedContent.articleId,
      title: selectedArticle.title,
      sourceUrl: selectedArticle.url,
      feedTitle: feedTitleById.get(selectedArticle.feedId),
      author: selectedArticle.author,
      publishedAt: selectedArticle.publishedAt,
      canonicalMarkdown: selectedContent.canonicalMarkdown
    };
  }

  function estimateInputTokens(markdown: string) {
    return Math.max(1, Math.ceil(markdown.trim().length / 3));
  }

  function createAgentProgress(articleTitle: string, canonicalMarkdown: string): AgentProgressState {
    return {
      phase: 'preparing',
      startedAt: Date.now(),
      articleTitle,
      estimatedInputTokens: estimateInputTokens(canonicalMarkdown)
    };
  }

  function moveAgentProgressToGenerating(agentType: 'summary' | 'translation', startedAt: number) {
    const setProgress = agentType === 'summary' ? setSummaryProgress : setTranslationProgress;
    window.setTimeout(() => {
      setProgress((current) => {
        if (!current || current.startedAt !== startedAt || current.phase !== 'requesting') {
          return current;
        }
        return { ...current, phase: 'generating' };
      });
    }, 900);
  }

  async function handleGenerateSummary(regenerate = false) {
    openAiPanel('summary');

    if (!regenerate && currentSummaryMarkdown) {
      setSummaryStatus('succeeded');
      setSummaryError('');
      setSummaryProgress(null);
      return;
    }

    if (!ensureProviderConfigured('summary')) {
      return;
    }
    activateProviderForAgent('summary');

    setSummaryStatus('running');
    setSummaryError('');
    setSummaryAddedToNotes(false);
    let articleInput: ReturnType<typeof createSelectedArticleInput>;
    let progress: AgentProgressState;

    try {
      articleInput = createSelectedArticleInput();
      progress = createAgentProgress(articleInput.title, articleInput.canonicalMarkdown);
    } catch (error) {
      setSummaryStatus('failed');
      setSummaryError(error instanceof Error ? error.message : 'Summary generation failed.');
      setSummaryProgress(null);
      return;
    }

    setSummaryProgress(progress);
    setAgentProgressNow(Date.now());

    try {
      setSummaryProgress((current) =>
        current?.startedAt === progress.startedAt ? { ...current, phase: 'requesting' } : current
      );
      moveAgentProgressToGenerating('summary', progress.startedAt);
      const request = {
        ...articleInput,
        targetLanguage: summaryTargetLanguage,
        detailLevel: summaryDetailLevel,
        regenerate
      };
      let streamedMarkdown = '';
      const provisionalResult: Week3SummaryResult = {
        id: `summary-stream-${Date.now()}`,
        articleId: articleInput.articleId,
        contentId: articleInput.contentId,
        taskId: `summary-stream-${Date.now()}`,
        targetLanguage: summaryTargetLanguage,
        detailLevel: summaryDetailLevel,
        markdown: '',
        providerId: 'school',
        providerName: 'School Model',
        model: loadReaderLLMProviderConfig()?.model ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setSummaryResult(provisionalResult);

      const result = agentUiPort.streamSummary
        ? await agentUiPort.streamSummary(request, (delta) => {
            streamedMarkdown += delta;
            setSummaryResult((current) =>
              current?.id === provisionalResult.id
                ? { ...current, markdown: streamedMarkdown, updatedAt: new Date().toISOString() }
                : current
            );
          })
        : await agentUiPort.generateSummary(request);
      setSummaryProgress((current) =>
        current?.startedAt === progress.startedAt ? { ...current, phase: 'saving' } : current
      );
      setSummaryResult(result);
      setSummaryStatus('succeeded');
      // Save to history
      if (selectedArticleId) {
        const entry: AiHistoryEntry = {
          id: `h-${Date.now()}`,
          type: 'summary',
          markdown: result.markdown,
          targetLanguage: summaryTargetLanguage,
          detailLevel: summaryDetailLevel,
          providerName: result.providerName,
          model: result.model,
          createdAt: new Date().toISOString()
        };
        const updated = [entry, ...loadAiHistory(selectedArticleId)];
        saveAiHistory(selectedArticleId, updated);
        setAiHistory(updated.slice(0, 20));
      }
      await refreshUsageEvents();
      setSummaryProgress((current) =>
        current?.startedAt === progress.startedAt ? { ...current, phase: 'succeeded' } : current
      );
    } catch (error) {
      setSummaryStatus('failed');
      setSummaryError(error instanceof Error ? error.message : 'Summary generation failed.');
      await refreshUsageEvents();
      setSummaryProgress((current) =>
        current?.startedAt === progress.startedAt ? { ...current, phase: 'failed' } : current
      );
    }
  }

  async function handleTranslateArticle(regenerate = false) {
    openAiPanel('translation');

    if (!regenerate && currentTranslationMarkdown) {
      setTranslationStatus('succeeded');
      setTranslationError('');
      setTranslationProgress(null);
      return;
    }

    if (!ensureProviderConfigured('translation')) {
      return;
    }
    activateProviderForAgent('translation');

    if (!selectedContent?.cleanedHtml || !selectedArticle) return;

    // Abort any running translation
    translationAbortRef.current?.abort();
    const abortController = new AbortController();
    translationAbortRef.current = abortController;

    setTranslationStatus('running');
    setTranslationError('');
    setParagraphTranslations(new Map());
    setTranslatedTitle('');
    const articleProgress = createAgentProgress(selectedArticle.title, selectedContent.canonicalMarkdown);
    setTranslationProgress(articleProgress);
    setAgentProgressNow(Date.now());

    const targetLang = translationTargetLanguage;
    const srcLang = sourceLanguage === 'auto' ? undefined : sourceLanguage;

    try {
      setTranslationProgress((current) =>
        current?.startedAt === articleProgress.startedAt ? { ...current, phase: 'requesting' } : current
      );
      moveAgentProgressToGenerating('translation', articleProgress.startedAt);
      // Parse HTML to extract translatable paragraphs
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${selectedContent.cleanedHtml}</div>`, 'text/html');
      const container = doc.body.firstElementChild;
      if (!container) throw new Error('Failed to parse article content.');

      const blockSelector = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, td, th, figcaption, dt, dd, summary, caption';
      // Use descendant selector to capture nested paragraphs (e.g. inside <div>, <section>)
      // Then filter out nested duplicates (e.g. <li> inside <blockquote>)
      const allBlocks = Array.from(container.querySelectorAll(blockSelector));
      const blocks = allBlocks.filter(block => {
        // Skip blocks whose parent is also a translatable block (avoid duplicate translation)
        let parent = block.parentElement;
        while (parent && parent !== container) {
          if (parent.matches(blockSelector)) return false;
          parent = parent.parentElement;
        }
        return true;
      });

      // Also collect top-level text nodes in wrapper divs that have no block children
      // (some articles wrap text in <div> without <p> tags)
      const leafDivs = Array.from(container.querySelectorAll('div, section, article'))
        .filter(div => {
          // Only include if it has no block-level children and has direct text
          if (div.querySelector(blockSelector)) return false;
          const text = div.textContent?.trim() ?? '';
          return text.length > 0;
        });
      const allTranslatableElements = [...blocks, ...leafDivs];

      // Filter: skip pure code blocks and empty blocks
      const translatableBlocks: { el: Element; index: number; text: string }[] = [];
      allTranslatableElements.forEach((block, i) => {
        const tag = block.tagName;
        // Skip <pre> and <code> blocks (pure code), but NOT paragraphs that contain inline <code>
        if (tag === 'PRE' || tag === 'CODE') return;
        // Skip blocks that are entirely a code block (e.g. <p><pre>...</pre></p>)
        if (block.children.length === 1 && block.children[0].tagName === 'PRE') return;
        const text = block.textContent?.trim() ?? '';
        // Skip empty content
        if (!text) return;
        translatableBlocks.push({ el: block, index: i, text });
      });

      const total = translatableBlocks.length + 1; // +1 for title
      setParagraphTranslationProgress({ total, completed: 0 });
      const localTranslations = new Map<number, string>();
      let localTitle = '';
      const currentConfig = loadReaderLLMProviderConfig();
      const provisionalTranslationId = `translation-stream-${Date.now()}`;
      const updateStreamingTranslationResult = (markdown: string) => {
        setTranslationResult({
          id: provisionalTranslationId,
          articleId: selectedArticle.id,
          taskId: provisionalTranslationId,
          targetLanguage: targetLang,
          sourceLanguage: srcLang,
          markdown,
          providerId: currentConfig?.providerId ?? 'school',
          providerName: currentConfig?.providerName ?? 'School Model',
          model: currentConfig?.model ?? '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      };
      const buildCombinedMarkdown = () => {
        const allTranslations = Array.from(localTranslations.values());
        return (localTitle ? `# ${localTitle}\n\n` : '') + allTranslations.join('\n\n');
      };

      // Translate title first
      if (agentUiPort.translateText && selectedArticle.title) {
        let titleStream = '';
        const titleTranslation = agentUiPort.streamText
          ? await agentUiPort.streamText(selectedArticle.title, targetLang, srcLang, (delta) => {
              titleStream += delta;
              localTitle = titleStream.trim();
              setTranslatedTitle(localTitle);
              updateStreamingTranslationResult(buildCombinedMarkdown());
            })
          : await agentUiPort.translateText(selectedArticle.title, targetLang, srcLang);
        if (abortController.signal.aborted) return;
        localTitle = titleTranslation.trim();
        setTranslatedTitle(localTitle);
        updateStreamingTranslationResult(buildCombinedMarkdown());
        setParagraphTranslationProgress({ total, completed: 1 });
      } else {
        setParagraphTranslationProgress({ total, completed: 1 });
      }

      // Translate each paragraph sequentially
      for (let i = 0; i < translatableBlocks.length; i++) {
        if (abortController.signal.aborted) return;
        const { index, text } = translatableBlocks[i];
        try {
          if (agentUiPort.translateText) {
            let paragraphStream = '';
            const translation = agentUiPort.streamText
              ? await agentUiPort.streamText(text, targetLang, srcLang, (delta) => {
                  paragraphStream += delta;
                  localTranslations.set(index, paragraphStream.trim());
                  setParagraphTranslations(new Map(localTranslations));
                  updateStreamingTranslationResult(buildCombinedMarkdown());
                })
              : await agentUiPort.translateText(text, targetLang, srcLang);
            if (abortController.signal.aborted) return;
            localTranslations.set(index, translation.trim());
            setParagraphTranslations(new Map(localTranslations));
            updateStreamingTranslationResult(buildCombinedMarkdown());
          }
        } catch {
          // Skip failed paragraph, continue with others
        }
        setParagraphTranslationProgress({ total, completed: i + 2 }); // +2: 1 for title + (i+1) paragraphs
      }

      if (abortController.signal.aborted) return;

      // Build final combined markdown for compatibility with existing code (export, copy)
      setTranslationProgress((current) =>
        current?.startedAt === articleProgress.startedAt ? { ...current, phase: 'saving' } : current
      );
      const combinedMarkdown = buildCombinedMarkdown();
      setTranslationResult({
        id: `translation-result-${Date.now()}`,
        articleId: selectedArticle.id,
        taskId: `async-translation-${Date.now()}`,
        targetLanguage: targetLang,
        sourceLanguage: srcLang,
        markdown: combinedMarkdown,
        providerId: currentConfig?.providerId ?? 'school',
        providerName: currentConfig?.providerName ?? 'School Model',
        model: currentConfig?.model ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setTranslationStatus('succeeded');
      // Save to history
      if (selectedArticle.id) {
        const entry: AiHistoryEntry = {
          id: `h-${Date.now()}`,
          type: 'translation',
          markdown: combinedMarkdown,
          targetLanguage: targetLang,
          sourceLanguage: srcLang,
          providerName: currentConfig?.providerName ?? 'School Model',
          model: currentConfig?.model ?? '',
          createdAt: new Date().toISOString()
        };
        const updated = [entry, ...loadAiHistory(selectedArticle.id)];
        saveAiHistory(selectedArticle.id, updated);
        setAiHistory(updated.slice(0, 20));
      }
      await refreshUsageEvents();
      setTranslationProgress((current) =>
        current?.startedAt === articleProgress.startedAt ? { ...current, phase: 'succeeded' } : current
      );
    } catch (error) {
      if (abortController.signal.aborted) return;
      setTranslationStatus('failed');
      setTranslationError(error instanceof Error ? error.message : 'Translation failed.');
      await refreshUsageEvents();
      setTranslationProgress((current) =>
        current?.startedAt === articleProgress.startedAt ? { ...current, phase: 'failed' } : current
      );
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

  function handleOpenSummaryFromToolbar() {
    openAiPanel('summary');
    if (!hasCanonicalMarkdown || currentSummaryMarkdown || summaryStatus === 'running') {
      return;
    }
    void handleGenerateSummary(false);
  }

  function handleOpenTranslationFromToolbar() {
    openAiPanel('translation');
    if (!hasCanonicalMarkdown || currentTranslationMarkdown || translationStatus === 'running') {
      return;
    }
    void handleTranslateArticle(false);
  }

  function refreshProviderProfiles() {
    const profiles = loadReaderLLMProviderProfiles();
    setProviderProfiles(profiles);
    const profileKeys = new Set(profiles.map(providerProfileKey));

    if (summaryProviderProfileKey && !profileKeys.has(summaryProviderProfileKey)) {
      setSummaryProviderProfileKey('');
      saveProviderProfileKey(SUMMARY_PROVIDER_PROFILE_KEY, '');
    }

    if (translationProviderProfileKey && !profileKeys.has(translationProviderProfileKey)) {
      setTranslationProviderProfileKey('');
      saveProviderProfileKey(TRANSLATION_PROVIDER_PROFILE_KEY, '');
    }
  }

  function handleUseProviderProfile(profile: Week3LLMProviderConfig) {
    const config = activateReaderLLMProviderProfile(profile);
    setProviderBaseUrl(config.baseUrl);
    setProviderModel(config.model);
    setProviderApiKey('');
    setProviderConfigured(true);
    setAgentUiPort(createBrowserWeek3AgentUiPort());
    refreshProviderProfiles();
    setProviderStatus('succeeded');
    setProviderMessage(`${copy.providerSwitched} ${config.model}`);
  }

  function handleDeleteProviderProfile(profile: Week3LLMProviderConfig) {
    const deletedKey = providerProfileKey(profile);
    const nextCurrent = deleteReaderLLMProviderProfile(profile);

    if (summaryProviderProfileKey === deletedKey) {
      setSummaryProviderProfileKey('');
      saveProviderProfileKey(SUMMARY_PROVIDER_PROFILE_KEY, '');
    }

    if (translationProviderProfileKey === deletedKey) {
      setTranslationProviderProfileKey('');
      saveProviderProfileKey(TRANSLATION_PROVIDER_PROFILE_KEY, '');
    }

    if (nextCurrent) {
      setProviderBaseUrl(nextCurrent.baseUrl);
      setProviderModel(nextCurrent.model);
      setProviderConfigured(true);
    } else {
      setProviderBaseUrl('');
      setProviderModel('');
      setProviderConfigured(false);
    }

    setProviderApiKey('');
    setAgentUiPort(createBrowserWeek3AgentUiPort());
    refreshProviderProfiles();
    setProviderStatus('succeeded');
    setProviderMessage(uiLanguage === 'zh' ? '模型配置已删除。' : 'Model provider deleted.');
  }

  function activateProviderForAgent(agentType: 'summary' | 'translation') {
    const desiredKey = agentType === 'summary' ? summaryProviderProfileKey : translationProviderProfileKey;
    if (!desiredKey) {
      return;
    }

    const profile = loadReaderLLMProviderProfiles().find((item) => providerProfileKey(item) === desiredKey);
    if (!profile) {
      return;
    }

    const current = loadReaderLLMProviderConfig();
    if (current && providerProfileKey(current) === desiredKey) {
      return;
    }

    const config = activateReaderLLMProviderProfile(profile);
    setProviderBaseUrl(config.baseUrl);
    setProviderModel(config.model);
    setProviderApiKey('');
    setProviderConfigured(true);
    setAgentUiPort(createBrowserWeek3AgentUiPort());
    refreshProviderProfiles();
  }

  function handleAgentProviderSelection(agentType: 'summary' | 'translation', key: string) {
    if (agentType === 'summary') {
      setSummaryProviderProfileKey(key);
      saveProviderProfileKey(SUMMARY_PROVIDER_PROFILE_KEY, key);
    } else {
      setTranslationProviderProfileKey(key);
      saveProviderProfileKey(TRANSLATION_PROVIDER_PROFILE_KEY, key);
    }
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
      refreshProviderProfiles();
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
        refreshProviderProfiles();
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

  // Feature 8: Add tag to current article
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestionIndex, setTagSuggestionIndex] = useState(-1);

  // Compute tag suggestions: filter existing tags by input, exclude already-applied tags
  const tagSuggestions = useMemo(() => {
    if (!selectedArticleId) return [];
    const currentTags = articleTags[selectedArticleId] || [];
    const query = tagInput.trim().toLowerCase();
    return allCustomTags
      .filter(t => (!query || t.toLowerCase().includes(query)) && !currentTags.includes(t))
      .slice(0, 8);
  }, [tagInput, allCustomTags, articleTags, selectedArticleId]);

  function handleAddTag() {
    if (!selectedArticleId) return;
    setShowTagInput((v) => !v);
    setTagInput('');
    setTagSuggestionIndex(-1);
  }

  function handleApplyTag(tag: string) {
    if (!selectedArticleId || !tag.trim()) return;
    setArticleTags((prev) => {
      const next = { ...prev };
      const existing = next[selectedArticleId] || [];
      if (!existing.includes(tag.trim())) {
        next[selectedArticleId] = [...existing, tag.trim()];
      }
      saveArticleTags(next);
      return next;
    });
    setTagInput('');
    setTagSuggestionIndex(-1);
  }

  function handleSubmitTag() {
    // If a suggestion is highlighted, use that
    if (tagSuggestionIndex >= 0 && tagSuggestionIndex < tagSuggestions.length) {
      handleApplyTag(tagSuggestions[tagSuggestionIndex]);
      return;
    }
    if (!tagInput.trim()) return;
    handleApplyTag(tagInput.trim());
    setShowTagInput(false);
  }

  function handleRemoveTag(articleId: string, tag: string) {
    setArticleTags((prev) => {
      const next = { ...prev };
      next[articleId] = (next[articleId] || []).filter(t => t !== tag);
      if (next[articleId].length === 0) delete next[articleId];
      saveArticleTags(next);
      return next;
    });
  }

  function handleDeleteTagGlobally(tag: string) {
    setArticleTags((prev) => {
      const next: Record<string, string[]> = {};
      for (const [aid, tags] of Object.entries(prev)) {
        const filtered = tags.filter(t => t !== tag);
        if (filtered.length > 0) next[aid] = filtered;
      }
      saveArticleTags(next);
      return next;
    });
    // Clear filter if the deleted tag was the active filter
    if (tagFilter === tag) setTagFilter('');
  }

  function applySyncPayload(payload: Awaited<ReturnType<NonNullable<typeof runtime>['runWeek2Sync']>>) {
    const nextDataPort = createSnapshotReaderDataPort(payload, runtime?.getArticleContent);
    const nextFeedId = payload.feeds.some((feed) => feed.id === selectedFeedId) ? selectedFeedId : payload.feeds[0]?.id ?? '';
    const nextArticles = payload.articles.filter((article) => !nextFeedId || article.feedId === nextFeedId);
    const nextArticleId = nextArticles.some((article) => article.id === selectedArticleId)
      ? selectedArticleId
      : nextArticles[0]?.id ?? payload.articles[0]?.id ?? '';
    const nextContent =
      payload.contents.find((content) => content.articleId === nextArticleId) ??
      (nextArticleId === selectedArticleId ? selectedContent : null);

    setDataPort(() => nextDataPort);
    setSearchText('');
    setFeeds(payload.feeds);
    setArticles(nextArticles);
    setSelectedFeedId(nextFeedId);
    setSelectedArticleId(nextArticleId);
    setSelectedContent(nextContent);
    setFeedsStatus('ready');
    setArticlesStatus('ready');
    setContentStatus(nextContent?.cleanedHtml && nextContent.canonicalMarkdown ? 'ready' : nextArticleId ? 'loading' : 'empty');
    const resultStatus = payload.result.status === 'failed' ? 'failed' : 'succeeded';
    setSyncStatus(resultStatus);
    setSyncMessage(copy.syncHelp);

    const opmlPart = payload.opml
      ? ` Imported ${payload.opml.importedCount} OPML feed(s), skipped ${payload.opml.skippedCount}. Click Sync feeds to fetch articles.`
      : '';
    const storagePart =
      payload.storage?.mode === 'sqlite'
        ? ' Stored in SQLite.'
        : payload.storage?.mode === 'json-fallback'
          ? ' Stored locally.'
          : '';
    showToast(
      payload.opml && payload.result.totalSubscriptions === 0
        ? `Imported ${payload.opml.importedCount} OPML feed(s), skipped ${payload.opml.skippedCount}. Click Sync feeds to fetch articles.${storagePart}`
        : `Synced ${payload.result.totalSubscriptions} feed(s), saved ${payload.result.totalSavedArticles} article(s).${opmlPart}${storagePart}`,
      resultStatus
    );
    setOpmlSummary(null);
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
    setSyncMessage(feedUrl ? `${copy.syncing} ${feedUrl}...` : `${copy.syncing} default feeds...`);
    setFeeds((currentFeeds) => currentFeeds.map((feed) => ({ ...feed, status: 'syncing' })));

    try {
      const payload = await runtime.runWeek2Sync(feedUrls);
      applySyncPayload(payload);
    } catch (error) {
      setSyncStatus('failed');
      setSyncMessage(copy.syncHelp);
      showToast(error instanceof Error ? error.message : 'Feed sync failed.', 'failed');
    }
  }

  async function handleImportOpmlFile(file?: File) {
    if (!file) return;

    if (!runtime?.importOpmlText && !runtime?.importOpmlFile) {
      setSyncStatus('failed');
      setSyncMessage('Open the Electron app to import OPML.');
      return;
    }

    setSyncStatus('running');
    setSyncMessage(`Importing ${file.name}...`);

    try {
      const electronFilePath = 'path' in file ? String((file as File & { path?: string }).path || '') : '';
      let receivedInitialPayload = false;
      const handleProgress = (progress: {
        phase: string;
        total: number;
        completed: number;
        importedCount: number;
        skippedCount: number;
        currentTitle?: string;
        feed?: Feed;
        message?: string;
        payload?: Awaited<ReturnType<NonNullable<typeof runtime>['runWeek2Sync']>>;
      }) => {
        if (progress.phase === 'feed-imported' && progress.feed) {
          setFeedsStatus('ready');
          setFeeds((currentFeeds) => {
            if (currentFeeds.some((feed) => feed.id === progress.feed!.id || feed.feedUrl === progress.feed!.feedUrl)) {
              return currentFeeds;
            }
            return [...currentFeeds, progress.feed!];
          });
          setSelectedFeedId((current) => current || progress.feed!.id);
          setSyncStatus('running');
          setSyncMessage(
            `Importing OPML feeds ${progress.completed}/${progress.total}${
              progress.currentTitle ? `: ${progress.currentTitle}` : ''
            }`
          );
          return;
        }

        if (progress.phase === 'imported' && progress.payload) {
          receivedInitialPayload = true;
          applySyncPayload(progress.payload);
          setSyncStatus(progress.total > 0 ? 'running' : 'succeeded');
          setSyncMessage(
            progress.total > 0
              ? `Imported ${progress.importedCount} feed(s). Syncing imported feeds 0/${progress.total} in background...`
              : `Imported ${progress.importedCount} feed(s), skipped ${progress.skippedCount}.`
          );
          return;
        }

        if (progress.phase === 'syncing' || progress.phase === 'feed-succeeded' || progress.phase === 'feed-failed') {
          if (progress.payload) {
            applySyncPayload(progress.payload);
          }
          setSyncStatus('running');
          setSyncMessage(
            `Syncing imported feeds ${progress.completed}/${progress.total}${
              progress.currentTitle ? `: ${progress.currentTitle}` : ''
            }`
          );
          return;
        }

        if (progress.phase === 'completed' && progress.payload) {
          applySyncPayload(progress.payload);
          setSyncStatus(progress.payload.result.status === 'failed' ? 'failed' : 'succeeded');
          setSyncMessage(copy.syncHelp);
          const allFeedsFailed =
            progress.total > 0 &&
            progress.payload.result.succeededCount === 0 &&
            progress.payload.result.totalSavedArticles === 0;
          showToast(
            allFeedsFailed
              ? 'OPML subscriptions were imported, but no articles were synced. The feed hosts may be unreachable on this network.'
              : `Finished OPML background sync: ${progress.payload.result.succeededCount}/${progress.total} feed(s), saved ${progress.payload.result.totalSavedArticles} article(s).`,
            progress.payload.result.status === 'failed' ? 'failed' : 'succeeded'
          );
        }
      };
      const payload =
        electronFilePath && runtime.importOpmlFile
          ? await runtime.importOpmlFile(electronFilePath, handleProgress)
          : await runtime.importOpmlText(await file.text(), handleProgress);

      if (!receivedInitialPayload) {
        applySyncPayload(payload);
      }
    } catch (error) {
      setSyncStatus('failed');
      setSyncMessage(copy.syncHelp);
      showToast(error instanceof Error ? error.message : 'OPML import failed.', 'failed');
    }
  }

  async function handleArticleStateChange(input: { isRead?: boolean; isStarred?: boolean }) {
    if (!selectedArticle || !runtime?.updateArticleState) return;

    try {
      const payload = await runtime.updateArticleState({ articleId: selectedArticle.id, ...input });
      applySyncPayload(payload);
    } catch (error) {
      setSyncStatus('failed');
      showToast(error instanceof Error ? error.message : 'Article state update failed.', 'failed');
    }
  }

  async function handleFeedSubscriptionChange(feed: Feed, input: { isEnabled?: boolean; isDeleted?: boolean }) {
    if (!runtime?.updateFeedSubscription) return;

    try {
      const payload = await runtime.updateFeedSubscription({ feedId: feed.id, ...input });
      applySyncPayload(payload);
      showToast(input.isDeleted ? `Deleted subscription: ${feed.title}` : `Updated subscription: ${feed.title}`, 'succeeded');
    } catch (error) {
      setSyncStatus('failed');
      showToast(error instanceof Error ? error.message : 'Subscription update failed.', 'failed');
    }
  }

  // Prepare highlighted HTML content
  const displayedHtml = useMemo(() => {
    if (!selectedContent?.cleanedHtml || !selectedArticleId) return '';
    return applyHighlightsToHtml(selectedContent.cleanedHtml, selectedArticleId);
  }, [selectedContent, selectedArticleId, applyHighlightsToHtml]);

  // Bilingual HTML: inject translations after each block element in the original HTML
  const bilingualHtml = useMemo(() => {
    if (!selectedContent?.cleanedHtml || paragraphTranslations.size === 0) return '';
    const baseHtml = applyHighlightsToHtml(selectedContent.cleanedHtml, selectedArticleId);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${baseHtml}</div>`, 'text/html');
    const container = doc.body.firstElementChild;
    if (!container) return baseHtml;
    // Must use same selector logic as handleTranslateArticle to match indices
    const blockSelector = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, td, th, figcaption, dt, dd, summary, caption';
    const allBlocks = Array.from(container.querySelectorAll(blockSelector));
    const blocks = allBlocks.filter(block => {
      let parent = block.parentElement;
      while (parent && parent !== container) {
        if (parent.matches(blockSelector)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
    const leafDivs = Array.from(container.querySelectorAll('div, section, article'))
      .filter(div => {
        if (div.querySelector(blockSelector)) return false;
        return (div.textContent?.trim() ?? '').length > 0;
      });
    const allElements = [...blocks, ...leafDivs];
    // Insert translations using the paragraph index map (matches allTranslatableElements by index)
    allElements.forEach((block, index) => {
      const translation = paragraphTranslations.get(index);
      if (translation) {
        const transDiv = doc.createElement('div');
        transDiv.className = 'bilingual-inline-translation';
        transDiv.textContent = translation;
        block.after(transDiv);
      }
    });
    return container.innerHTML;
  }, [selectedContent, paragraphTranslations, selectedArticleId, applyHighlightsToHtml]);

  // Memoize the innerHTML object to prevent unnecessary DOM recreation (avoids iframe/video reload on scroll)
  const contentInnerHtml = useMemo(() => {
    const html = showBilingualView ? bilingualHtml : displayedHtml;
    return html ? { __html: html } : null;
  }, [showBilingualView, bilingualHtml, displayedHtml]);

  return (
    <main className={shellClassName} style={gridStyle}>
      <aside className="sidebar" aria-label={copy.feeds}>
        {!isFeedsCollapsed && <div className="resize-handle" onMouseDown={(e) => startResize(e, 'feeds')} />}
        <div className="brand-block">
          <div className="brand-title-row">
            <svg className="prism-icon" viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">
              <polygon points="14,3 25,24 3,24" fill="none" stroke="var(--theme-accent)" strokeWidth="2" strokeLinejoin="round" />
              <line x1="14" y1="3" x2="8" y2="24" stroke="var(--theme-accent)" strokeWidth="1" opacity="0.5" />
              <line x1="14" y1="3" x2="20" y2="24" stroke="var(--theme-accent)" strokeWidth="1" opacity="0.5" />
              <line x1="6" y1="18" x2="22" y2="18" stroke="var(--theme-accent)" strokeWidth="0.8" opacity="0.3" />
              <circle cx="10" cy="21" r="1.2" fill="var(--theme-accent)" opacity="0.6" />
              <circle cx="14" cy="21" r="1.2" fill="var(--theme-accent)" opacity="0.8" />
              <circle cx="18" cy="21" r="1.2" fill="var(--theme-accent)" opacity="0.6" />
            </svg>
            <h1>Prism Reader</h1>
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

        {syncStatus === 'running' ? (
          <div className={`sync-message sync-message-running`} aria-live="polite">
            {syncMessage}
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
        {/* Collapsed-state buttons: always visible */}
        <div className="collapsed-sidebar-actions">
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
          <div className="panel-heading-actions">
            <button
              className="icon-button"
              type="button"
              {...tooltipProps(articleViewMode === 'compact'
                ? (uiLanguage === 'zh' ? '详细视图' : 'Detail view')
                : (uiLanguage === 'zh' ? '简洁视图' : 'Compact view'))}
              onClick={() => setArticleViewMode(m => m === 'compact' ? 'detail' : 'compact')}
            >
              {articleViewMode === 'compact' ? <LayoutList size={16} aria-hidden="true" /> : <List size={16} aria-hidden="true" />}
            </button>
            <span className="count-label">{filteredArticles.length}</span>
          </div>
        </div>

        {/* Feature 8: Filter buttons */}
        <div className="article-filters">
          <div className="filter-buttons">
            {(['all', 'unread', 'read', 'saved'] as const).map((f) => (
              <button
                key={f}
                className={`filter-button ${articleFilter === f ? 'is-active' : ''}`}
                type="button"
                onClick={() => setArticleFilter(f)}
              >
                {f === 'all' ? copy.filterAll : f === 'unread' ? copy.filterUnread : f === 'read' ? copy.filterRead : copy.filterSaved}
              </button>
            ))}
          </div>
          {allCustomTags.length > 0 ? (
            <div className="tag-filter-wrapper">
              <select
                className="tag-filter-select"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">{copy.tagFilterAll}</option>
                {allCustomTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              {tagFilter ? (
                <button
                  className="tag-filter-delete"
                  type="button"
                  {...tooltipProps(uiLanguage === 'zh' ? `删除所有"${tagFilter}"标签` : `Delete all "${tagFilter}" tags`)}
                  onClick={() => setPendingDeleteTag(tagFilter)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="article-list">
          {articlesStatus === 'loading' ? <span className="state-line">{copy.loadingArticles}</span> : null}
          {articlesStatus === 'error' ? (
            <span className="state-line state-line-error">Articles failed to load</span>
          ) : null}
          {articlesStatus === 'ready' && filteredArticles.length === 0 ? (
            <span className="state-line">{copy.noArticles}</span>
          ) : null}
          {filteredArticles.map((article) => (
            <ArticleRow
              article={article}
              key={article.id}
              sourceName={feedTitleById.get(article.feedId) ?? 'Unknown feed'}
              selected={article.id === selectedArticle?.id}
              onSelect={() => setSelectedArticleId(article.id)}
              labels={{ read: copy.read, unread: copy.unread, saved: copy.saved }}
              progress={readingProgress.get(article.id)}
              customTags={articleTags[article.id]}
              compact={articleViewMode === 'compact'}
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

      {/* Feature 2: Reader panel now comes BEFORE inspector panel */}
      <section className="reader-panel" aria-label="Reader">
        {selectedArticle ? (
          <>
            <header className="reader-header">
              {/* Feature 5: Compact toolbar ABOVE title */}
              <div className="reader-toolbar-row">
                <div className="reader-toolbar">
                  <a className="icon-button" href={selectedArticle.url} target="_blank" rel="noreferrer" {...tooltipProps(copy.sourceTooltip)}>
                    <ExternalLink size={17} aria-hidden="true" />
                  </a>
                  <button
                    className={selectedArticleIsRead ? 'icon-button is-active' : 'icon-button'}
                    type="button"
                    aria-label={selectedArticleIsRead ? copy.readTooltip : copy.unreadTooltip}
                    {...tooltipProps(selectedArticleIsRead ? copy.readTooltip : copy.unreadTooltip)}
                    onClick={() => void handleArticleStateChange({ isRead: !selectedArticleIsRead })}
                  >
                    <CheckCircle2 size={17} aria-hidden="true" />
                  </button>
                  <button
                    className={selectedArticleIsStarred ? 'icon-button is-active' : 'icon-button'}
                    type="button"
                    aria-label={selectedArticleIsStarred ? copy.savedTooltip : copy.saveTooltip}
                    {...tooltipProps(selectedArticleIsStarred ? copy.savedTooltip : copy.saveTooltip)}
                    onClick={() => void handleArticleStateChange({ isStarred: !selectedArticleIsStarred })}
                  >
                    <Star size={17} aria-hidden="true" />
                  </button>
                  <button
                    className={activePanel === 'summary' ? 'icon-button is-active' : 'icon-button'}
                    type="button"
                  disabled={summaryStatus === 'running'}
                  aria-label={copy.summary}
                  {...tooltipProps(copy.summaryTooltip)}
                  onClick={handleOpenSummaryFromToolbar}
                >
                    <Sparkles size={17} aria-hidden="true" />
                  </button>
                  <button
                    className={activePanel === 'translation' ? 'icon-button is-active' : 'icon-button'}
                    type="button"
                    disabled={translationStatus === 'running'}
                  aria-label={copy.translate}
                  {...tooltipProps(copy.translateTooltip)}
                  onClick={handleOpenTranslationFromToolbar}
                >
                    <Languages size={17} aria-hidden="true" />
                  </button>
                  <button
                    className={activePanel === 'usage' ? 'icon-button is-active' : 'icon-button'}
                    type="button"
                    aria-label={copy.usage}
                    {...tooltipProps(copy.usageTooltip)}
                    onClick={() => {
                      openAiPanel('usage');
                    }}
                  >
                    <BarChart3 size={17} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={!hasCanonicalMarkdown}
                    aria-label={copy.export}
                    {...tooltipProps(copy.exportMarkdown)}
                    onClick={() => void handleExportCurrentArticle()}
                  >
                    <Download size={17} aria-hidden="true" />
                  </button>
                  {/* Notes button */}
                  <button
                    className={activePanel === 'notes' ? 'icon-button is-active' : 'icon-button'}
                    type="button"
                    aria-label={copy.notes}
                    {...tooltipProps(copy.notes)}
                    onClick={() => openAiPanel('notes')}
                  >
                    <StickyNote size={17} aria-hidden="true" />
                  </button>
                  {/* Feature 8: Add tag button */}
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={copy.addTag}
                    {...tooltipProps(copy.addTag)}
                    onClick={handleAddTag}
                  >
                    <Tag size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="reader-header-info">
                <div className="reader-kicker">
                  <BookOpen size={17} aria-hidden="true" />
                  <span>{selectedFeed?.title ?? 'Unknown feed'}</span>
                  <span>{selectedArticle.author ?? 'Unknown author'}</span>
                  <span>{formatDate(selectedArticle.publishedAt)}</span>
                </div>
                <h2>{selectedArticle.title}</h2>
                {translatedTitle ? (
                  <p className="translated-title">{translatedTitle}</p>
                ) : null}
                {/* Show current tags with remove button */}
                {(articleTags[selectedArticleId] || []).length > 0 ? (
                  <div className="reader-tags">
                    {(articleTags[selectedArticleId] || []).map((tag) => (
                      <span className="tag custom-tag" key={tag}>
                        {tag}
                        <button className="tag-remove" type="button" onClick={() => handleRemoveTag(selectedArticleId, tag)}>
                          <X size={10} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {/* Inline tag input with autocomplete */}
              {showTagInput ? (
                <div className="tag-input-row">
                  <div className="tag-input-wrapper">
                    <input
                      className="setting-input"
                      placeholder={uiLanguage === 'zh' ? '输入标签名称或选择已有标签' : 'Type tag name or select existing'}
                      type="text"
                      autoFocus
                      value={tagInput}
                      onChange={(e) => { setTagInput(e.target.value); setTagSuggestionIndex(-1); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSubmitTag(); }
                        else if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); setTagSuggestionIndex(i => Math.min(i + 1, tagSuggestions.length - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setTagSuggestionIndex(i => Math.max(i - 1, -1)); }
                      }}
                    />
                    {tagSuggestions.length > 0 ? (
                      <ul className="tag-suggestions">
                        {tagSuggestions.map((s, i) => (
                          <li
                            key={s}
                            className={i === tagSuggestionIndex ? 'is-active' : ''}
                            onMouseDown={(e) => { e.preventDefault(); handleApplyTag(s); }}
                            onMouseEnter={() => setTagSuggestionIndex(i)}
                          >
                            {s}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <button className="icon-button" type="button" {...tooltipProps(copy.addTag)} onClick={handleSubmitTag} disabled={!tagInput.trim() && tagSuggestionIndex < 0}>
                    <Plus size={16} aria-hidden="true" />
                  </button>
                  <button className="icon-button" type="button" onClick={() => { setShowTagInput(false); setTagInput(''); }}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
              {exportMessage ? <div className="reader-action-message">{exportMessage}</div> : null}
            </header>

            <div
              className={`reader-grid${highlightPopup ? ' has-selection' : ''}`}
              ref={readerGridRef}
              onScroll={handleReaderScroll}
              onMouseUp={handleReaderMouseUp}
            >
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
                  {contentInnerHtml ? <div dangerouslySetInnerHTML={contentInnerHtml} /> : null}
                </article>
              ) : null}
            </div>

            {/* Feature 9: Annotation popup with color picker */}
            {highlightPopup ? (
              <div
                className="annotation-popup"
                style={{ left: highlightPopup.x, top: highlightPopup.y }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                {inlineTranslation ? (
                  <div className="annotation-translation">
                    {inlineTranslation.loading ? (
                      <span className="annotation-translation-loading">
                        <RefreshCw className="spin-icon" size={13} aria-hidden="true" />
                        {copy.translating}
                      </span>
                    ) : (
                      <>
                        <p className="annotation-translation-text">{inlineTranslation.translation}</p>
                        <button type="button" onClick={() => {
                          addTextToNotes(inlineTranslation.text, inlineTranslation.translation);
                          setInlineTranslation(null);
                        }}>
                          <StickyNote size={13} aria-hidden="true" />
                          {copy.addTranslationToNotes}
                        </button>
                      </>
                    )}
                  </div>
                ) : annotationNoteMode ? (
                  <div className="annotation-note-input">
                    <input
                      className="setting-input"
                      placeholder={copy.noteInput}
                      type="text"
                      autoFocus
                      value={annotationNoteText}
                      onChange={(e) => setAnnotationNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addTextToNotes(highlightPopup.text, annotationNoteText);
                          setAnnotationNoteMode(false);
                          setAnnotationNoteText('');
                        }
                        if (e.key === 'Escape') {
                          setAnnotationNoteMode(false);
                          setAnnotationNoteText('');
                        }
                      }}
                    />
                    <button className="icon-button" type="button" onClick={() => {
                      addTextToNotes(highlightPopup.text, annotationNoteText);
                      setAnnotationNoteMode(false);
                      setAnnotationNoteText('');
                    }}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="annotation-colors">
                      {HIGHLIGHT_COLORS.map((c) => (
                        <button
                          key={c.name}
                          className={`color-dot ${selectedColor === c.value ? 'is-selected' : ''}`}
                          type="button"
                          style={{ background: c.value.replace(/[\d.]+\)$/, '1)') }}
                          onClick={() => setSelectedColor(c.value)}
                        />
                      ))}
                    </div>
                    <div className="annotation-actions">
                      <button type="button" onClick={() => addAnnotation('highlight')}>
                        <Highlighter size={13} aria-hidden="true" />
                        {copy.highlight}
                      </button>
                      <button type="button" onClick={() => addAnnotation('underline')}>
                        <Type size={13} aria-hidden="true" />
                        {copy.underline}
                      </button>
                      <button type="button" onClick={() => setAnnotationNoteMode(true)}>
                        <StickyNote size={13} aria-hidden="true" />
                        {copy.addToNotes}
                      </button>
                      <button type="button" onClick={async () => {
                        if (!agentUiPort.translateText || !highlightPopup) return;
                        const text = highlightPopup.text;
                        setInlineTranslation({ text, translation: '', loading: true });
                        try {
                          const result = await agentUiPort.translateText(
                            text,
                            translationTargetLanguage,
                            sourceLanguage === 'auto' ? undefined : sourceLanguage
                          );
                          setInlineTranslation({ text, translation: result.trim(), loading: false });
                        } catch {
                          setInlineTranslation(null);
                        }
                      }}>
                        <Languages size={13} aria-hidden="true" />
                        {copy.translateSelection}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
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
        {/* AI panel toggle — at reader/inspector boundary, on the reader side */}
        <button
          className="column-edge-toggle ai-edge-toggle"
          type="button"
          aria-label={isInspectorCollapsed ? copy.showAi : copy.collapseAi}
          {...tooltipProps(isInspectorCollapsed ? copy.showAi : copy.collapseAi)}
          onClick={toggleAiPanel}
        >
          {isInspectorCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
      </section>

      {/* Feature 2: Inspector panel now on the RIGHT side */}
      <aside className={`inspector-panel ${isInspectorCollapsed ? 'is-collapsed' : ''}`}>
        {!isInspectorCollapsed && <div className="resize-handle resize-handle-left" onMouseDown={(e) => startResize(e, 'ai')} />}

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

        {!isInspectorCollapsed && activePanel === 'notes' ? (
          <div className="inspector-section notes-panel">
            <div className="inspector-title">
              <StickyNote size={17} aria-hidden="true" />
              <span>{copy.notes}</span>
            </div>
            <div className="note-input-row">
              <input
                className="setting-input"
                placeholder={copy.noteInput}
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addFreeNote(noteInput); }}
              />
              <button className="icon-button" type="button" {...tooltipProps(copy.addNote)} onClick={() => addFreeNote(noteInput)} disabled={!noteInput.trim()}>
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="notes-list">
              {/* Show highlights and underlines */}
              {(highlights[selectedArticleId] || []).map((hl, idx) => (
                <div className="note-item" key={`hl-${idx}`}>
                  <div className="note-item-header">
                    {hl.type === 'underline' ? <Type size={13} aria-hidden="true" /> : <Highlighter size={13} aria-hidden="true" />}
                    <span className="note-type-label">{hl.type === 'underline' ? copy.underline : copy.highlight}</span>
                    <button className="note-delete" type="button" onClick={() => {
                      setHighlights((prev) => {
                        const next = { ...prev };
                        next[selectedArticleId] = (next[selectedArticleId] || []).filter((_, i) => i !== idx);
                        saveHighlights(next);
                        return next;
                      });
                    }}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="note-quote" style={{ borderLeftColor: hl.color.replace(/[\d.]+\)$/, '1)') }}>{hl.text}</p>
                </div>
              ))}
              {/* Show text notes */}
              {(articleNotes[selectedArticleId] || []).map((n) => (
                <div className="note-item" key={n.id}>
                  <div className="note-item-header">
                    <Pen size={13} aria-hidden="true" />
                    <span className="note-type-label">{copy.notes}</span>
                    <button className="note-delete" type="button" onClick={() => deleteNote(n.id)}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                  {n.text ? <p className="note-quote">{n.text}</p> : null}
                  {n.note ? <p className="note-body">{n.note}</p> : null}
                </div>
              ))}
              {(highlights[selectedArticleId] || []).length === 0 && (articleNotes[selectedArticleId] || []).length === 0 ? (
                <p className="agent-output-placeholder">{copy.noNotes}</p>
              ) : null}
            </div>
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
                  title={currentSummaryMarkdown ? copy.summaryShownInBody : copy.generate}
                  onClick={() => void handleGenerateSummary(false)}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {summaryStatus === 'running' ? copy.generating : currentSummaryMarkdown ? copy.summary : copy.generate}
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
                  title={currentTranslationMarkdown ? copy.translationShownInBody : copy.translate}
                  onClick={() => void handleTranslateArticle(false)}
                >
                  <Languages size={16} aria-hidden="true" />
                  {translationStatus === 'running' ? copy.translating : copy.translate}
                </button>
                <button
                  className={`tool-button is-full ${bilingualMode ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => setBilingualMode((v) => !v)}
                >
                  <BookOpen size={16} aria-hidden="true" />
                  {bilingualMode ? copy.bilingualOn : copy.bilingualOff}
                </button>
              </div>
            )}
            <div className="agent-status-list">
              <div className="agent-status-row">
                <span>{activePanel}</span>
                <StatusPill status={activePanel === 'summary' ? summaryStatus : translationStatus} />
              </div>
              {activePanel === 'translation' && paragraphTranslationProgress.total > 0 ? (
                <div className="translation-progress-info">
                  {translationStatus === 'running'
                    ? `${uiLanguage === 'zh' ? '翻译中' : 'Translating'} ${paragraphTranslationProgress.completed}/${paragraphTranslationProgress.total}`
                    : `${paragraphTranslationProgress.completed}/${paragraphTranslationProgress.total} ${uiLanguage === 'zh' ? '段已翻译' : 'paragraphs translated'}`
                  }
                  {bilingualMode ? ` · ${uiLanguage === 'zh' ? '对照模式' : 'bilingual'}` : ''}
                </div>
              ) : null}
            </div>
            {currentAgentProgress ? (
              <AgentProgressCard
                copy={agentProgressCopy[uiLanguage]}
                elapsedMs={currentAgentProgressElapsed}
                progress={currentAgentProgress}
              />
            ) : null}
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
                disabled={
                  !hasCanonicalMarkdown ||
                  (activePanel === 'summary' ? summaryStatus === 'running' : translationStatus === 'running')
                }
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
              {activePanel === 'summary' && currentSummaryMarkdown ? (
                <button
                  className="icon-button"
                  type="button"
                  aria-label={summaryAddedToNotes ? copy.summaryAlreadyAdded : copy.addSummaryToNotes}
                  {...tooltipProps(summaryAddedToNotes ? copy.summaryAlreadyAdded : copy.addSummaryToNotes)}
                  disabled={summaryAddedToNotes}
                  onClick={() => { addTextToNotes(currentSummaryMarkdown); setSummaryAddedToNotes(true); }}
                >
                  <StickyNote size={16} aria-hidden="true" />
                </button>
              ) : null}
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
                    setSummaryProgress(null);
                  } else {
                    setTranslationStatus('idle');
                    setTranslationResult(null);
                    setTranslationError('');
                    setTranslationProgress(null);
                  }
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
            {/* AI History */}
            {(() => {
              const panelType = activePanel === 'summary' ? 'summary' : 'translation';
              const historyForPanel = aiHistory.filter(h => h.type === panelType);
              if (historyForPanel.length === 0) return null;
              return (
                <div className="ai-history-section">
                  <button
                    className="ai-history-toggle"
                    type="button"
                    onClick={() => setShowHistory(v => !v)}
                  >
                    <Clock size={14} aria-hidden="true" />
                    <span>{copy.history} ({historyForPanel.length})</span>
                    <span className="ai-history-arrow">{showHistory ? '▲' : '▼'}</span>
                  </button>
                  {showHistory ? (
                    <ul className="ai-history-list">
                      {historyForPanel.map(entry => (
                        <li key={entry.id} className="ai-history-item">
                          <div className="ai-history-meta">
                            <span className="ai-history-time">
                              {new Date(entry.createdAt).toLocaleString(uiLanguage === 'zh' ? 'zh-CN' : 'en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                            <span className="ai-history-lang">{entry.targetLanguage}</span>
                            {entry.detailLevel ? <span className="ai-history-detail">{entry.detailLevel}</span> : null}
                          </div>
                          <p className="ai-history-preview">{entry.markdown.slice(0, 80)}…</p>
                          <div className="ai-history-actions">
                            <button
                              className="tool-button is-compact"
                              type="button"
                              title={copy.restoreHistory}
                              onClick={() => {
                                if (panelType === 'summary') {
                                  setSummaryResult({
                                    id: entry.id, articleId: selectedArticleId, taskId: '', targetLanguage: entry.targetLanguage,
                                    detailLevel: (entry.detailLevel || 'brief') as Week3SummaryDetailLevel,
                                    markdown: entry.markdown, providerId: '', providerName: entry.providerName,
                                    model: entry.model, createdAt: entry.createdAt, updatedAt: entry.createdAt
                                  });
                                  setSummaryStatus('succeeded');
                                } else {
                                  setTranslationResult({
                                    id: entry.id, articleId: selectedArticleId, taskId: '', targetLanguage: entry.targetLanguage,
                                    sourceLanguage: entry.sourceLanguage, markdown: entry.markdown, providerId: '',
                                    providerName: entry.providerName, model: entry.model, createdAt: entry.createdAt, updatedAt: entry.createdAt
                                  });
                                  setTranslationStatus('succeeded');
                                }
                                setShowHistory(false);
                              }}
                            >
                              <RotateCcw size={12} aria-hidden="true" />
                              {copy.restoreHistory}
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              title={copy.deleteHistory}
                              onClick={() => {
                                const updated = aiHistory.filter(h => h.id !== entry.id);
                                setAiHistory(updated);
                                if (selectedArticleId) saveAiHistory(selectedArticleId, updated);
                              }}
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })()}
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

      {activeDialog === 'help' ? (
        <DialogShell
          title={copy.helpTitle}
          closeLabel={copy.closeDialog}
          icon={<HelpCircle size={20} aria-hidden="true" />}
          onClose={() => setActiveDialog(null)}
        >
          <div className="help-panel">
            {copy.helpSections.map((section) => (
              <div className="help-section" key={section.title}>
                <h3>{section.title}</h3>
                {section.items.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
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

          {/* Feature 4: Theme setting */}
          <div className="setting-group setting-group-column">
            <span className="setting-label">{copy.theme}</span>
            <div className="theme-grid" role="group" aria-label={copy.theme}>
              {([
                { key: 'luting' as const, colors: ['#8BA995', '#A1C1A1', '#D2C4B2', '#DFDAD3'] },
                { key: 'yuanshan' as const, colors: ['#A8BEDF', '#C7D5E8', '#D8C9BA', '#EFE4D4'] },
                { key: 'taozhi' as const, colors: ['#D48D95', '#E6A6AC', '#A1C2B1', '#B7D5C6'] },
                { key: 'chuangsha' as const, colors: ['#A09BC3', '#B6A9C8', '#9DBFC3', '#D8E6EA'] },
                { key: 'taowan' as const, colors: ['#99B6B4', '#BACFCE', '#D48982', '#DFB199'] },
                { key: 'shulin' as const, colors: ['#CBAF98', '#DBB9A4', '#E1D8C7', '#EDE0D0'] },
                { key: 'xiuri' as const, colors: ['#EAC077', '#F2CB8E', '#EABFC3', '#F5D5D9'] },
                { key: 'xinglin' as const, colors: ['#9EB995', '#E8C49A', '#C8D3C0', '#F1EEE9'] },
                { key: 'xuejin' as const, colors: ['#987F74', '#BA9B92', '#C4C0C1', '#F0ECEB'] },
                { key: 'green' as const, colors: ['#2f675c', '#8BA995', '#eee9dd', '#f7f5ef'] },
                { key: 'light' as const, colors: ['#2563eb', '#93b4f5', '#f3f4f6', '#ffffff'] },
                { key: 'dark' as const, colors: ['#4dabf7', '#339af0', '#2c2e33', '#1a1b1e'] },
              ]).map(({ key, colors }) => {
                const labelMap: Record<string, string> = {
                  luting: copy.themeLuting, yuanshan: copy.themeYuanshan, taozhi: copy.themeTaozhi,
                  chuangsha: copy.themeChuangsha, taowan: copy.themeTaowan, shulin: copy.themeShulin,
                  xiuri: copy.themeXiuri, xinglin: copy.themeXinglin, xuejin: copy.themeXuejin,
                  green: copy.themeGreen, light: copy.themeLight, dark: copy.themeDark
                };
                return (
                  <button
                    className={`theme-swatch ${theme === key ? 'is-selected' : ''}`}
                    key={key}
                    type="button"
                    title={labelMap[key]}
                    onClick={() => setTheme(key)}
                  >
                    <div className="theme-swatch-colors">
                      {colors.map((c, i) => <span key={i} style={{ background: c }} />)}
                    </div>
                    <span className="theme-swatch-label">{labelMap[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

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

          {/* Feature 3: Summary Model Provider Section */}
          <section className="settings-section" aria-label={copy.summaryModel}>
            <div className="settings-section-header">
              <Sparkles size={18} aria-hidden="true" />
              <div>
                <h3>{copy.summaryModel}</h3>
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
            <div className="provider-profile-list" aria-label={copy.providerProfiles}>
              <div className="provider-profile-title">{copy.providerProfiles}</div>
              {providerProfiles.length === 0 ? (
                <p className="settings-note">{copy.providerProfilesEmpty}</p>
              ) : (
                providerProfiles.map((profile) => {
                  const isCurrent = profile.baseUrl === providerBaseUrl && profile.model === providerModel;
                  const key = providerProfileKey(profile);
                  const isSummaryDefault = summaryProviderProfileKey === key;
                  const isTranslationDefault = translationProviderProfileKey === key;
                  const summaryLabel = uiLanguage === 'zh' ? '摘要' : 'Summary';
                  const translationLabel = uiLanguage === 'zh' ? '翻译' : 'Translation';

                  return (
                    <div className={isCurrent ? 'provider-profile-row is-current' : 'provider-profile-row'} key={`${profile.baseUrl}-${profile.model}`}>
                      <div className="provider-profile-meta">
                        <strong>{profile.model}</strong>
                        <span>{profile.baseUrl}</span>
                        <div className="provider-profile-badges">
                          {isCurrent ? <span>{copy.currentProvider}</span> : null}
                          {isSummaryDefault ? <span>{summaryLabel}</span> : null}
                          {isTranslationDefault ? <span>{translationLabel}</span> : null}
                        </div>
                      </div>
                      <div className="provider-profile-actions">
                        <button
                          className={isCurrent ? 'agent-status agent-status-succeeded' : 'tool-button'}
                          disabled={isCurrent || providerStatus === 'saving' || providerStatus === 'testing'}
                          type="button"
                          onClick={() => handleUseProviderProfile(profile)}
                        >
                          {isCurrent ? copy.currentProvider : copy.useProvider}
                        </button>
                        <button
                          className={isSummaryDefault ? 'agent-status agent-status-succeeded' : 'tool-button'}
                          disabled={providerStatus === 'saving' || providerStatus === 'testing'}
                          type="button"
                          onClick={() => handleAgentProviderSelection('summary', key)}
                        >
                          {summaryLabel}
                        </button>
                        <button
                          className={isTranslationDefault ? 'agent-status agent-status-succeeded' : 'tool-button'}
                          disabled={providerStatus === 'saving' || providerStatus === 'testing'}
                          type="button"
                          onClick={() => handleAgentProviderSelection('translation', key)}
                        >
                          {translationLabel}
                        </button>
                        <button
                          className="icon-button"
                          disabled={providerStatus === 'saving' || providerStatus === 'testing'}
                          type="button"
                          aria-label={copy.delete}
                          title={copy.delete}
                          onClick={() => handleDeleteProviderProfile(profile)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {providerProfiles.length > 0 ? (
              <div className="provider-routing-grid">
                <label className="setting-group">
                  <span className="setting-label">{copy.providerUseForSummary}</span>
                  <select
                    value={summaryProviderProfileKey}
                    onChange={(event) => handleAgentProviderSelection('summary', event.target.value)}
                  >
                    <option value="">{copy.providerUseDefault}</option>
                    {providerProfiles.map((profile) => (
                      <option key={`summary-${providerProfileKey(profile)}`} value={providerProfileKey(profile)}>
                        {profile.model} / {profile.baseUrl}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="setting-group">
                  <span className="setting-label">{copy.providerUseForTranslation}</span>
                  <select
                    value={translationProviderProfileKey}
                    onChange={(event) => handleAgentProviderSelection('translation', event.target.value)}
                  >
                    <option value="">{copy.providerUseDefault}</option>
                    {providerProfiles.map((profile) => (
                      <option key={`translation-${providerProfileKey(profile)}`} value={providerProfileKey(profile)}>
                        {profile.model} / {profile.baseUrl}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
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

          <section className="settings-section" aria-label={copy.translationModel}>
            <div className="settings-section-header">
              <Languages size={18} aria-hidden="true" />
              <div>
                <h3>{copy.translationModel}</h3>
                <p>{providerConfigured ? copy.providerConfigured : copy.providerMissing}</p>
              </div>
            </div>
            <p className="settings-note">
              {uiLanguage === 'zh'
                ? '翻译、摘要和划词翻译统一使用上方当前模型。需要切换不同模型时，请先保存多个模型配置，再在已保存模型配置中点击使用。'
                : 'Translation, summary, and selected-text translation use the current model above. Save multiple model providers and switch them from the saved provider list.'}
            </p>
          </section>
        </DialogShell>
      ) : null}
      {/* Toast notifications */}
      {toasts.length > 0 ? (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.status}`}>
              <span className="toast-text">{t.message}</span>
              <button className="toast-close" type="button" onClick={() => dismissToast(t.id)}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
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
      {/* Confirm dialog for global tag deletion */}
      {pendingDeleteTag ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPendingDeleteTag(null)}>
          <section
            className="app-dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={uiLanguage === 'zh' ? '确认删除标签' : 'Confirm tag deletion'}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="dialog-header">
              <div className="dialog-title">
                <Trash2 size={18} aria-hidden="true" />
                <h2>{uiLanguage === 'zh' ? '删除标签' : 'Delete Tag'}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPendingDeleteTag(null)}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="dialog-body">
              <p>{uiLanguage === 'zh'
                ? `确定要从所有文章中删除「${pendingDeleteTag}」标签吗？此操作不可撤销。`
                : `Delete tag "${pendingDeleteTag}" from all articles? This cannot be undone.`}</p>
              <div className="settings-actions" style={{ marginTop: 12 }}>
                <button className="tool-button" type="button" onClick={() => setPendingDeleteTag(null)}>
                  {uiLanguage === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button className="primary-button is-compact" type="button" style={{ background: 'var(--theme-error, #d32f2f)' }} onClick={() => {
                  handleDeleteTagGlobally(pendingDeleteTag);
                  setPendingDeleteTag(null);
                }}>
                  <Trash2 size={14} aria-hidden="true" />
                  {uiLanguage === 'zh' ? '确认删除' : 'Delete'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
