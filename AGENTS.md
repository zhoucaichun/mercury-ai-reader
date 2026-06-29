# Prism Reader - AGENTS.md

> 本文档是 Prism Reader 项目的公共开发约束、接口契约和集成记录文档。
> 仓库历史名称仍为 `mercury-ai-reader`，早期文档中出现的 Mercury 均指向本项目的前期名称；最终产品展示名称统一为 Prism Reader。

每位成员使用 AI 编写代码、修改接口或整理文档前，应先让 AI 阅读本文件，再阅读自己负责模块的代码、Issue、PR 和功能文档。

## 1. 项目目标

Prism Reader 是一个本地优先、跨平台、支持 AI 摘要和翻译的 Feed 阅读器。

项目目标：

- 支持 RSS / Atom Feed 添加、解析和同步；
- 支持 OPML 批量导入订阅源；
- 支持真实文章列表、正文内容、已读状态、收藏状态和订阅源状态的本地保存；
- 支持正文清洗，形成 `sourceHtml`、`cleanedHtml` 和 `canonicalMarkdown`；
- 支持 AI 摘要、AI 翻译、划词翻译和 AI 历史结果；
- 支持 OpenAI-compatible 模型配置、多个模型配置保存、摘要/翻译默认模型选择；
- 支持 LLM Usage 记录和统计；
- 支持单篇 Markdown 导出；
- 不要求登录，不主动采集用户数据。

## 2. 当前技术栈

当前技术栈固定为：

- Electron：跨平台桌面应用，支持 Windows / macOS / Linux；
- React：前端 UI；
- TypeScript：统一类型和接口；
- Vite：前端开发和构建工具；
- SQLite / better-sqlite3：本地优先数据存储；
- JSON fallback：SQLite native 模块不可用时的本地存储兜底；
- rss-parser：RSS / Atom Feed 解析；
- OpenAI-compatible API：统一接入远程模型和本地模型；
- Electron `safeStorage`：桌面端 API Key 加密保存；
- lucide-react：界面图标；
- GitHub Issues / Pull Requests / Releases：协作、审查和打包发布。

如需调整主技术栈，必须先说明原因、影响范围和替代方案，经组长确认后再修改。

## 3. 主目录结构

以当前 `main` 分支为准：

```text
mercury-ai-reader/
├─ electron/                         Electron 主进程、preload、IPC、本地安全存储
├─ resources/
│  └─ prompts/                       Summary / Translation prompt 模板
├─ src/
│  ├─ app/                           React 应用入口
│  ├─ core/                          公共类型、数据库、stores、adapter
│  ├─ features/
│  │  ├─ feed/
│  │  │  ├─ parser/                  RSS / Atom 解析
│  │  │  ├─ opml/                    OPML 解析
│  │  │  ├─ subscriptions/           订阅源管理
│  │  │  └─ sync/                    同步、去重、入库
│  │  ├─ reader/
│  │  │  └─ pipeline/                内容清洗 pipeline
│  │  ├─ agent/
│  │  │  ├─ runtime/                 Agent Runtime
│  │  │  ├─ prompts/                 Prompt 加载与渲染
│  │  │  ├─ providers/               LLM Provider
│  │  │  ├─ summary/                 Summary Agent
│  │  │  └─ translation/             Translation Agent
│  │  ├─ usage/                      LLM Usage
│  │  └─ export/                     单篇 Markdown 导出
│  └─ styles/                        全局样式
├─ docs/
│  ├─ features/                      模块设计文档
│  └─ reports/                       阶段报告和验证记录
├─ task-documents/                   正式项目计划和技术说明
├─ test-opml/                        OPML 导入测试文件
├─ test/                             Feed parser 测试夹具
├─ scripts/                          smoke / regression 辅助脚本
└─ package.json
```

目录规则：

- 不新增平行的 `src/feed/`、`src/reader/`、`src/features/llm/` 目录；
- Provider 归入 `src/features/agent/providers/`；
- Usage 归入 `src/features/usage/`；
- Prompt 模板资源放在 `resources/prompts/`；
- 功能文档放在 `docs/features/`；
- 阶段报告放在 `docs/reports/`；
- 正式项目计划和技术说明放在 `task-documents/`；
- `.docx`、`.DS_Store`、构建产物、release 产物不提交仓库。

