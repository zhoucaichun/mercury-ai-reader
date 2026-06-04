# Mercury AI Reader - AGENTS.md

> 本文档是 Mercury AI Reader 项目的 AI Coding 约束文档。  
> 每位成员使用 AI 写代码、写文档或修改接口前，应先让 AI 阅读本文件，再阅读自己负责模块的 Issue / PR / 文档。

## 1. Project Goal

Mercury AI Reader 是一个本地优先、跨平台、支持 AI 摘要和翻译的 Feed 阅读器。

项目目标：

- 支持 Feed / OPML 解析、文章同步和内容呈现；
- 支持正文清洗，形成 cleaned HTML 和 canonical Markdown；
- 支持 Summary Agent 和 Translation Agent；
- 支持标准 API 的 LLM Provider，包括远程模型和本地模型；
- 支持 LLM Usage 统计；
- 支持单篇 Markdown 导出；
- 不要求登录，不主动采集用户数据。

## 2. Tech Stack

当前技术栈固定为：

- Electron：跨平台桌面应用，支持 Windows / Linux / macOS；
- React：前端 UI；
- TypeScript：统一类型和接口；
- Vite：前端开发和构建工具；
- SQLite：本地优先数据存储；
- OpenAI-compatible API：统一接入 DeepSeek、学校模型、hymt2、Ollama 等模型服务。

如需调整主技术栈，必须先向组长说明原因、影响范围和替代方案，经确认后再修改。

## 3. Main Directory Structure

以 main 分支当前骨架为准：

```text
mercury-ai-reader/
├─ electron/
├─ src/
│  ├─ app/
│  ├─ core/
│  ├─ features/
│  │  ├─ feed/
│  │  │  ├─ parser/
│  │  │  ├─ opml/
│  │  │  ├─ subscriptions/
│  │  │  └─ sync/
│  │  ├─ reader/
│  │  │  └─ pipeline/
│  │  ├─ agent/
│  │  │  ├─ runtime/
│  │  │  ├─ prompts/
│  │  │  ├─ providers/
│  │  │  ├─ summary/
│  │  │  └─ translation/
│  │  ├─ usage/
│  │  └─ export/
│  └─ styles/
├─ task-documents/
└─ package.json
```

目录规则：

- Feed Parser 代码放在 `src/features/feed/parser/`；
- OPML 导入代码放在 `src/features/feed/opml/`；
- 订阅源管理代码放在 `src/features/feed/subscriptions/`；
- Sync / 文章同步 / 入库代码放在 `src/features/feed/sync/`；
- 阅读器、文章列表、阅读设置放在 `src/features/reader/`；
- Reader Pipeline / 内容清洗代码放在 `src/features/reader/pipeline/`；
- Agent Runtime 代码放在 `src/features/agent/runtime/`；
- Prompt 模板加载、渲染相关代码放在 `src/features/agent/prompts/`；
- LLM Provider 相关代码放在 `src/features/agent/providers/`；
- Summary Agent 代码放在 `src/features/agent/summary/`；
- Translation Agent 代码放在 `src/features/agent/translation/`；
- LLM Usage 统计放在 `src/features/usage/`；
- 单篇 Markdown 导出放在 `src/features/export/`；
- 公共类型、mock 数据、通用工具放在 `src/core/`；
- 不新增平行的 `src/feed/`、`src/reader/`、`src/features/llm/` 目录；
- 不用 `docs/T*.md` 这类散放路径，功能文档统一放在 `docs/features/`；
- Provider 归入 `agent/providers`，Usage 归入 `usage`。

功能文档命名规则：

```text
docs/features/T2-data-model.md
docs/features/T3-feed-parser.md
docs/features/T4-opml-subscriptions.md
docs/features/T5-sync-design.md
docs/features/T6-reader-pipeline.md
docs/features/T7-reader-ui-plan.md
docs/features/T8-agent-runtime.md
docs/features/T9-llm-provider-usage.md
docs/features/T10-summary-agent.md
docs/features/T11-translation-export.md
```

## 4. Module Boundaries

各模块必须保持边界清晰：

