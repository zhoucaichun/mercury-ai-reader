# Mercury AI Reader — 数据模型与本地存储设计（T2）

> 版本：v2.0（Week 2 对齐版）
> 负责人：T2 林杨
> 参考：mercury (macOS/Swift/GRDB) 数据模型 + AGENTS.md 统一规范
> 技术栈：Electron + React + TypeScript + Vite + SQLite (better-sqlite3)

---

## 术语映射（内部命名 ↔ AGENTS.md 对外命名）

本文档内部沿用 Mercury 源码命名，通过类型别名对齐 AGENTS.md 规定的对外接口命名。
所有外部模块（T3/T5/T6/T7/T8/T9/T10/T11）应使用对外名称。

| 内部类型（SQLite / Store 层） | 对外类型别名（AGENTS.md 规范） | Week2 接口字段 | 说明 |
|-------------------------------|-------------------------------|---------------|------|
| `Entry` | **`Article`** | `Week2Article` | Feed 中的一篇文章 |
| `Content` | **`ArticleContent`** | `Week2ArticleContent` | 文章的三层内容 |
| `Content.html` | `ArticleContent.sourceHtml` | `sourceHtml` | L1 原始 HTML |
| `Content.cleanedHtml` | `ArticleContent.cleanedHtml` | `cleanedHtml` | L2 清洗后 HTML |
| `Content.markdown` | `ArticleContent.canonicalMarkdown` | `canonicalMarkdown` | L3 规范 Markdown |
| `Feed` | `Feed`（不变） | `Week2Feed` | 订阅源 |
| `SyncLog` | **`FeedSyncStatus`** | — | Feed 同步的执行日志 |
| `AgentTaskRun` | **`AITaskRun`** | — | 一次 AI 操作的作业记录 |
| `LLMUsageEvent` | `LLMUsageEvent`（不变） | — | 一次 LLM API 请求的用量记录 |

### ID 类型映射

- 内部 SQLite 使用 `INTEGER`（`number`）
- Week2 对外接口统一使用 `string`
- 转换在 `Week2StorageAdapter` 层完成

### 状态值映射

| 类型 | 内部值 | AGENTS.md 规范 |
|------|--------|---------------|
| AgentTaskRunStatus | `queued / running / succeeded / failed / cancelled` | 同左（不存 idle；timeout → `failed` + `errorCode='timeout'`） |
| SummaryDetailLevel | `brief / standard` | 同左 |
| LLMUsageEvent status | `succeeded / failed` | 同左 |

---

## 一、总体设计思路

### 1.1 设计原则

1. **本地优先**：所有数据存储在用户本地 SQLite 文件中，不依赖网络服务。
2. **三层内容**：每篇文章保留 source HTML（原始抓取）、cleaned HTML（Readability 清洗）、canonical Markdown（结构化标记），逐层递减信息量但递增可用性。
3. **用量可追踪**：每次 LLM 请求都记录为一条 LLMUsageEvent，可关联到具体的 AITaskRun，支持按 Provider/Model/时间/任务类型聚合统计。
4. **幂等与去重**：Feed 同步通过 `(feedId, guid)` 和 `(feedId, url)` 联合唯一索引去重；Summary 按 `(entryId, targetLanguage, detailLevel)` 唯一约束；Translation 按 `(entryId, targetLanguage, sourceContentHash, segmenterVersion)` 唯一约束。
5. **版本化**：Content 表的 readability 和 markdown 转换规则版本独立记录，以便后续升级规则时可选择性失效旧数据。
6. **软删除**：Entry 使用 `isDeleted` 标记而非物理删除，保留数据完整性。
7. **同步可追溯**：每次 Feed 同步的执行状态、新增条目数、错误信息记录在 SyncLog 表中，支持"单个订阅源失败不影响其他"的同步策略。

### 1.2 ER 关系总览

```
Feed (1) ──→ (N) Entry
Feed (1) ──→ (N) SyncLog
Entry (1) ──→ (1) Content           [sourceHTML / cleanedHTML / markdown]
Entry (1) ──→ (N) SummaryResult
Entry (1) ──→ (N) TranslationResult
Entry (1) ──→ (N) AgentTaskRun
AgentTaskRun (1) ──→ (N) LLMUsageEvent

AgentProviderProfile (1) ──→ (N) AgentModelProfile
AgentModelProfile (1) ──→ (N) AgentTaskRun (optional FK)
AgentModelProfile (1) ──→ (N) LLMUsageEvent (optional FK)
```

---

## 二、实体定义（TypeScript 类型 + SQLite 表结构）

### 2.1 Feed（订阅源）

**用途**：存储 RSS/Atom 订阅源元信息。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `title` | `string \| null` | `TEXT` | | 订阅源标题 |
| `feedUrl` | `string` | `TEXT` | NOT NULL, UNIQUE INDEX | 订阅源 URL |
| `siteUrl` | `string \| null` | `TEXT` | | 站点主页 URL |
| `description` | `string \| null` | `TEXT` | | 订阅源描述（RSS/Atom description） |
| `feedParserVersion` | `number \| null` | `INTEGER` | | 解析器版本号，用于兼容性标记 |
| `lastFetchedAt` | `string \| null` | `TEXT` | ISO 8601 | 上次同步时间（快速引用，详细记录见 SyncLog） |
| `createdAt` | `string` | `TEXT` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |

```sql
CREATE TABLE feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  feedUrl TEXT NOT NULL,
  siteUrl TEXT,
  description TEXT,
  feedParserVersion INTEGER,
  lastFetchedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_feed_feedUrl ON feed(feedUrl);
```

```ts
interface Feed {
  id: number;
  title: string | null;
  feedUrl: string;
  siteUrl: string | null;
  description: string | null;
  feedParserVersion: number | null;
  lastFetchedAt: string | null;
  createdAt: string;
}
```

---

### 2.2 Entry（文章）

**用途**：存储从 Feed 同步来的文章元信息。使用 `isDeleted` 软删除，关联的 Content / Summary / Translation 通过 `ON DELETE CASCADE` 联级删除。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `feedId` | `number` | `INTEGER` | NOT NULL, FK→feed(id) ON DELETE CASCADE | 所属订阅源 |
| `guid` | `string \| null` | `TEXT` | | Feed 全局唯一标识 |
| `url` | `string \| null` | `TEXT` | | 文章原始链接 |
| `title` | `string \| null` | `TEXT` | | 文章标题 |
| `author` | `string \| null` | `TEXT` | | 作者 |
| `publishedAt` | `string \| null` | `TEXT` | ISO 8601 | 发布时间 |
| `summary` | `string \| null` | `TEXT` | | Feed 自带的摘要 |
| `isRead` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | 是否已读 |
| `isStarred` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | 是否收藏 |
| `isDeleted` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | 软删除标记 |
| `createdAt` | `string` | `TEXT` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 入库时间 |

```sql
CREATE TABLE entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedId INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
  guid TEXT,
  url TEXT,
  title TEXT,
  author TEXT,
  publishedAt TEXT,
  summary TEXT,
  isRead INTEGER NOT NULL DEFAULT 0,
  isStarred INTEGER NOT NULL DEFAULT 0,
  isDeleted INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_entry_feed_guid ON entry(feedId, guid);
CREATE UNIQUE INDEX idx_entry_feed_url ON entry(feedId, url);
CREATE INDEX idx_entry_feedId ON entry(feedId);
CREATE INDEX idx_entry_isRead_publishedAt ON entry(isRead, publishedAt, createdAt);
CREATE INDEX idx_entry_feed_publishedAt ON entry(feedId, publishedAt, createdAt);
CREATE INDEX idx_entry_publishedAt ON entry(publishedAt, createdAt);
```

```ts
interface Entry {
  id: number;
  feedId: number;
  guid: string | null;
  url: string | null;
  title: string | null;
  author: string | null;
  publishedAt: string | null;
  summary: string | null;
  isRead: boolean;
  isStarred: boolean;
  isDeleted: boolean;
  createdAt: string;
}
```

---

### 2.3 SyncLog（同步日志）

**用途**：记录每次 Feed 同步的执行状态。是同步调度（T5）和同步异常处理的核心数据基础。与 `Feed.lastFetchedAt` 配合使用：`lastFetchedAt` 提供快速判断"上次是否成功"，`SyncLog` 提供详细的执行历史和错误追踪。

**设计要求**：这是任务文档中多次强调的能力——"记录同步状态和错误"、"记录最近同步时间"、"单个订阅源失败不影响其他"、"同步成功和失败状态清楚可见"。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `feedId` | `number` | `INTEGER` | NOT NULL, FK→feed(id) ON DELETE CASCADE | 所属订阅源 |
| `status` | `string` | `TEXT` | NOT NULL | 状态: 'running' \| 'succeeded' \| 'failed' \| 'partial' |
| `newEntriesCount` | `number` | `INTEGER` | NOT NULL, DEFAULT 0 | 本次同步新增文章数 |
| `errorMessage` | `string \| null` | `TEXT` | | 人类可读的错误信息 |
| `errorCode` | `string \| null` | `TEXT` | | 机器可读错误码（如 'network_error' / 'parse_error'） |
| `startedAt` | `string` | `TEXT` | NOT NULL | 同步开始时间 |
| `finishedAt` | `string \| null` | `TEXT` | | 同步结束时间 |
| `createdAt` | `string` | `TEXT` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 记录创建时间 |