## 4. 模块边界

- Feed / OPML / Sync 负责订阅源、Feed 解析、文章同步和入库，不直接实现阅读器 UI；
- Reader 负责文章列表、阅读页、阅读样式和交互入口，不直接实现 Feed 解析或模型调用；
- Reader Pipeline 负责 `sourceHtml -> cleanedHtml -> canonicalMarkdown`；
- Summary / Translation 不直接绑定某个模型服务，必须通过统一 Provider 或 Electron AI IPC；
- Usage 统计通过 usage event 统一记录；
- Export 只做单篇 Markdown 导出；
- API Key 只通过 Electron 安全存储或开发 fallback 保存，不写入仓库。

## 5. 核心数据约定

字段命名统一使用 camelCase。

时间字段统一使用 ISO string：

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

`canonicalMarkdown` 是阅读器、Summary、Translation 和 Export 的统一正文输入。

摘要结果字段统一：

```ts
detailLevel: "brief" | "standard";
markdown: string;
```

如果数据库内部字段名不同，需要在数据模型文档或代码注释中说明映射关系。

## 6. Feed / OPML / Sync 主链路契约

主链路为：

```text
Feed / OPML -> Sync -> Local Storage -> Article List -> Reader Content
```

当前实现应保证：

- 添加 Feed URL 可以同步真实 RSS / Atom；
- 留空同步时使用默认真实订阅源；
- OPML 导入异步执行，逐步反馈导入和同步进度；
- 同步过程需要防止重复 Feed 和重复文章；
- 本地存储优先使用 SQLite，失败时使用 JSON fallback；
- `getArticleContent(articleId)` 必须返回非空 `sourceHtml / cleanedHtml / canonicalMarkdown`；
- 已读、未读、收藏、订阅源启用/停用/删除状态需要可持久化。

核心类型口径：

```ts
export type ISODateString = string;

export type Week2FeedStatus = "ready" | "syncing" | "error";
export type Week2ArticleReadState = "unread" | "reading" | "saved";
export type Week2SubscriptionStatus = "active" | "disabled" | "error";
export type Week2SubscriptionSource = "manual" | "opml" | "mock";

export interface Week2Feed {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  unreadCount: number;
  status: Week2FeedStatus;
  lastSyncedAt?: ISODateString;
  isEnabled?: boolean;
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
  isRead?: boolean;
  isStarred?: boolean;
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
```

`mock` 仅作为内部 fallback / 测试 source，不应作为最终产品页面文案展示。

## 7. AI / Provider / Usage / Export 契约

AI 功能主链路为：

```text
Reader Article -> canonicalMarkdown -> Provider / Runtime -> Summary / Translation -> Usage -> UI / Export
```

当前实现应保证：

- Summary 和 Translation 使用当前真实文章的 `canonicalMarkdown`；
- Provider 通过 OpenAI-compatible `chat` 接口调用；
- 支持模型连接测试；
- 支持保存多个模型配置；
- 支持摘要和翻译分别选择默认模型；
- 支持删除已保存模型配置；
- 桌面端 API Key 使用 Electron `safeStorage` 加密保存；
- 支持 streaming 进度反馈；
- 每次 AI 调用形成 usage event；
- 已有摘要或译文再次点击时优先展示历史结果，不重复调用模型；
- Export 可以导出当前文章 Markdown，并可包含摘要和译文。

关键 UI 端口口径：

```ts
export interface Week3AgentUiPort {
  generateSummary(request: Week3SummaryRequest): Promise<Week3SummaryResult>;
  streamSummary?(
    request: Week3SummaryRequest,
    onDelta: (delta: string) => void
  ): Promise<Week3SummaryResult>;

  translateArticle(request: Week3TranslationRequest): Promise<Week3TranslationResult>;
  streamTranslation?(
    request: Week3TranslationRequest,
    onDelta: (delta: string) => void
  ): Promise<Week3TranslationResult>;

  translateText?(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<string>;

  streamText?(
    text: string,
    targetLanguage: string,
    sourceLanguage: string | undefined,
    onDelta: (delta: string) => void
  ): Promise<string>;

  testConnection?(): Promise<Week3LLMConnectionTestResult>;
  listUsageEvents?(): Promise<Week3LLMUsageEvent[]>;
  getUsageSummary?(): Promise<Week3LLMUsageSummary>;
  exportCurrentArticle(data: Week3MarkdownExportData): Promise<Week3MarkdownExportFile>;
}
```