- Feed / OPML / Sync 模块负责订阅源、Feed 解析、文章同步和入库，不直接实现阅读器 UI；
- Reader 模块负责文章列表、阅读页、阅读样式和交互入口，不直接实现 Feed 解析或模型调用；
- Reader Pipeline 负责 `sourceHtml -> cleanedHtml -> canonicalMarkdown`；
- Summary / Translation 不直接调用具体模型 API，必须通过统一 Provider；
- Usage 统计不散落在各模块中，统一通过 usage record / usage event 记录；
- Export 只做单篇 Markdown 导出，不做多篇导出。

如果某个功能跨模块，先在 Issue 或 PR 说明依赖关系，不要直接改别人的模块实现。

## 5. Core Data Contracts

字段命名统一使用 camelCase。

时间字段统一使用 ISO string，例如：

```ts
createdAt: string;
updatedAt: string;
publishedAt?: string;
lastSyncedAt?: string;
```

内容字段统一：

```ts
sourceHtml: string;
cleanedHtml: string;
canonicalMarkdown: string;
```

`canonicalMarkdown` 是后续阅读器、Summary、Translation、Export 的统一正文输入。

摘要结果字段统一：

```ts
detailLevel: "brief" | "standard";
markdown: string;
```

如果本地数据库内部字段名不同，必须在文档中说明映射关系。

## 5A. Week 2 Main Chain Contract

Week 2 优先打通：

```text
Feed / OPML -> Sync -> Local Storage -> Article List
```

主链路涉及 T2 / T3 / T4 / T5 / T7。所有人按本节接口实现，不再各自定义一套字段或返回结构。

约定：

- 所有对外 ID 使用 `string`，T2 如果内部使用 number，需要自行转换；
- 所有时间字段使用 ISO string；
- 真实实现没完成时可以先使用 mock adapter，但函数名、字段名、返回结构必须保持一致；
- T6 / T8 / T9 / T10 / T11 本周不阻塞主链路，但需要按本文件保持字段和接口一致。

```ts
export type ISODateString = string;

export type Week2FeedStatus = 'ready' | 'syncing' | 'error';
export type Week2ArticleReadState = 'unread' | 'reading' | 'saved';
export type Week2SubscriptionStatus = 'active' | 'disabled' | 'error';
export type Week2SubscriptionSource = 'manual' | 'opml' | 'mock';

export interface Week2Subscription {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  groupName?: string;
  source: Week2SubscriptionSource;
  status: Week2SubscriptionStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Week2Feed {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  unreadCount: number;
  status: Week2FeedStatus;
  lastSyncedAt?: ISODateString;
}

export interface Week2ParsedFeed {
  feed: {
    title: string;
    feedUrl: string;
    siteUrl?: string;
    fetchedAt: ISODateString;
  };
  articles: Week2ParsedArticle[];
  warnings: string[];
}

export interface Week2ParsedArticle {
  id?: string;
  feedId?: string;
  guid?: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  contentText?: string;
  publishedAt?: ISODateString;
  updatedAt?: ISODateString;
  tags?: string[];
}

export interface Week2Article {
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
}

export interface Week2ArticleContent {
  articleId: string;
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Week2SubscriptionProvider {
  listActiveSubscriptions(): Promise<Week2Subscription[]>;
}

export interface Week2FeedParser {
  parseFeedUrl(feedUrl: string): Promise<Week2ParsedFeed>;
  parseFeedText(feedText: string, sourceUrl?: string): Promise<Week2ParsedFeed>;
}

export interface Week2StoragePort {
  saveFeeds(feeds: Week2Feed[]): Promise<Week2Feed[]>;
  listFeeds(): Promise<Week2Feed[]>;

  saveArticles(input: {
    feedId: string;
    articles: Week2ParsedArticle[];
  }): Promise<Week2Article[]>;

  listArticles(query?: {
    feedId?: string;
    searchText?: string;
  }): Promise<Week2Article[]>;

  saveArticleContent(content: Week2ArticleContent): Promise<Week2ArticleContent>;
  getArticleContent(articleId: string): Promise<Week2ArticleContent | null>;

  updateFeedSyncStatus(input: {
    feedId: string;
    status: Week2FeedStatus;
    lastSyncedAt?: ISODateString;
    errorMessage?: string;
  }): Promise<void>;
}

export interface Week2SyncService {
  syncAll(): Promise<Week2SyncAllResult>;
  syncFeed(subscriptionId: string): Promise<Week2SyncFeedResult>;
}

export interface Week2SyncFeedResult {
  subscriptionId: string;
  feedId: string;
  status: 'succeeded' | 'failed' | 'partial';
  parsedCount: number;
  savedCount: number;
  skippedCount: number;
  startedAt: ISODateString;
  finishedAt: ISODateString;
  errorMessage?: string;
}

export interface Week2SyncAllResult {
  status: 'succeeded' | 'failed' | 'partial';
  totalSubscriptions: number;
  succeededCount: number;
  failedCount: number;
  totalSavedArticles: number;
  results: Week2SyncFeedResult[];
}

export interface Week2ReaderDataPort {
  listFeeds(): Promise<Week2Feed[]>;
  listArticles(query?: { feedId?: string; searchText?: string }): Promise<Week2Article[]>;
  getArticleContent(articleId: string): Promise<Week2ArticleContent | null>;
}

export interface Week2ReaderPipeline {
  runPipeline(input: {
    articleId: string;
    sourceHtml: string;
    url?: string;
  }): Promise<Week2ArticleContent>;
}
```