```sql
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedId INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  newEntriesCount INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  errorCode TEXT,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sync_log_feedId ON sync_log(feedId);
CREATE INDEX idx_sync_log_startedAt ON sync_log(startedAt);
CREATE INDEX idx_sync_log_status ON sync_log(status);
```

```ts
type SyncStatus = 'running' | 'succeeded' | 'failed' | 'partial';

interface SyncLog {
  id: number;
  feedId: number;
  status: SyncStatus;
  newEntriesCount: number;
  errorMessage: string | null;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}
```

---

### 2.4 Content（文章内容 — 三层内容核心表）

**用途**：存储文章的三层内容：source HTML → cleaned HTML → canonical Markdown。这是整个阅读器和 AI 功能的数据基础。

**三层内容说明**：

| 层级 | 字段 | 来源 | 用途 |
|------|------|------|------|
| L1 | `html` | undici 抓取原始 HTML | 归档、调试、降级阅读 |
| L2 | `cleanedHtml` | @mozilla/readability 解析 | 阅读器展示、主题渲染 |
| L3 | `markdown` | turndown 转换 cleanedHtml | AI 输入（Summary/Translation）、导出 |

**写入顺序约束**（T5 → T6 调用链）：

```
T5 (Sync) 抓取 HTML
  → ContentStore.upsertFetchedSource(entryId, html, ...)     // 写入 L1
  → T6 (Reader Pipeline) 清洗
      → ContentStore.upsertCleanedArtifacts(entryId, ...)    // 写入 L2
  → T6 (Reader Pipeline) 转换
      → ContentStore.upsertMarkdown(entryId, ...)            // 写入 L3
```

**重要约定**：`upsertCleanedArtifacts` 和 `upsertMarkdown` 依赖于已存在的 Content 记录（由 `upsertFetchedSource` 创建）。如果对应 entryId 的 Content 记录不存在，这两个方法应抛出明确错误。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `entryId` | `number` | `INTEGER` | NOT NULL, UNIQUE, FK→entry(id) ON DELETE CASCADE | 所属文章（1:1） |
| `html` | `string \| null` | `TEXT` | | L1: 抓取的原始 HTML |
| `cleanedHtml` | `string \| null` | `TEXT` | | L2: Readability 清洗后的 HTML |
| `readabilityTitle` | `string \| null` | `TEXT` | | Readability 提取的标题 |
| `readabilityByline` | `string \| null` | `TEXT` | | Readability 提取的作者 |
| `readabilityVersion` | `number \| null` | `INTEGER` | | Readability 提取规则版本号 |
| `markdown` | `string \| null` | `TEXT` | | L3: 规范 Markdown |
| `markdownVersion` | `number \| null` | `INTEGER` | | Markdown 转换规则版本号 |
| `displayMode` | `string` | `TEXT` | NOT NULL, DEFAULT 'web' | 展示模式: 'web' \| 'cleaned' |
| `documentBaseUrl` | `string \| null` | `TEXT` | | 用于解析相对路径的基础 URL |
| `pipelineType` | `string` | `TEXT` | NOT NULL, DEFAULT 'default' | 管线类型: 'default' \| 扩展 |
| `resolvedIntermediateContent` | `string \| null` | `TEXT` | | 管线中间态内容 |
| `createdAt` | `string` | `TEXT` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |

```sql
CREATE TABLE content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  html TEXT,
  cleanedHtml TEXT,
  readabilityTitle TEXT,
  readabilityByline TEXT,
  readabilityVersion INTEGER,
  markdown TEXT,
  markdownVersion INTEGER,
  displayMode TEXT NOT NULL DEFAULT 'web',
  documentBaseUrl TEXT,
  pipelineType TEXT NOT NULL DEFAULT 'default',
  resolvedIntermediateContent TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_content_entryId ON content(entryId);
```

```ts
type ContentDisplayMode = 'web' | 'cleaned';
type ReaderPipelineType = 'default' | string;

interface Content {
  id: number;
  entryId: number;
  html: string | null;
  cleanedHtml: string | null;
  readabilityTitle: string | null;
  readabilityByline: string | null;
  readabilityVersion: number | null;
  markdown: string | null;
  markdownVersion: number | null;
  displayMode: ContentDisplayMode;
  documentBaseUrl: string | null;
  pipelineType: ReaderPipelineType;
  resolvedIntermediateContent: string | null;
  createdAt: string;
}
```

---

### 2.5 SummaryResult（AI 摘要结果）

**用途**：存储 AI 对某篇文章生成的摘要。同一篇文章 + 同一目标语言 + 同一详细级别只保留最新一条。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `taskRunId` | `number` | `INTEGER` | NOT NULL, PK, FK→agent_task_run(id) ON DELETE CASCADE | 关联任务运行 |
| `entryId` | `number` | `INTEGER` | NOT NULL, FK→entry(id) ON DELETE CASCADE | 所属文章 |
| `targetLanguage` | `string` | `TEXT` | NOT NULL | 目标语言代码 (如 'zh-CN') |
| `detailLevel` | `string` | `TEXT` | NOT NULL | 详细级别: 'short' \| 'medium' \| 'detailed' |
| `outputLanguage` | `string` | `TEXT` | NOT NULL | 输出语言代码 |
| `text` | `string` | `TEXT` | NOT NULL | 摘要文本 |
| `createdAt` | `string` | `TEXT` | NOT NULL | 创建时间 |
| `updatedAt` | `string` | `TEXT` | NOT NULL | 更新时间 |

```sql
CREATE TABLE summary_result (
  taskRunId INTEGER NOT NULL REFERENCES agent_task_run(id) ON DELETE CASCADE,
  entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  targetLanguage TEXT NOT NULL,
  detailLevel TEXT NOT NULL,
  outputLanguage TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (taskRunId)
);
CREATE UNIQUE INDEX idx_summary_slot ON summary_result(entryId, targetLanguage, detailLevel);
CREATE INDEX idx_summary_entryId ON summary_result(entryId);
CREATE INDEX idx_summary_updatedAt ON summary_result(updatedAt);
```

