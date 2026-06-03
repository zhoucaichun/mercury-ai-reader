# T5 Sync / 文章同步 / 入库

**负责人**：T5 夏培玮 (maipower)
**创建时间**：2026-05-28
**更新时间**：2026-06-02
**状态**：Week 2 实现（含 mock adapters）

---

## 1. 模块目标

实现文章同步服务，打通主链路：

```
订阅源列表 (T4) -> Feed 解析 (T3) -> 文章去重 -> 写入存储 (T2) -> UI 展示 (T7)
```

Week 2 目标：执行 `syncAll()` 后，能读到 feeds、articles、articleContent，首篇文章的 `getArticleContent(articleId)` 返回非空内容。

---

## 2. 目录结构

```
src/features/feed/sync/
├── index.ts              # 公共导出入口（Week2SyncService 创建函数）
├── types.ts              # Week 2 Main Chain 类型定义（遵循 AGENTS.md 5A）
├── sync.service.ts       # SyncService 核心实现（syncAll / syncFeed）
├── mock-adapters.ts      # Mock 实现（MockSubscriptionProvider / MockFeedParser / MockStoragePort）
└── smoke-week2.ts        # npm run smoke:week2 测试脚本
```

---

## 3. 核心接口

### 3.1 Week2SyncService

```typescript
interface Week2SyncService {
  syncAll(): Promise<Week2SyncAllResult>;
  syncFeed(subscriptionId: string): Promise<Week2SyncFeedResult>;
}
```

### 3.2 同步结果

```typescript
interface Week2SyncFeedResult {
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

interface Week2SyncAllResult {
  status: 'succeeded' | 'failed' | 'partial';
  totalSubscriptions: number;
  succeededCount: number;
  failedCount: number;
  totalSavedArticles: number;
  results: Week2SyncFeedResult[];
}
```

### 3.3 依赖端口

SyncService 通过依赖注入使用以下端口：

| 端口 | 来源模块 | 说明 |
|------|----------|------|
| `Week2SubscriptionProvider` | T4 | 提供 `listActiveSubscriptions()` |
| `Week2FeedParser` | T3 | 提供 `parseFeedUrl()` / `parseFeedText()` |
| `Week2StoragePort` | T2 | 提供存储读写（saveFeeds / saveArticles / saveArticleContent 等） |

---

## 4. 同步流程

```
syncAll()
  │
  ├─ 1. subscriptionProvider.listActiveSubscriptions()
  │     获取所有活跃订阅源
  │
  ├─ 2. 遍历订阅源（try-catch 隔离单个失败）
  │     │
  │     ├─ feedParser.parseFeedUrl(feedUrl)
  │     │   拉取并解析 RSS/Atom Feed
  │     │
  │     ├─ storage.saveFeeds([feed])
  │     │   创建 Feed 记录
  │     │
  │     ├─ storage.saveArticles({ feedId, articles })
  │     │   保存文章（内部去重）+ 同时保存 ArticleContent
  │     │   Mock 阶段：sourceHtml = contentHtml, canonicalMarkdown = 纯文本
  │     │
  │     └─ storage.updateFeedSyncStatus({ feedId, status: 'ready' })
  │         更新同步状态
  │
  └─ 3. 汇总返回 Week2SyncAllResult
```

---

## 5. 去重策略

去重在 `StoragePort.saveArticles()` 中执行：

1. **优先使用 `guid`**：如果 Feed 提供 guid，以此作为唯一标识
2. **其次使用 `url`**：没有 guid 时使用文章 URL
3. 每个订阅源维护独立的已存在文章集合

---

## 6. 错误处理

**核心原则**：单个订阅源失败不影响其他订阅源

- 每个订阅源用 try-catch 包裹
- 失败时记录 `errorMessage`，但继续处理下一个订阅源
- 最终根据 succeeded/failed 数量决定整体状态（succeeded/partial/failed）

---

## 7. ArticleContent 策略（Week 2）

如果 T6 Reader Pipeline 暂未接入：

```
sourceHtml = contentHtml（来自 Feed 解析的原始内容）
cleanedHtml = contentHtml（mock 阶段与 sourceHtml 相同）
canonicalMarkdown = stripHtmlTags(contentHtml)（从 HTML 提取纯文本）
```

确保 `getArticleContent(articleId)` 返回非空的 `sourceHtml / cleanedHtml / canonicalMarkdown`。

---

## 8. 字段说明

> **注意**：以下字段为 T5 草案，最终以 T2 数据模型为准。

所有时间字段统一使用 **ISO string**（遵循 AGENTS.md 5. Core Data Contracts）：

```typescript
createdAt: string;      // ISO 8601 格式，如 '2026-05-28T05:30:00.000Z'
updatedAt: string;
publishedAt?: string;
lastSyncedAt?: string;
startedAt: string;
finishedAt: string;
```

内容字段统一：

```typescript
sourceHtml: string;         // 原始 HTML
cleanedHtml: string;        // 清洗后 HTML（T6 生成）
canonicalMarkdown: string;  // 标准 Markdown（T6 生成，AI/导出的统一输入）
```

---

## 9. Mock Adapters

用于不依赖 T2/T3/T4 时也能测试完整链路：

### MockSubscriptionProvider
- 提供 2 个真实可访问的订阅源（阮一峰博客、CSS-Tricks）
- `listActiveSubscriptions()` 返回 mock 订阅源列表

### MockFeedParser
- **使用真实网络请求**拉取 RSS/Atom Feed
- 支持 RSS 2.0 和 Atom 格式解析
- 使用 DOMParser 解析 XML

### MockStoragePort
- 内存存储实现（Map）
- `saveArticles()` 内置去重逻辑
- 同步保存 Article + ArticleContent

---

## 10. 验证方式

```bash
npm run smoke:week2
```

验证标准：
- `syncAll()` 执行后 `listFeeds()` 返回 ≥1 个 Feed
- `listArticles()` 返回 ≥1 篇真实文章
- `getArticleContent(articleId)` 返回非空的 sourceHtml / cleanedHtml / canonicalMarkdown
- 输出首篇文章标题、URL、内容预览

---

## 11. 协作对接

| 模块 | 负责人 | 对接内容 | 状态 |
|------|--------|----------|------|
| T2 林杨 | 数据模型 | Week2StoragePort 接口、Article/ArticleContent 字段 | ⏳ 等待对齐 |
| T3 周康 | Feed 解析 | Week2FeedParser 接口、Week2ParsedFeed 输出格式 | ⏳ 等待对齐 |
| T4 李欣然 | 订阅源管理 | Week2SubscriptionProvider、订阅源字段 | ⏳ 等待对齐 |
| T6 杜茗天 | 内容清洗 | canonicalMarkdown 生成（目前用 mock） | ⏳ Week 3 |
| T7 余婧 | 阅读器 UI | 通过 Week2ReaderDataPort 读取数据 | ⏳ 等待对齐 |

---

## 12. 已知问题和风险

1. MockFeedParser 使用 `fetch` + `DOMParser`，在 Node.js 环境中需要 `tsx` 支持
2. 真实 RSS/Atom 格式差异较大，可能需要根据实际测试调整解析逻辑
3. 最终需要替换 mock adapters 为 T2/T3/T4 的真实实现
4. 去重策略需要与 T2 确认是否使用数据库级别的唯一约束