模块职责：

- T4 输出 `Week2Subscription[]`；
- T3 输出 `Week2ParsedFeed`；
- T2 提供 `Week2StoragePort`；
- T5 提供 `Week2SyncService`，并调用 T4 / T3 / T2；
- T5 同步时必须同时保存文章列表数据和最小 `Week2ArticleContent`。如果 T6 pipeline 暂未接入，先使用 `sourceHtml = contentHtml`、`cleanedHtml = contentHtml`、`canonicalMarkdown = contentText` 或从 HTML 简单提取文本，确保 `getArticleContent(articleId)` 不返回空；
- T7 通过 `Week2ReaderDataPort` 读取 feeds、articles、content；
- T6 若来不及实现真实 pipeline，至少保持 `sourceHtml / cleanedHtml / canonicalMarkdown` 字段一致。

Week 2 public export 入口统一为：

- T2 从 `src/core/database/index.ts` 导出 `Week2StoragePort` 实现或创建函数；
- T3 从 `src/features/feed/parser/index.ts` 导出 `Week2FeedParser` 实现或创建函数；
- T4 从 `src/features/feed/subscriptions/index.ts` 导出 `Week2SubscriptionProvider` 实现或创建函数；
- T5 从 `src/features/feed/sync/index.ts` 导出 `Week2SyncService` 实现或创建函数；
- T6 如接入主链路，从 `src/features/reader/pipeline/index.ts` 导出 `Week2ReaderPipeline` 实现或创建函数；
- T7 从 `src/features/reader/index.ts` 使用或封装 `Week2ReaderDataPort`。

Week 2 集成验收要求：

- 至少提供 1 个真实可访问的 Feed URL 作为测试输入；
- 运行 `syncAll()` 后，`listFeeds()` 能读到订阅源对应的 Feed；
- `listArticles()` 至少能读到 1 篇真实文章；
- 使用该文章 `articleId` 调用 `getArticleContent(articleId)` 时，能读到非空的 `sourceHtml / cleanedHtml / canonicalMarkdown`；
- T7 页面或测试入口能展示这篇真实文章的标题、来源、摘要/正文入口；
- T5 或集成分支必须在 `package.json` 提供可运行的 `npm run smoke:week2`，用于执行 `syncAll()` 并输出 feeds / articles / articleContent 的数量和首篇文章信息；
- 各模块可以内部使用 mock adapter，但对外函数名、字段名和返回结构必须完全符合本节接口，保证组长可以直接联调测试。

## 5B. Week 3 AI / Export / Usage Integration Contract