Usage 字段口径：

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

## 8. Agent Runtime 状态规则

Runtime / UI 可使用完整状态：

```text
idle / queued / running / succeeded / failed / cancelled
```

数据库中的任务运行记录建议只存：

```text
queued / running / succeeded / failed / cancelled
```

说明：

- `idle` 表示当前没有任务或任务尚未开始，通常不需要入库；
- timeout 不单独作为状态，统一记录为 `status = failed`，并使用 `errorCode = "timeout"`；
- Summary、Translation、Usage、Reader UI 使用同一套状态口径。

## 9. Prompt 规则

Prompt 不硬编码在业务函数内部。

模板资源放在：

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

## 10. 本地优先与隐私规则

- 不要求注册、登录或订阅；
- 不主动上传用户订阅源、文章、笔记或阅读记录；
- 文章、AI 结果、usage 记录优先保存在本地；
- 桌面端 API Key 使用 Electron `safeStorage` 加密保存；
- 真实 API Key 不提交仓库；
- 示例配置必须脱敏；
- 跨平台路径处理使用 Node / Electron 标准 API，不硬编码个人电脑路径；
- SQLite native 模块不可用时允许使用 JSON fallback，但页面不应把 fallback 暴露成“测试功能”。

## 11. 项目迭代记录

本项目保留一定工作过程记录，便于老师查看团队协作和集成过程。

### Week 1：项目骨架与接口草案

完成内容：

- Electron + React + TypeScript + Vite 项目骨架；
- 模块目录和公共接口初版；
- Reader UI 静态原型和交互审查清单；
- Feed Parser、数据模型、Agent Runtime、Provider、Summary、Translation 等模块文档；
- GitHub Issues / PR 协作流程。

### Week 2：Feed / OPML / Sync / 本地存储 / 文章列表主链路

完成内容：

- 真实 RSS / Atom 解析；
- 默认 Feed 同步；
- OPML 解析和订阅源管理；
- SQLite stores 和 Week2StorageAdapter；
- Electron IPC 接入前端同步；
- `npm run smoke:week2` 主链路验证。

### Week 3：AI / Usage / Export / Reader 集成

完成内容：

- AI 摘要和翻译接入阅读页；
- Provider 配置、连接测试、多模型配置保存；
- Usage 事件记录和统计；
- Markdown 导出；
- 阅读器 UI 产品化：主题、标签、笔记、高亮、阅读状态、AI 历史；
- streaming 生成反馈；
- API Key 本地加密保存。

### Week 4：最终修复、文档、打包和 Release

完成内容：

- 修复 OPML 大文件导入和大量订阅源同步卡顿问题；
- 修复重复 Feed 导入和历史重复订阅源清理；
- 整理 README、功能文档、技术栈和集成计划；
- 清理内部任务草稿；
- 生成并上传 Windows Release 包；
- 最终验证 `npm test`、`npm run build`、`npm run smoke:week2`、`npm run pack:win:zip`。

## 12. PR 与审查规则

后续如继续维护项目，PR 应说明：

- 本次修改做了什么；
- 影响哪些模块；
- 是否修改公共接口；
- 如何验证；
- 是否涉及真实 API key 或本地路径；
- 是否影响打包和 Release。

合并前检查：

- 是否基于最新 `main`；
- 是否保留现有项目骨架；
- 是否放在正确目录；
- 是否使用统一字段命名；
- 是否提交真实 API key、个人路径、`.docx` 或 `.DS_Store`；
- 是否通过必要测试。

## 13. 冲突处理优先级

如果模块文档、早期 Issue、PR 和本文件出现冲突，优先级如下：

1. 组长最新确认的公共接口；
2. 本 `AGENTS.md`；
3. 当前 `main` 分支代码；
4. `README.md` 和正式 `task-documents/`；
5. 对应模块最新功能文档；
6. 早期 Issue 草案。

发现冲突时，不要私自改成另一套命名，应说明冲突点并统一口径后再修改。