```ts
type SummaryDetailLevel = 'short' | 'medium' | 'detailed';

interface SummaryResult {
  taskRunId: number;
  entryId: number;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
  outputLanguage: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.6 TranslationResult（AI 翻译结果）

**用途**：存储 AI 翻译结果，包含分段译文。通过 `sourceContentHash` + `segmenterVersion` 判断是否需要重新翻译。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `taskRunId` | `number` | `INTEGER` | NOT NULL, PK, FK→agent_task_run(id) ON DELETE CASCADE | 关联任务运行 |
| `entryId` | `number` | `INTEGER` | NOT NULL, FK→entry(id) ON DELETE CASCADE | 所属文章 |
| `targetLanguage` | `string` | `TEXT` | NOT NULL | 目标语言代码 |
| `sourceContentHash` | `string` | `TEXT` | NOT NULL | 源内容哈希（用于判断内容是否变更） |
| `segmenterVersion` | `string` | `TEXT` | NOT NULL | 分段器版本号 |
| `outputLanguage` | `string` | `TEXT` | NOT NULL | 输出语言代码 |
| `runStatus` | `string` | `TEXT` | NOT NULL, DEFAULT 'running' | 运行状态: 'running' \| 'succeeded' |
| `createdAt` | `string` | `TEXT` | NOT NULL | 创建时间 |
| `updatedAt` | `string` | `TEXT` | NOT NULL | 更新时间 |

```sql
CREATE TABLE translation_result (
  taskRunId INTEGER NOT NULL REFERENCES agent_task_run(id) ON DELETE CASCADE,
  entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  targetLanguage TEXT NOT NULL,
  sourceContentHash TEXT NOT NULL,
  segmenterVersion TEXT NOT NULL,
  outputLanguage TEXT NOT NULL,
  runStatus TEXT NOT NULL DEFAULT 'running',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (taskRunId)
);
CREATE UNIQUE INDEX idx_translation_slot ON translation_result(entryId, targetLanguage, sourceContentHash, segmenterVersion);
CREATE INDEX idx_translation_entryId ON translation_result(entryId);
CREATE INDEX idx_translation_updatedAt ON translation_result(updatedAt);
```

**TranslationSegment（翻译段落）**：

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `taskRunId` | `number` | `INTEGER` | NOT NULL, FK→translation_result(taskRunId) ON DELETE CASCADE | 关联翻译结果 |
| `sourceSegmentId` | `string` | `TEXT` | NOT NULL | 源段落标识 |
| `orderIndex` | `number` | `INTEGER` | NOT NULL | 段落顺序 |
| `sourceTextSnapshot` | `string \| null` | `TEXT` | | 源文本快照 |
| `translatedText` | `string` | `TEXT` | NOT NULL | 译文 |
| `createdAt` | `string` | `TEXT` | NOT NULL | 创建时间 |
| `updatedAt` | `string` | `TEXT` | NOT NULL | 更新时间 |

```sql
CREATE TABLE translation_segment (
  taskRunId INTEGER NOT NULL REFERENCES translation_result(taskRunId) ON DELETE CASCADE,
  sourceSegmentId TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  sourceTextSnapshot TEXT,
  translatedText TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_translation_segment_unique ON translation_segment(taskRunId, sourceSegmentId);
CREATE INDEX idx_translation_segment_order ON translation_segment(taskRunId, orderIndex);
```

```ts
type TranslationRunStatus = 'running' | 'succeeded';
type TranslationSegmentType = 'p' | 'ul' | 'ol';

interface TranslationResult {
  taskRunId: number;
  entryId: number;
  targetLanguage: string;
  sourceContentHash: string;
  segmenterVersion: string;
  outputLanguage: string;
  runStatus: TranslationRunStatus;
  createdAt: string;
  updatedAt: string;
}

interface TranslationSegment {
  taskRunId: number;
  sourceSegmentId: string;
  orderIndex: number;
  sourceTextSnapshot: string | null;
  translatedText: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.7 AgentTaskRun（AI 任务运行记录）

**用途**：记录每次 AI 任务的执行情况，是所有 AI 操作（摘要、翻译）的"作业记录"。关联到具体的 Entry、Provider、Model。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `entryId` | `number` | `INTEGER` | NOT NULL, FK→entry(id) ON DELETE CASCADE | 所属文章 |
| `taskType` | `string` | `TEXT` | NOT NULL | 任务类型: 'summary' \| 'translation' |
| `status` | `string` | `TEXT` | NOT NULL | 状态: 'queued' \| 'running' \| 'succeeded' \| 'failed' \| 'timedOut' \| 'cancelled' |
| `agentProfileId` | `number \| null` | `INTEGER` | FK→agent_profile(id) ON DELETE SET NULL | Agent 配置（暂不实现） |
| `providerProfileId` | `number \| null` | `INTEGER` | FK→agent_provider_profile(id) ON DELETE SET NULL | Provider 配置 |
| `modelProfileId` | `number \| null` | `INTEGER` | FK→agent_model_profile(id) ON DELETE SET NULL | Model 配置 |
| `promptVersion` | `string \| null` | `TEXT` | | Prompt 模板版本 |
| `targetLanguage` | `string \| null` | `TEXT` | | 目标语言代码 |
| `templateId` | `string \| null` | `TEXT` | | 模板 ID |
| `templateVersion` | `string \| null` | `TEXT` | | 模板版本 |
| `runtimeParameterSnapshot` | `string \| null` | `TEXT` | JSON string | 运行时参数快照（JSON） |
| `errorMessage` | `string \| null` | `TEXT` | | 人类可读的错误描述（失败时填写） |
| `errorCode` | `string \| null` | `TEXT` | | 机器可读错误码（如 'timeout' / 'rate_limited' / 'invalid_api_key'） |
| `durationMs` | `number \| null` | `INTEGER` | | 执行耗时（毫秒） |
| `createdAt` | `string` | `TEXT` | NOT NULL | 创建时间 |
| `updatedAt` | `string` | `TEXT` | NOT NULL | 更新时间 |

```sql
CREATE TABLE agent_task_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entryId INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  taskType TEXT NOT NULL,
  status TEXT NOT NULL,
  agentProfileId INTEGER REFERENCES agent_profile(id) ON DELETE SET NULL,
  providerProfileId INTEGER REFERENCES agent_provider_profile(id) ON DELETE SET NULL,
  modelProfileId INTEGER REFERENCES agent_model_profile(id) ON DELETE SET NULL,
  promptVersion TEXT,
  targetLanguage TEXT,
  templateId TEXT,
  templateVersion TEXT,
  runtimeParameterSnapshot TEXT,
  errorMessage TEXT,
  errorCode TEXT,
  durationMs INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_agent_task_run_entryId ON agent_task_run(entryId);
CREATE INDEX idx_agent_task_run_taskType ON agent_task_run(taskType);
CREATE INDEX idx_agent_task_run_status ON agent_task_run(status);
CREATE INDEX idx_agent_task_run_updatedAt ON agent_task_run(updatedAt);
```

```ts
type AgentTaskType = 'summary' | 'translation';
type AgentTaskRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timedOut' | 'cancelled';

interface AgentTaskRun {
  id: number;
  entryId: number;
  taskType: AgentTaskType;
  status: AgentTaskRunStatus;
  agentProfileId: number | null;
  providerProfileId: number | null;
  modelProfileId: number | null;
  promptVersion: string | null;
  targetLanguage: string | null;
  templateId: string | null;
  templateVersion: string | null;
  runtimeParameterSnapshot: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.8 LLMUsageEvent（LLM 用量事件 — 核心计量表）

**用途**：记录每一次 LLM API 请求的详细信息，是"用量统计"功能的数据基础。**每次 LLM request 都必须记录一条**，包括正常请求、重试请求、修复请求。

**关键设计**：
- `taskRunId` 可为 NULL：先记录 usage event，再关联到 taskRun（通过时间窗口回链）
- 记录完整的 Provider 快照信息（URL、Host、Path、Name），即使 Provider 配置后续被删除也能追溯
- `usageAvailability` 区分 'actual'（实际返回了 token 数）和 'missing'（API 未返回 token 数）
- `requestPhase` 区分 'normal' / 'repair' / 'retry'
- `requestStatus` 区分 'succeeded' / 'failed' / 'cancelled' / 'timedOut'
- `durationMs` 是冗余字段（可由 `finishedAt - startedAt` 计算得出），目的是让用量统计面板能直接排序和聚合，无需在查询时做日期计算

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `taskRunId` | `number \| null` | `INTEGER` | FK→agent_task_run(id) ON DELETE SET NULL | 关联任务运行（可后关联） |
| `entryId` | `number \| null` | `INTEGER` | FK→entry(id) ON DELETE SET NULL | 所属文章 |
| `taskType` | `string` | `TEXT` | NOT NULL | 任务类型 |
| `providerProfileId` | `number \| null` | `INTEGER` | FK→agent_provider_profile(id) ON DELETE SET NULL | Provider 配置 |
| `modelProfileId` | `number \| null` | `INTEGER` | FK→agent_model_profile(id) ON DELETE SET NULL | Model 配置 |
| `providerBaseUrlSnapshot` | `string` | `TEXT` | NOT NULL | Provider 基础 URL 快照 |
| `providerResolvedUrlSnapshot` | `string \| null` | `TEXT` | | 实际解析后的完整 URL |
| `providerResolvedHostSnapshot` | `string \| null` | `TEXT` | | 实际解析后的 Host |
| `providerResolvedPathSnapshot` | `string \| null` | `TEXT` | | 实际解析后的 Path |
| `providerNameSnapshot` | `string \| null` | `TEXT` | | Provider 名称快照 |
| `modelNameSnapshot` | `string` | `TEXT` | NOT NULL | Model 名称快照 |
| `requestPhase` | `string` | `TEXT` | NOT NULL | 请求阶段: 'normal' \| 'repair' \| 'retry' |
| `requestStatus` | `string` | `TEXT` | NOT NULL | 请求状态: 'succeeded' \| 'failed' \| 'cancelled' \| 'timedOut' |
| `promptTokens` | `number \| null` | `INTEGER` | | Prompt 消耗 token 数 |
| `completionTokens` | `number \| null` | `INTEGER` | | Completion 消耗 token 数 |
| `totalTokens` | `number \| null` | `INTEGER` | | 总 token 数 (promptTokens + completionTokens) |
| `usageAvailability` | `string` | `TEXT` | NOT NULL | 用量可用性: 'actual' \| 'missing' |
| `durationMs` | `number \| null` | `INTEGER` | | 请求耗时（冗余列，便于排序/聚合） |
| `startedAt` | `string \| null` | `TEXT` | ISO 8601 | 请求开始时间 |
| `finishedAt` | `string \| null` | `TEXT` | ISO 8601 | 请求结束时间 |
| `createdAt` | `string` | `TEXT` | NOT NULL | 记录创建时间 |

```sql
CREATE TABLE llm_usage_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taskRunId INTEGER REFERENCES agent_task_run(id) ON DELETE SET NULL,
  entryId INTEGER REFERENCES entry(id) ON DELETE SET NULL,
  taskType TEXT NOT NULL,
  providerProfileId INTEGER REFERENCES agent_provider_profile(id) ON DELETE SET NULL,
  modelProfileId INTEGER REFERENCES agent_model_profile(id) ON DELETE SET NULL,
  providerBaseUrlSnapshot TEXT NOT NULL,
  providerResolvedUrlSnapshot TEXT,
  providerResolvedHostSnapshot TEXT,
  providerResolvedPathSnapshot TEXT,
  providerNameSnapshot TEXT,
  modelNameSnapshot TEXT NOT NULL,
  requestPhase TEXT NOT NULL,
  requestStatus TEXT NOT NULL,
  promptTokens INTEGER,
  completionTokens INTEGER,
  totalTokens INTEGER,
  usageAvailability TEXT NOT NULL,
  durationMs INTEGER,
  startedAt TEXT,
  finishedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_llm_usage_createdAt ON llm_usage_event(createdAt);
CREATE INDEX idx_llm_usage_taskType_createdAt ON llm_usage_event(taskType, createdAt);
CREATE INDEX idx_llm_usage_provider_createdAt ON llm_usage_event(providerProfileId, createdAt);
CREATE INDEX idx_llm_usage_model_createdAt ON llm_usage_event(modelProfileId, createdAt);
CREATE INDEX idx_llm_usage_status_createdAt ON llm_usage_event(requestStatus, createdAt);
CREATE INDEX idx_llm_usage_taskRunId ON llm_usage_event(taskRunId);
CREATE INDEX idx_llm_usage_durationMs ON llm_usage_event(durationMs);
```

```ts
type LLMUsageRequestPhase = 'normal' | 'repair' | 'retry';
type LLMUsageRequestStatus = 'succeeded' | 'failed' | 'cancelled' | 'timedOut';
type LLMUsageAvailability = 'actual' | 'missing';

interface LLMUsageEvent {
  id: number;
  taskRunId: number | null;
  entryId: number | null;
  taskType: AgentTaskType;
  providerProfileId: number | null;
  modelProfileId: number | null;
  providerBaseUrlSnapshot: string;
  providerResolvedUrlSnapshot: string | null;
  providerResolvedHostSnapshot: string | null;
  providerResolvedPathSnapshot: string | null;
  providerNameSnapshot: string | null;
  modelNameSnapshot: string;
  requestPhase: LLMUsageRequestPhase;
  requestStatus: LLMUsageRequestStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  usageAvailability: LLMUsageAvailability;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface LLMUsageEventContext {
  taskRunId: number | null;
  entryId: number | null;
  taskType: AgentTaskType;
  providerProfileId: number | null;
  modelProfileId: number | null;
  providerBaseUrlSnapshot: string;
  providerResolvedUrlSnapshot: string | null;
  providerResolvedHostSnapshot: string | null;
  providerResolvedPathSnapshot: string | null;
  providerNameSnapshot: string | null;
  modelNameSnapshot: string;
  requestPhase: LLMUsageRequestPhase;
  requestStatus: LLMUsageRequestStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}
```

---

### 2.9 AgentProviderProfile / AgentModelProfile（LLM 配置表）

**用途**：存储用户配置的 LLM Provider 和 Model 信息。Provider 和 Model 是 1:N 关系。

**AgentProviderProfile**：

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | |
| `name` | `string` | `TEXT` | NOT NULL, UNIQUE | 显示名称 |
| `baseUrl` | `string` | `TEXT` | NOT NULL | API 基础 URL |
| `apiKeyRef` | `string` | `TEXT` | NOT NULL | API Key 引用（不存明文，存 Keychain/加密引用） |
| `testModel` | `string` | `TEXT` | NOT NULL, DEFAULT '' | 连通性测试模型名 |
| `isDefault` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | 是否默认 Provider |
| `isEnabled` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 1 | 是否启用 |
| `isArchived` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | 是否归档 |
| `archivedAt` | `string \| null` | `TEXT` | | 归档时间 |
| `createdAt` | `string` | `TEXT` | NOT NULL | |
| `updatedAt` | `string` | `TEXT` | NOT NULL | |

**AgentModelProfile**：

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `id` | `number` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | |
| `providerProfileId` | `number` | `INTEGER` | NOT NULL, FK→agent_provider_profile(id) ON DELETE CASCADE | |
| `name` | `string` | `TEXT` | NOT NULL, UNIQUE | 显示名称 |
| `modelName` | `string` | `TEXT` | NOT NULL | API 中的 model 参数值 |
| `temperature` | `number \| null` | `REAL` | | |
| `topP` | `number \| null` | `REAL` | | |
| `maxTokens` | `number \| null` | `INTEGER` | | |
| `isStreaming` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 1 | |
| `supportsSummary` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | |
| `supportsTranslation` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | |
| `isDefault` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | |
| `isEnabled` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 1 | |
| `isArchived` | `boolean` | `INTEGER` | NOT NULL, DEFAULT 0 | |
| `archivedAt` | `string \| null` | `TEXT` | | |
| `lastTestedAt` | `string \| null` | `TEXT` | | |
| `createdAt` | `string` | `TEXT` | NOT NULL | |
| `updatedAt` | `string` | `TEXT` | NOT NULL | |

```ts
interface AgentProviderProfile {
  id: number;
  name: string;
  baseUrl: string;
  apiKeyRef: string;
  testModel: string;
  isDefault: boolean;
  isEnabled: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgentModelProfile {
  id: number;
  providerProfileId: number;
  name: string;
  modelName: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  isStreaming: boolean;
  supportsSummary: boolean;
  supportsTranslation: boolean;
  isDefault: boolean;
  isEnabled: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.10 AppSettings（应用配置 — KV 键值表）

**用途**：存储用户偏好设置，例如阅读器字号/行距/主题、默认目标语言等。采用 KV 模式避免每增一个配置项就改 schema。

**重要说明**：这是 T7（阅读设置）和 T9（默认语言配置）的配置持久化基础。其他模块也可按需读写。

| 字段 | TS 类型 | SQLite 类型 | 约束 | 说明 |
|------|---------|------------|------|------|
| `key` | `string` | `TEXT` | PRIMARY KEY | 配置键名 |
| `value` | `string` | `TEXT` | NOT NULL | 配置值（统一存为字符串，布尔/数字/JSON 需序列化） |
| `updatedAt` | `string` | `TEXT` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新时间 |

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**约定键名命名规则**：使用 `模块.功能.属性` 的命名方式，例如：

| 键名 | 值示例 | 说明 |
|------|--------|------|
| `reader.fontSize` | `"18"` | 阅读器字号（px） |
| `reader.lineHeight` | `"1.8"` | 阅读器行距（倍数） |
| `reader.theme` | `"dark"` | 阅读器主题: 'light' \| 'dark' \| 'sepia' |
| `reader.readingWidth` | `"680"` | 阅读宽度（px） |
| `agent.defaultTargetLanguage` | `"zh-CN"` | 默认目标语言 |
| `agent.defaultDetailLevel` | `"medium"` | 默认摘要详细程度 |

```ts
interface AppSettings {
  key: string;
  value: string;
  updatedAt: string;
}
```

---

## 三、本地存储接口清单

### 3.1 设计约定

- 使用 `better-sqlite3` 作为 SQLite 驱动
- 数据库文件路径由 Electron 主进程通过 `app.getPath('userData')` 确定（详见 [4.1](#41-与-t1-项目骨架的接口契约)）
- 所有接口同步返回（better-sqlite3 是同步 API），内部不涉及 Promise
- 写操作使用事务包裹
- 接口命名遵循 `动词 + 宾语` 模式

### 3.2 FeedStore

```ts
interface IFeedStore {
  upsert(feed: Omit<Feed, 'id' | 'createdAt'>): Feed;
  delete(feedId: number): void;
  update(feedId: number, partial: Partial<Omit<Feed, 'id' | 'createdAt'>>): Feed;
  getAll(): Feed[];
  getById(feedId: number): Feed | null;
  getByUrl(feedUrl: string): Feed | null;
  upsertMany(feeds: Omit<Feed, 'id' | 'createdAt'>[]): Feed[];
  updateLastFetchedAt(feedId: number, lastFetchedAt: string): void;
}
```

### 3.3 EntryStore

```ts
interface IEntryStore {
  upsert(entry: Omit<Entry, 'id' | 'createdAt' | 'isRead' | 'isStarred' | 'isDeleted'>): Entry;
  upsertMany(entries: Omit<Entry, 'id' | 'createdAt' | 'isRead' | 'isStarred' | 'isDeleted'>[]): Entry[];
  softDelete(entryId: number): void;
  softDeleteMany(entryIds: number[]): void;
  markRead(entryId: number, isRead: boolean): void;
  markReadMany(entryIds: number[], isRead: boolean): void;
  markStarred(entryId: number, isStarred: boolean): void;
  updateUrl(entryId: number, url: string): void;
  getById(entryId: number): Entry | null;
  getByFeedGuid(feedId: number, guid: string): Entry | null;
  getByFeedUrl(feedId: number, url: string): Entry | null;
  getList(params: EntryListQuery): EntryListItem[];
  getListPage(params: EntryListQuery, cursor: EntryListCursor | null, limit: number): EntryListPageResult;
  getUnreadCount(feedId?: number): number;
  getTotalCount(feedId?: number): number;
}

interface EntryListQuery {
  feedId?: number;
  unreadOnly?: boolean;
  starredOnly?: boolean;
  searchText?: string;
}

interface EntryListCursor {
  publishedAt: string | null;
  createdAt: string;
  id: number;
}

interface EntryListItem {
  id: number;
  feedId: number;
  title: string | null;
  publishedAt: string | null;
  createdAt: string;
  isRead: boolean;
  isStarred: boolean;
  feedSourceTitle: string | null;
}

interface EntryListPageResult {
  entries: EntryListItem[];
  hasMore: boolean;
  nextCursor: EntryListCursor | null;
}
```

### 3.4 SyncLogStore

**设计说明**：这是任务文档中多次强调的能力——"记录同步状态和错误"、"记录最近同步时间"、"单个订阅源失败不影响其他"。

```ts
interface ISyncLogStore {
  startSync(feedId: number): number;
  finishSync(logId: number, params: {
    status: SyncStatus;
    newEntriesCount: number;
    errorMessage?: string;
    errorCode?: string;
  }): void;
  getLatestByFeedId(feedId: number): SyncLog | null;
  getRecentLogs(limit?: number): SyncLog[];
  getByFeedId(feedId: number, limit?: number): SyncLog[];
  /** 批量获取每个 feed 的最新一条 SyncLog（避免 N+1 查询） */
  getLatestForAllFeeds(): Map<number, SyncLog>;
}
```

### 3.5 ContentStore

```ts
interface IContentStore {
  upsert(content: Omit<Content, 'id' | 'createdAt'>): Content;
  upsertFetchedSource(
    entryId: number,
    html: string,
    documentBaseUrl: string | null,
    pipelineType: ReaderPipelineType,
    resolvedIntermediateContent: string | null
  ): Content;
  /**
   * 前置条件：entryId 对应的 Content 记录必须已存在（由 upsertFetchedSource 创建）。
   * 如果记录不存在，应抛出错误。
   */
  upsertCleanedArtifacts(
    entryId: number,
    cleanedHtml: string,
    readabilityTitle: string | null,
    readabilityByline: string | null,
    readabilityVersion: number
  ): Content;
  /**
   * 前置条件：entryId 对应的 Content 记录必须已存在（由 upsertFetchedSource 创建）。
   * 如果记录不存在，应抛出错误。
   */
  upsertMarkdown(
    entryId: number,
    markdown: string,
    markdownVersion: number
  ): Content;
  getByEntryId(entryId: number): Content | null;
  getLayerState(entryId: number): ContentLayerState;
  invalidateReadability(entryId: number): void;
  invalidateMarkdown(entryId: number): void;
  invalidateAll(entryId: number): void;
}

interface ContentLayerState {
  hasSourceHtml: boolean;
  hasCleanedHtml: boolean;
  hasMarkdown: boolean;
  readabilityVersion: number | null;
  markdownVersion: number | null;
}
```

### 3.6 SummaryResultStore

```ts
interface ISummaryResultStore {
  persistSuccessfulResult(params: {
    entryId: number;
    agentProfileId: number | null;
    providerProfileId: number | null;
    modelProfileId: number | null;
    promptVersion: string | null;
    targetLanguage: string;
    detailLevel: SummaryDetailLevel;
    outputLanguage: string;
    outputText: string;
    templateId: string | null;
    templateVersion: string | null;
    runtimeParameterSnapshot: Record<string, string>;
    durationMs: number | null;
  }): { run: AgentTaskRun; result: SummaryResult };
  getBySlot(entryId: number, targetLanguage: string, detailLevel: SummaryDetailLevel): SummaryResult | null;
  getByEntryId(entryId: number): SummaryResult[];
  getLatestByEntryId(entryId: number): SummaryResult | null;
  deleteByTaskRunId(taskRunId: number): void;
  evictOldRecords(limit: number): void;
}
```

### 3.7 TranslationResultStore

```ts
interface ITranslationResultStore {
  persistResult(params: {
    entryId: number;
    agentProfileId: number | null;
    providerProfileId: number | null;
    modelProfileId: number | null;
    targetLanguage: string;
    sourceContentHash: string;
    segmenterVersion: string;
    outputLanguage: string;
    segments: Array<{
      sourceSegmentId: string;
      orderIndex: number;
      sourceTextSnapshot: string | null;
      translatedText: string;
    }>;
    templateId: string | null;
    templateVersion: string | null;
    runtimeParameterSnapshot: Record<string, string>;
    durationMs: number | null;
  }): { run: AgentTaskRun; result: TranslationResult; segments: TranslationSegment[] };
  getBySlot(entryId: number, targetLanguage: string, sourceContentHash: string, segmenterVersion: string): TranslationResult | null;
  getByEntryId(entryId: number): TranslationResult[];
  getSegmentsByTaskRunId(taskRunId: number): TranslationSegment[];
  updateRunStatus(taskRunId: number, runStatus: TranslationRunStatus): void;
  deleteByTaskRunId(taskRunId: number): void;
}
```

### 3.8 AgentTaskRunStore

```ts
interface IAgentTaskRunStore {
  create(params: {
    entryId: number;
    taskType: AgentTaskType;
    status: AgentTaskRunStatus;
    agentProfileId: number | null;
    providerProfileId: number | null;
    modelProfileId: number | null;
    promptVersion: string | null;
    targetLanguage: string | null;
    templateId: string | null;
    templateVersion: string | null;
    runtimeParameterSnapshot: string | null;
    durationMs: number | null;
  }): AgentTaskRun;
  getById(id: number): AgentTaskRun | null;
  getByEntryId(entryId: number): AgentTaskRun[];
  getByEntryIdAndTaskType(entryId: number, taskType: AgentTaskType): AgentTaskRun[];
  getRunningByEntryId(entryId: number): AgentTaskRun[];
  updateStatus(id: number, status: AgentTaskRunStatus, params?: {
    durationMs?: number;
    errorMessage?: string;
    errorCode?: string;
  }): void;
  delete(id: number): void;
  deleteByEntryId(entryId: number): void;
}
```

### 3.9 LLMUsageEventStore

```ts
interface ILLMUsageEventStore {
  record(context: LLMUsageEventContext): LLMUsageEvent;
  linkRecentEventsToTaskRun(
    taskRunId: number,
    entryId: number,
    taskType: AgentTaskType,
    startedAt: string,
    finishedAt: string
  ): void;
  getById(id: number): LLMUsageEvent | null;
  getByTaskRunId(taskRunId: number): LLMUsageEvent[];
  getByEntryId(entryId: number): LLMUsageEvent[];
  /** 最近调用明细（用量面板核心查询） */
  getRecentEvents(params: {
    taskType?: AgentTaskType;
    providerProfileId?: number;
    modelProfileId?: number;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
  }): LLMUsageEvent[];
  /** Token 总量汇总 */
  getTotalTokens(params: {
    taskType?: AgentTaskType;
    providerProfileId?: number;
    modelProfileId?: number;
    since?: string;
    until?: string;
  }): { promptTokens: number; completionTokens: number; totalTokens: number };
  /** 用量面板一览汇总（总请求数、成功/失败数、总 token） */
  getUsageSummary(params: {
    since?: string;
    until?: string;
  }): LLMUsageSummary;
  /** 按维度分组统计 */
  getUsageBreakdown(params: {
    groupBy: 'taskType' | 'provider' | 'model' | 'day';
    since?: string;
    until?: string;
  }): UsageBreakdownItem[];
  deleteByTaskRunId(taskRunId: number): void;
  evictOldRecords(before: string): void;
}

interface LLMUsageSummary {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
}

interface UsageBreakdownItem {
  key: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
}
```

### 3.10 AgentProviderStore / AgentModelStore

```ts
interface IAgentProviderStore {
  getAll(): AgentProviderProfile[];
  getById(id: number): AgentProviderProfile | null;
  getDefault(): AgentProviderProfile | null;
  upsert(profile: Omit<AgentProviderProfile, 'id' | 'createdAt' | 'updatedAt'>): AgentProviderProfile;
  delete(id: number): void;
  archive(id: number): void;
  setDefault(id: number): void;
}

interface IAgentModelStore {
  getAll(): AgentModelProfile[];
  getByProviderId(providerProfileId: number): AgentModelProfile[];
  getById(id: number): AgentModelProfile | null;
  getDefault(taskType: AgentTaskType): AgentModelProfile | null;
  upsert(profile: Omit<AgentModelProfile, 'id' | 'createdAt' | 'updatedAt'>): AgentModelProfile;
  delete(id: number): void;
  archive(id: number): void;
  setDefault(id: number): void;
  updateLastTestedAt(id: number): void;
}
```

### 3.11 AppSettingsStore

**设计说明**：这是 T7（阅读设置）和 T9（默认语言/模型配置）持久化基础。采用 KV 模式，各模块按约定的键名读写，不互相覆盖。

```ts
interface IAppSettingsStore {
  /** 读取字符串值，不存在返回 null */
  get(key: string): string | null;
  /** 读取 JSON 反序列化值，不存在或格式错误返回 null */
  getJson<T>(key: string): T | null;
  /** 写入字符串值，已存在则覆盖 */
  set(key: string, value: string): void;
  /** 写入 JSON 序列化值 */
  setJson(key: string, value: unknown): void;
  /** 删除指定键 */
  delete(key: string): void;
  /** 返回所有键值对 */
  getAll(): Record<string, string>;
  /** 批量设置 */
  setMany(entries: Record<string, string>): void;
}
```

**T2 不负责**：定义具体的键名和默认值 — 各消费模块（T7/T9/T10/T11）自行约束。T2 只保证读写接口可用。

---

## 四、与上游模块的接口契约

### 4.1 与 T1（项目骨架）的接口契约

T2 导出数据库初始化函数，T1 在主进程入口调用：

```ts
// T2 导出（/src/core/database/index.ts）
import Database from 'better-sqlite3';
import path from 'path';

export function initDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'mercury.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  return db;
}

// T1 主进程入口调用方式（main.ts）：
// import { initDatabase } from './core/database';
// const db = initDatabase(app.getPath('userData'));
```

**T2 需要交给 T1 的要求**：

> `package.json` 中需要 `postinstall` 脚本调用 `electron-rebuild` 重新编译 `better-sqlite3` 原生模块，否则在不同 Electron 版本下可能加载失败：
> ```json
> {
>   "scripts": {
>     "postinstall": "electron-rebuild -f -w better-sqlite3"
>   }
> }
> ```

### 4.2 与其他模块的接口契约

| 依赖方 | 提供的接口 | 说明 |
|--------|-----------|------|
| T3 (Feed 解析) | FeedStore.upsert | 写入解析后的 Feed |
| T5 (Sync) | EntryStore.upsertMany, ContentStore.upsertFetchedSource, SyncLogStore | 写入同步结果 + 同步日志 |
| T6 (Reader Pipeline) | ContentStore.upsertCleanedArtifacts, ContentStore.upsertMarkdown | 写入清洗结果（必须先有 L1） |
| T10 (Summary) | SummaryResultStore.persistSuccessfulResult | 保存摘要 |
| T11 (Translation) | TranslationResultStore.persistResult | 保存翻译 |
| T11 (Export) | EntryStore.getById（标题/链接）+ ContentStore.getByEntryId（正文 Markdown）+ SummaryResultStore.getLatestByEntryId（摘要）+ TranslationResultStore.getByEntryId（译文） | 拼装导出 Markdown |
| T8/T9 (Agent Runtime/LLM Provider) | LLMUsageEventStore.record | 记录每次 LLM 请求用量 |
| T7 (Reader UI) | EntryStore.getList, ContentStore.getByEntryId, ContentStore.getLayerState | 读取展示数据 |
| T7/T9/T10/T11 (偏好持久化) | AppSettingsStore | 读写阅读设置/默认语言/默认模型等 |
| T0 (用量统计面板) | LLMUsageEventStore.getTotalTokens, getUsageBreakdown, getRecentEvents, getUsageSummary | 用量聚合查询 + 明细 |

---

## 五、LLM 用量记录完整调用链（T2 ↔ T8/T9/T10/T11 对齐）

**背景**：根据 `AGENTS.md` 与 AI 功能模块契约，T2 负责 `LLMUsageEvent` 数据结构和存储接口；T8 负责 Agent Runtime 中统一的 usage record 记录契约；T9 负责 Provider 返回 token 信息；T10/T11 负责产生日志或调用统一记录接口。

以下是一次完整 Summary 任务的调用链示例（T10 → T9 → T2）：

```ts
// ═══════════════════════════════════════════════════
// 场景：T10 Summary Agent 对某篇文章调用 LLM 生成摘要
// 参与方：T10 (Summary) → T9 (Provider) → T2 (存储)
// ═══════════════════════════════════════════════════

// ── 步骤 1：T10 调用 T9 Provider 发起 LLM 请求 ──
const startTime = new Date().toISOString();
const response = await llmProvider.chat({
  model: 'gpt-4o',
  messages: [...],
  temperature: 0.7,
});
const finishTime = new Date().toISOString();
const durationMs = new Date(finishTime).getTime() - new Date(startTime).getTime();

// ── 步骤 2：T10 立即调用 T2 记录本次 LLM 用量 ──
// 注意：此时 taskRunId 为 null，等 TaskRun 创建后再后关联
const usageEvent = llmUsageEventStore.record({
  taskRunId: null,
  entryId: article.id,
  taskType: 'summary',
  providerProfileId: provider.id,
  modelProfileId: model.id,
  providerBaseUrlSnapshot: provider.baseUrl,
  providerResolvedUrlSnapshot: response.resolvedUrl ?? null,
  providerResolvedHostSnapshot: response.resolvedHost ?? null,
  providerResolvedPathSnapshot: response.resolvedPath ?? null,
  providerNameSnapshot: provider.name,
  modelNameSnapshot: model.modelName,
  requestPhase: 'normal',
  requestStatus: response.success ? 'succeeded' : 'failed',
  promptTokens: response.usage?.prompt_tokens ?? null,
  completionTokens: response.usage?.completion_tokens ?? null,
  durationMs: durationMs,
  startedAt: startTime,
  finishedAt: finishTime,
});

// ── 步骤 3：T10 创建 AgentTaskRun 记录任务执行结果 ──
const run = agentTaskRunStore.create({
  entryId: article.id,
  taskType: 'summary',
  status: response.success ? 'succeeded' : 'failed',
  agentProfileId: null,
  providerProfileId: provider.id,
  modelProfileId: model.id,
  promptVersion: 'v1',
  targetLanguage: 'zh-CN',
  templateId: 'summary-default',
  templateVersion: '1.0.0',
  runtimeParameterSnapshot: JSON.stringify({
    detailLevel: 'medium',
    outputLanguage: 'zh-CN',
  }),
  durationMs: durationMs,
});

// ── 步骤 4：T10 调用 T2 后关联 usage events 到 taskRun ──
// 时间窗口 [startedAt - 1s, finishedAt + 1s] 匹配同 entryId + taskType 的无主 events
llmUsageEventStore.linkRecentEventsToTaskRun(
  run.id,        // 刚创建的 TaskRun ID
  article.id,    // 文章 ID
  'summary',     // 任务类型
  startTime,     // 开始时间
  finishTime,    // 结束时间
);

// ── 步骤 5：T10 持久化摘要结果 ──
await summaryResultStore.persistSuccessfulResult({
  entryId: article.id,
  agentProfileId: null,
  providerProfileId: provider.id,
  modelProfileId: model.id,
  promptVersion: 'v1',
  targetLanguage: 'zh-CN',
  detailLevel: 'medium',
  outputLanguage: 'zh-CN',
  outputText: response.text,
  templateId: 'summary-default',
  templateVersion: '1.0.0',
  runtimeParameterSnapshot: { detailLevel: 'medium', outputLanguage: 'zh-CN' },
  durationMs: durationMs,
});
```

**关键约定**：

| 约定 | 说明 |
|------|------|
| 步骤 2 必须同步于步骤 3 | Usage event 在 TaskRun 之前记录（后关联机制） |
| 步骤 4 的时间窗口 | 默认 ±1 秒宽容窗口，允许 clock skew |
| 重试/修复请求 | `requestPhase = 'repair'` 或 `'retry'`，同样调用 `record()` |
| API 未返回 token 数 | `usageAvailability = 'missing'`，`promptTokens/completionTokens = null` |

---

## 六、三层内容的数据流设计

### 6.1 数据流图

```
                      T5 Sync
                        │
                        ▼
              ┌─────────────────┐
              │  1. Fetch HTML   │  undici / node-fetch
              │  content.html    │
              │  (通过           │
              │   upsertFetched  │
              │   Source 写入)   │
              └────────┬────────┘
                       │ T5 → T6 交接
                       ▼
              ┌─────────────────┐
              │  2. Readability  │  @mozilla/readability
              │  content.cleaned │
              │  Html            │
              │  (通过           │
              │   upsertCleaned  │
              │   Artifacts 写入)│
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  3. Turndown     │  turndown
              │  content.markdown│
              │  (通过           │
              │   upsertMarkdown │
              │   写入)          │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Reader   │ │ Summary  │ │Translation│
    │  (L2)     │ │ (L3)     │ │ (L3)     │
    └──────────┘ └──────────┘ └──────────┘
```

### 6.2 版本化与失效策略

| 场景 | 操作 |
|------|------|
| Readability 库升级 | `readabilityVersion` 递增，旧数据 `readabilityVersion = NULL` 视为待更新 |
| Turndown 规则升级 | `markdownVersion` 递增，旧数据 `markdownVersion = NULL` 视为待更新 |
| 内容重新抓取 | 整条 Content 记录删除重建 |
| 用户手动刷新 | 调用 `invalidateAll()` 后重新走 Pipeline |

### 6.3 内容空值处理

- `html = NULL`：尚未抓取
- `cleanedHtml = NULL`：尚未清洗或清洗失败
- `markdown = NULL`：尚未转换或转换失败
- 三层内容允许部分缺失：例如只有 html 时可以降级展示原始 HTML

---

## 七、数据库初始化与迁移

### 7.1 初始化流程

```ts
// src/core/database/init.ts
import Database from 'better-sqlite3';
import path from 'path';

function createDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'mercury.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  return db;
}
```

### 7.2 迁移策略

```ts
interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  { version: 1,  name: 'createFeed',                up: createFeedTable },
  { version: 2,  name: 'createEntry',               up: createEntryTable },
  { version: 3,  name: 'createContent',             up: createContentTable },
  { version: 4,  name: 'createAgentProviderProfile', up: createAgentProviderProfileTable },
  { version: 5,  name: 'createAgentModelProfile',    up: createAgentModelProfileTable },
  { version: 6,  name: 'createAgentTaskRun',         up: createAgentTaskRunTable },
  { version: 7,  name: 'createLLMUsageEvent',        up: createLLMUsageEventTable },
  { version: 8,  name: 'createSummaryResult',        up: createSummaryResultTable },
  { version: 9,  name: 'createTranslationResult',    up: createTranslationResultTable },
  { version: 10, name: 'createTranslationSegment',   up: createTranslationSegmentTable },
  { version: 11, name: 'createSyncLog',              up: createSyncLogTable },
  { version: 12, name: 'addEntryListIndexes',        up: addEntryListIndexes },
  { version: 13, name: 'addLLMUsageIndexes',         up: addLLMUsageIndexes },
  { version: 14, name: 'addAgentTaskRunErrorFields', up: addAgentTaskRunErrorFields },
  { version: 15, name: 'addLLMUsageDurationMs',      up: addLLMUsageDurationMs },
  { version: 16, name: 'createAppSettings',          up: createAppSettingsTable },
  { version: 17, name: 'addFeedDescription',         up: addFeedDescription },
];

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedVersions = db
    .prepare('SELECT version FROM _migrations')
    .all()
    .map((r: any) => r.version);

  for (const migration of migrations) {
    if (!appliedVersions.includes(migration.version)) {
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      })();
    }
  }
}
```

---

## 八、Seed / Mock 数据

**背景**：项目需要建立开发用 seed 数据入口，方便阅读器 UI、Summary、Translation 等模块在没有真实同步数据或真实 LLM 调用时也能联调开发。

```ts
// src/core/database/seed.ts
interface SeedOptions {
  mockFeeds?: boolean;        // 默认 true
  mockEntries?: boolean;      // 默认 true
  mockContents?: boolean;     // 默认 true（含三层内容）
  mockSummaries?: boolean;    // 默认 false
  mockUsageEvents?: boolean;  // 默认 false
}

/**
 * 插入开发用 mock 数据。
 * 仅在开发模式下调用（通过环境变量或 npm run dev:seed 触发）。
 */
function seedMockData(db: Database.Database, options: SeedOptions = {}): void;
```

seed 数据内容：
- 2-3 个 mock Feed（知名技术博客）
- 5-10 篇 mock Entry（含不同 isRead / isStarred 状态）
- 对应的 Content（含 html / cleanedHtml / markdown 三层完整内容）
- 可选：1-2 条 mock SummaryResult
- 可选：3-5 条 mock LLMUsageEvent（含不同 provider/model/status）

> T2 注意：seed 数据仅用于开发和测试，正式发布前应提供对应的 `cleanSeedData()` 方法或确保测试数据不会进入正式用户数据。

---

## 九、分阶段实现计划

以下按项目集成计划对 T2 的要求拆解实现节奏。每个阶段应完成对应接口并通过单元测试。

### W1（本周）：数据模型草案 + 基础存储接口

```
实现内容：
  ✅ 本设计文档（设计阶段完成）
  数据库初始化框架（createDatabase + runMigrations）
  迁移 1-3：feed / entry / content 建表
  AppSettingsStore（KV 配置读写，T7/T9 依赖）
  FeedStore（完整接口）
  EntryStore（upsert/getById/softDelete/markRead，不含分页列表）
  ContentStore（基础 upsert/getByEntryId，不含三层分步写入）
  导出所有 TS 类型定义
  Seed mock 数据（mockFeeds + mockEntries + mockContents）

里程碑：T3/T5/T7 可以通过 FeedStore/EntryStore/ContentStore 进行基础读写
测试覆盖：单元测试覆盖所有 W1 实现的 Store 方法
```

### W2：Feed / Article / Content 存储可用

```
实现内容：
  EntryStore 分页列表查询（getList/getListPage/游标分页）
  ContentStore upsertFetchedSource（L1 写入）
  SyncLogStore（完整接口）
  迁移 11：createSyncLog
  迁移 12：addEntryListIndexes
  与 T5 对接联调（Sync 写入）

里程碑：T5 Sync 可以将抓取的 HTML 存入 Content L1；T7 可以分页获取文章列表
```

### W3：Content 支持三层内容 + 跨模块联调

```
实现内容：
  ContentStore upsertCleanedArtifacts（L2 写入）
  ContentStore upsertMarkdown（L3 写入）
  ContentStore invalidate / getLayerState
  Content 写入前置条件校验（L2/L3 写入前检查 L1 存在）
  与 T6 对接联调（Reader Pipeline）

里程碑：T6 Reader Pipeline 可以写入 cleanedHtml 和 markdown
```

### W4：AI 相关存储全部可用

```
实现内容：
  迁移 4-10, 13-17：剩余所有表的建表和索引
  AgentTaskRunStore
  LLMUsageEventStore（含 record / linkRecentEvents / getRecentEvents / getUsageSummary / getUsageBreakdown）
  SummaryResultStore
  TranslationResultStore + TranslationSegment
  AgentProviderStore / AgentModelStore
  与 T8/T9/T10/T11 对接联调（LLM 用量记录 + Summary/Translation 持久化）

里程碑：AI 小组可以记录 LLM 用量、持久化 Summary 和 Translation 结果
```

### W5：稳定 + 清理 + 优化

```
实现内容：
  数据一致性检查（所有 UNIQUE 索引约束验证通过）
  cleanSeedData() 清理测试数据
  性能优化：确认所有查询使用索引、EXPLAIN QUERY PLAN 验证
  文档更新为最终版

里程碑：数据模型稳定，无 schema 变更；seed 数据可清理
```

---

## 十、边界说明

### 10.1 本模块（T2）负责范围

| 范围 | 说明 |
|------|------|
| 数据模型定义 | 所有实体的 TypeScript 接口和 SQLite 表结构 |
| 数据库初始化 | 创建数据库文件、执行迁移 |
| 存储接口实现 | FeedStore, EntryStore, SyncLogStore, ContentStore, SummaryResultStore, TranslationResultStore, AgentTaskRunStore, LLMUsageEventStore, AgentProviderStore, AgentModelStore, AppSettingsStore |
| 迁移系统 | 版本化的数据库迁移框架 |
| Seed 数据 | 开发用 mock 数据入口 |
| 类型导出 | 导出所有接口和类型供其他模块使用 |

### 10.2 本模块不负责

| 范围 | 负责模块 |
|------|----------|
| Feed 解析逻辑 | T3 |
| OPML 解析逻辑 | T4 |
| Sync 调度逻辑 | T5 |
| Readability 清洗逻辑 | T6 |
| Turndown 转换逻辑 | T6 |
| LLM API 调用逻辑 | T9 |
| Summary 业务逻辑 | T10 |
| Translation 业务逻辑 | T11 |
| API Key 安全存储（Keychain/加密） | T9 |
| 配置键名定义与默认值 | T7 / T9 / T10 / T11（各模块自行约定） |
| UI 展示 | T7 |
| Agent Runtime 统一 usage record 契约 | T8 |

---

## 十一、验收标准

### 11.1 数据模型验收

- [ ] 所有实体 TypeScript 类型定义完整，包含 JSDoc 注释
- [ ] 所有 SQLite 表创建语句正确，包含主键、外键、索引
- [ ] 联合唯一索引覆盖去重场景（entry feedId+guid, content entryId, summary slot, translation slot）
- [ ] 外键级联删除策略正确（ON DELETE CASCADE / SET NULL）
- [ ] 三层内容字段（html, cleanedHtml, markdown）完整覆盖
- [ ] SyncLog 表覆盖同步四种状态（running/succeeded/failed/partial）
- [ ] AgentTaskRun 包含 errorMessage / errorCode 字段
- [ ] LLMUsageEvent 包含 durationMs 冗余列
- [ ] Feed 包含 description 字段
- [ ] app_settings 表可用，Key 为主键，value 为 TEXT

### 11.2 存储接口验收

- [ ] FeedStore 增删改查全部可用
- [ ] EntryStore 支持 upsert（去重）、软删除、分页列表查询
- [ ] ContentStore 支持三层内容的分步写入和读取，L2/L3 写入前校验 L1 存在
- [ ] SyncLogStore 支持 startSync/finishSync 状态流转
- [ ] SummaryResultStore 写入后可通过 slot 查询到
- [ ] TranslationResultStore 写入后可通过 slot 查询到，分段数据正确
- [ ] AgentTaskRunStore 可记录任务状态变更，支持写入 errorMessage/errorCode
- [ ] LLMUsageEventStore 可记录每次 LLM 请求，支持后关联 taskRun；getRecentEvents / getUsageSummary / getUsageBreakdown 可用
- [ ] SyncLogStore 支持 startSync/finishSync 状态流转 + getLatestForAllFeeds 批量查询
- [ ] AppSettingsStore 支持 get/set/delete/getAll/setMany，getJson 可反序列化复杂类型
- [ ] 所有写操作在事务中执行

### 11.3 迁移系统验收

- [ ] 首次启动可创建完整数据库（17 个迁移全部通过）
- [ ] 后续版本可增量迁移，不丢失数据
- [ ] `_migrations` 表正确记录已应用的迁移

### 11.4 跨模块对接验收

- [ ] 与 T1 的 `initDatabase(userDataPath)` 接口可正常调用
- [ ] Seed mock 数据可生成让 T7/T10/T11 独立开发的数据集
- [ ] T5 可通过 SyncLogStore 记录同步状态
- [ ] T10/T11 可按照第五节调用链示例完成 LLM 用量记录 → TaskRun 创建 → 结果持久化的完整流程

### 11.5 跨平台验收

- [ ] 数据库文件路径使用 `app.getPath('userData')`，不写死平台路径
- [ ] SQLite 驱动在 Windows/Linux/macOS 均可工作

### 11.6 集成测试验收

- [ ] 可创建数据库文件
- [ ] 可写入 Feed → Entry → Content → SummaryResult → LLMUsageEvent 完整链路
- [ ] 可查询用量统计聚合数据（LLMUsageSummary + UsageBreakdown）
- [ ] 单元测试覆盖率 > 80%

---

## 十二、风险点与缓解措施

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| **better-sqlite3 与 Electron 版本兼容** | 高 | 使用 electron-rebuild 重新编译原生模块；在 package.json 中锁定版本；CI 中三平台测试。**T2 需要把 `postinstall: electron-rebuild -f -w better-sqlite3` 写入给 T1 的对接要求** |
| **W4 才实现 AI 相关 Store，但 W2-W3 T10/T11 就需要 mock 开发** | 中 | W1 提供 seed mock 数据时包含 LLMUsageEvent 和 SummaryResult 的示例行，让 AI 小组提前联调 |
| **T5 Sync 需要 SyncLogStore 但 W2 才实现** | 中 | W1 的 Feed.lastFetchedAt 字段可临时替代同步状态判断，W2 补全 SyncLog |
| **大文本存储（html/markdown 可能很大）** | 中 | SQLite TEXT 类型可存储最大 1GB；如遇性能问题可考虑对超长文本做截断或分页存储 |
| **迁移系统在出错时回滚** | 中 | 每个迁移包裹在事务中；迁移前备份数据库文件 |
| **多进程并发写入** | 中 | better-sqlite3 默认同步模式；WAL 模式支持并发读；主进程单例管理数据库连接 |
| **API Key 存储安全** | 中 | T2 只存储 apiKeyRef（引用），不存储明文；实际 Key 由 T9 使用 electron safeStorage 或 Keychain 存储。注意：electron safeStorage 在 Linux 上需要 libsecret 依赖 |
| **Content 三层内容一致性** | 低 | 通过 readabilityVersion / markdownVersion 版本号标记；提供 invalidate 方法供 T6 调用 |
| **LLMUsageEvent 后关联失败** | 低 | 允许 taskRunId 为 NULL；提供独立于 taskRun 的统计查询 |
| **数据库文件损坏** | 低 | WAL 模式提供崩溃恢复；定期建议用户备份 |

---

## 十三、目录结构建议

```
src/core/database/
├── types.ts                      # 所有实体的 TypeScript 类型定义
├── init.ts                       # 数据库初始化、连接管理（initDatabase 导出）
├── migrations.ts                 # 迁移定义和执行（15 个迁移）
├── seed.ts                       # 开发用 mock 数据 + cleanSeedData
├── stores/
│   ├── feedStore.ts              # FeedStore 实现
│   ├── entryStore.ts             # EntryStore 实现（含分页）
│   ├── syncLogStore.ts           # SyncLogStore 实现
│   ├── contentStore.ts           # ContentStore 实现（含 L1/L2/L3 分步写入）
│   ├── summaryResultStore.ts     # SummaryResultStore 实现
│   ├── translationResultStore.ts # TranslationResultStore 实现
│   ├── agentTaskRunStore.ts      # AgentTaskRunStore 实现
│   ├── llmUsageEventStore.ts     # LLMUsageEventStore 实现（含 record/link/统计查询）
│   ├── agentProviderStore.ts     # AgentProviderStore 实现
│   ├── agentModelStore.ts        # AgentModelStore 实现
│   └── appSettingsStore.ts       # AppSettingsStore 实现（KV 配置读写）
├── query/
│   ├── entryQuery.ts             # Entry 列表游标分页查询构建器
│   └── usageQuery.ts             # 用量统计聚合查询（getUsageSummary/getUsageBreakdown）
└── index.ts                      # 统一导出（类型 + 接口 + 实例）
```

---

## 附录 A：参考 mercury 项目映射表

| mercury (Swift/GRDB) | mercury-ai-reader (TS/better-sqlite3) | 说明 |
|---------------------|--------------------------------------|------|
| `Feed` | `Feed` | 基本一致，增加 `description` |
| `Entry` | `Entry` | 基本一致，增加 `isStarred` |
| `Content` | `Content` | 基本一致，三层内容字段对齐 |
| `ContentHTMLCache` | 暂不实现 | 阅读器渲染缓存暂不纳入 MVP |
| `SummaryResult` | `SummaryResult` | 基本一致 |
| `TranslationResult` | `TranslationResult` | 基本一致 |
| `TranslationSegment` | `TranslationSegment` | 基本一致 |
| `AgentTaskRun` | `AgentTaskRun` | 增加 `errorMessage` / `errorCode` |
| `LLMUsageEvent` | `LLMUsageEvent` | 增加 `durationMs` 冗余列 |
| `AgentProviderProfile` | `AgentProviderProfile` | 基本一致 |
| `AgentModelProfile` | `AgentModelProfile` | 基本一致 |
| `AgentProfile` | 暂不实现 | Agent 模板配置暂不纳入 MVP |
| `Tag / TagAlias / EntryTag` | 暂不实现 | 标签系统暂不做 |
| `EntryNote` | 暂不实现 | 笔记暂不纳入 MVP |
| — | `SyncLog`（新增） | 同步日志，mercury 中无直接对应 |
| `@AppStorage / UserDefaults` | `AppSettingsStore`（新增） | KV 配置表替代 macOS UserDefaults |
| `FeedStore` (GRDB) | `FeedStore` (better-sqlite3) | 接口对齐 |
| `EntryStore` (GRDB) | `EntryStore` (better-sqlite3) | 接口对齐 |
| `ContentStore` (GRDB) | `ContentStore` (better-sqlite3) | 接口对齐，增加 L2/L3 前置条件校验 |
| `DatabaseManager` (GRDB) | `init.ts` + `migrations.ts` | 架构对齐 |

---

## 附录 B：变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-05-28 | 初版：10 实体 + 9 Store + 迁移框架 |
| v1.1 | 2026-05-28 | 补充：SyncLog 实体/Store、术语映射、AgentTaskRun.errorMessage/errorCode、LLMUsageEvent.durationMs、getRecentEvents/getUsageSummary、LLM 调用链示例、分阶段实现计划、Seed/Mock 数据、T1 接口契约、风险点扩展 |
| v1.2 | 2026-05-28 | 补充：AppSettings 实体/Store（KV 配置表，T7 阅读设置/T9 默认配置基石）、Feed.description 字段、SyncLogStore.getLatestForAllFeeds 批量查询、T11 导出数据拼装契约、T7 阅读设置降级展示链路 |