As of the latest `main`, the Feed / OPML / Sync / SQLite / Reader Pipeline / Article List main chain has been completed for MVP integration.

Completed main-chain items include:

- SQLite query, upsert, article dedupe, and unread count;
- read / saved article state;
- OPML import result display;
- subscription enable / disable / delete;
- real Feed sync from Reader UI through Electron IPC;
- persisted article content with `canonicalMarkdown`.

Week 3 must no longer reopen the main chain as a large task. The next integration focus is:

```text
AI Features -> Agent Runtime -> Provider -> Usage Record -> Markdown Export -> Final UI wiring
```

Week 3 branch rule:

```text
Every member must start from the latest main.
Do not continue Week 1 / Week 2 old branches.
Do not merge old branches back into Week 3 branches.
If old useful code exists, manually migrate only the necessary files in your own module.
```

Recommended commands:

```bash
git switch main
git pull origin main
git switch -c feature/TX-week3-topic
```

All Week 3 modules must use the following public contracts. Do not create another naming style for the same fields.

```ts
export type Week3ISODateString = string;

export interface Week3AgentArticleInput {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: Week3ISODateString;
  canonicalMarkdown: string;
}
```

Agent Runtime contract:

```ts
export type Week3AgentType = "summary" | "translation";

export type Week3AgentStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type Week3PersistedAgentStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type Week3AgentErrorCode =
  | "provider_error"
  | "network_error"
  | "prompt_error"
  | "timeout"
  | "cancelled"
  | "unknown_error";

export interface Week3RuntimeUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
}

export interface Week3RuntimeLLMResult {
  content: string;
  providerId: string;
  providerName: string;
  model: string;
  usage?: Week3RuntimeUsage;
  raw?: unknown;
}

export interface Week3AgentRunInput<TInput = Record<string, unknown>> {
  taskId: string;
  agentType: Week3AgentType;
  templateId: "summary.default" | "translation.default" | string;
  input: TInput;
  providerId: string;
  providerName?: string;
  model: string;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Week3AgentRunResult<TOutput = Week3RuntimeLLMResult> {
  taskId: string;
  status: "succeeded" | "failed" | "cancelled";
  output?: TOutput;
  errorCode?: Week3AgentErrorCode;
  errorMessage?: string;
}

export interface Week3AgentRuntime {
  runAgent<TInput, TOutput = Week3RuntimeLLMResult>(
    input: Week3AgentRunInput<TInput>
  ): Promise<Week3AgentRunResult<TOutput>>;
}
```

Prompt template contract:

```text
resources/prompts/summary.default.yaml
resources/prompts/translation.default.yaml
```

Prompt variables must come from `Week3AgentArticleInput` plus the agent-specific request fields below. Prompt text must not be hardcoded inside Summary or Translation business functions.

Provider contract:

```ts
export type Week3LLMPurpose =
  | "summary"
  | "translation"
  | "connection-test"
  | "other";

export type Week3LLMProviderKind = "openai-compatible" | "mock";

export interface Week3LLMProviderConfig {
  providerId: string;
  providerName: string;
  kind: Week3LLMProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export interface Week3LLMChatRequest {
  purpose: Week3LLMPurpose;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Week3LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage?: Week3RuntimeUsage;
  status: "succeeded";
  latencyMs: number;
  raw?: unknown;
}

export interface Week3LLMConnectionTestResult {
  providerId: string;
  providerName: string;
  model: string;
  status: "succeeded" | "failed";
  latencyMs?: number;
  errorMessage?: string;
}

export interface Week3LLMProvider {
  readonly config: Week3LLMProviderConfig;
  chat(request: Week3LLMChatRequest): Promise<Week3LLMChatResponse>;
  testConnection?(signal?: AbortSignal): Promise<Week3LLMConnectionTestResult>;
}
```

All model calls must use:

```ts
provider.chat(request);
response.content;
```

Usage event contract:

```ts
export interface Week3LLMUsageEvent {
  id: string;
  purpose: Week3LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: "succeeded" | "failed";
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  startedAt?: Week3ISODateString;
  finishedAt?: Week3ISODateString;
  latencyMs?: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface Week3LLMUsageSummary {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  estimatedTokens: number;
  byPurpose: Array<{ purpose: Week3LLMPurpose; calls: number; totalTokens: number }>;
  byProvider: Array<{ providerId: string; providerName: string; calls: number; totalTokens: number }>;
  byModel: Array<{ model: string; calls: number; totalTokens: number }>;
  recent: Week3LLMUsageEvent[];
}
```

Where available, `metadata` should include `taskId`, `articleId`, `contentId`, and `agentType`. Do not add separate top-level fields unless T2 updates the storage contract.

Summary contract:

```ts
export type Week3SummaryDetailLevel = "brief" | "standard";

export interface Week3SummaryRequest extends Week3AgentArticleInput {
  targetLanguage: "zh-CN" | "en-US" | string;
  detailLevel: Week3SummaryDetailLevel;
  regenerate?: boolean;
}

export interface Week3SummaryResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  detailLevel: Week3SummaryDetailLevel;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: Week3ISODateString;
  updatedAt: Week3ISODateString;
}
```

Translation contract:

```ts
export interface Week3TranslationRequest extends Week3AgentArticleInput {
  targetLanguage: string;
  sourceLanguage?: string;
  regenerate?: boolean;
}

export interface Week3TranslationResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  sourceLanguage?: string;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: Week3ISODateString;
  updatedAt: Week3ISODateString;
}
```

Single article Markdown export contract:

```ts
export interface Week3MarkdownExportData {
  title: string;
  url: string;
  author?: string;
  publishedAt?: Week3ISODateString;
  feedTitle?: string;
  canonicalMarkdown: string;
  summaryMarkdown?: string;
  translationMarkdown?: string;
  exportedAt?: Week3ISODateString;
}

export interface Week3MarkdownExportFile {
  fileName: string;
  markdown: string;
}
```

Reader UI integration port:

```ts
export interface Week3AgentUiPort {
  generateSummary(request: Week3SummaryRequest): Promise<Week3SummaryResult>;
  translateArticle(request: Week3TranslationRequest): Promise<Week3TranslationResult>;
  listUsageEvents?(): Promise<Week3LLMUsageEvent[]>;
  getUsageSummary?(): Promise<Week3LLMUsageSummary>;
  exportCurrentArticle(data: Week3MarkdownExportData): Promise<Week3MarkdownExportFile>;
}
```

Week 3 module responsibilities:

- T2 provides or maps storage for `Week3SummaryResult`, `Week3TranslationResult`, Agent task runs, and `Week3LLMUsageEvent`;
- T6 guarantees the selected article can provide non-empty `canonicalMarkdown`;
- T7 calls the AI / Export functions through `Week3AgentUiPort` and displays status / results / usage;
- T8 implements `Week3AgentRuntime`, prompt loading, prompt rendering, status, error, cancel, and retry behavior;
- T9 implements `Week3LLMProvider`, mock provider fallback, OpenAI-compatible provider config, usage event creation, and usage summary;
- T10 implements Summary using `Week3SummaryRequest` and `Week3SummaryResult`;
- T11 implements Translation and single article Markdown Export using the contracts above.

Week 3 acceptance criteria:

- `npm test` passes;
- `npm run build` passes;
- `npm run smoke:week2` still passes;
- packaged Windows zip can still be generated;
- Reader UI can still add/sync Feed, import OPML, show articles, mark read/save, enable/disable/delete subscriptions;
- Summary can run from the selected real article and display Markdown result, with mock fallback allowed;
- Translation can run from the selected real article and display Markdown result, with mock fallback allowed;
- every Summary / Translation call creates a usage event;
- Usage UI can display recent calls and basic token statistics;
- Export can produce one Markdown file for the current article, including title, source URL, `canonicalMarkdown`, and available Summary / Translation results.

## 6. Agent Runtime Rules

Agent Runtime 是 Summary 和 Translation 共用的 AI 任务运行层。

Runtime / UI 可使用完整状态：

```text
idle / queued / running / succeeded / failed / cancelled
```

数据库中的 AgentTaskRun 建议只存：

```text
queued / running / succeeded / failed / cancelled
```

说明：

- `idle` 表示当前没有任务或任务尚未开始，通常不需要入库；
- timeout 不建议作为单独状态，统一记录为 `status = failed`，并使用 `errorCode = "timeout"`；
- Summary、Translation、Usage、Reader UI 必须使用同一套状态口径。

## 7. LLM Provider Rules

所有模型调用必须走统一 Provider，不要在 Summary 或 Translation 中直接写某个模型服务的请求逻辑。

统一调用形式：

```ts
provider.chat(request);
response.content;
```

Provider 配置必须支持：

- providerId / providerName；
- baseUrl；
- apiKey 或 apiKeyEnv；
- model；
- OpenAI-compatible API；
- Mock Provider。

真实 API key 不允许提交到仓库。示例中使用：

```text
<your-api-key>
```

不要写真实 key 或 `sk-...`。

## 8. Usage Record Rules

每次真实或 mock 模型调用都应形成 usage record / usage event。

Usage 字段以 AI 小组当前统一口径为准：

```ts
purpose: "summary" | "translation" | "connection-test" | "other";
providerId: string;
providerName: string;
model: string;
status: "succeeded" | "failed";
promptTokens?: number;
completionTokens?: number;
totalTokens?: number;
estimated?: boolean;
startedAt?: string;
finishedAt?: string;
latencyMs?: number;
errorMessage?: string;
requestId?: string;
metadata?: Record<string, unknown>;
```

注意区分：

- `AgentTaskRun` 是 AI 任务运行状态；
- `LLMUsageEvent` 是一次模型请求记录；
- Summary / Translation 只负责触发调用和消费结果，Usage 汇总展示由 usage 模块负责。

## 9. Prompt Rules

Prompt 不要硬编码在业务函数内部。

建议使用独立模板文件，例如：

```text
resources/prompts/summary.default.yaml
resources/prompts/translation.default.yaml
```

Prompt 模板应明确：

- agentType；
- system prompt；
- user prompt；
- 输入变量；
- 输出格式；
- 语言和长度要求。

Summary 和 Translation 可以先使用 mock prompt / mock provider，接口稳定后再接真实模型。

## 10. Local-first And Privacy Rules

项目必须保持本地优先：

- 不要求注册、登录或订阅；
- 不主动上传用户订阅源、文章、笔记或阅读记录；
- 文章、AI 结果、usage 记录优先保存在本地 SQLite；
- 真实 API key 不提交仓库；
- 示例配置必须脱敏；
- 跨平台路径处理使用 Node / Electron 标准 API，不硬编码个人电脑路径。

## 11. Parallel Development Rules

各模块可以先用 mock 数据并行开发，不需要等待上下游全部完成。

示例：

- 阅读器先用 mock article；
- Summary / Translation 先用 mock text；
- Sync 先用 mock Feed 解析结果；
- Export 先用 mock Markdown；
- Usage 先用 mock usage event；
- Provider 先用 mock provider。

接口对齐后，再逐步替换为真实模块。

## 12. PR And Review Rules

每个 PR 必须说明：

- 本次提交做了什么；
- 影响哪些模块；
- 是否修改公共接口；
- 如何验证；
- 当前是否为 mock / 草案 / 正式实现；
- 后续需要谁配合。

PR 合并前检查：

- 是否基于最新 main；
- 是否保留 main 中已有骨架；
- 是否把代码放到正确目录；
- 是否使用统一字段命名；
- 是否提交了真实 API key 或个人路径；
- 是否破坏其他成员模块；
- 是否有必要的截图、测试说明或文档说明。

## 13. Conflict Resolution

如果模块文档、Issue、PR 和本文件出现冲突，优先级如下：

1. 组长最新确认的公共接口；
2. 本 `AGENTS.md`；
3. main 分支当前项目骨架；
4. 对应模块最新 PR 文档；
5. 早期 Issue 草案。

发现冲突时，不要私自改成另一套命名。应在 Issue / PR 评论中说明冲突点，并等待组长确认统一口径。
