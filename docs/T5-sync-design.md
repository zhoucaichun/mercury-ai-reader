# T5 Sync / 文章同步 / 入库 - 设计方案

**负责人**：T5 夏培玮 (maipower)
**Week 1 目标**：设计同步流程、接口和数据结构，用于周五汇报
**创建时间**：2026-05-28

---

## 上下文

**问题**：Mercury AI Reader 项目 Week 1 需要各模块提交设计方案。T5（夏培玮）负责 Sync / 文章同步 / 入库模块。

**目标**：设计同步流程、接口和数据结构，用于周五汇报。

---

## 探索阶段

### 项目现状
- 项目仅有文档，无源代码
- Git remote: https://github.com/zhoucaichun/mercury-ai-reader.git
- 已有分支：main, feature/T8-llm-agent, feature/T9-llm-provider-usage
- 目标分支：feature/T5-cleaned-markdown（用户指定）

### T5 任务要求（来自任务文档）

**任务内容**：
- 根据订阅源刷新文章
- 调用 Feed 解析结果
- 文章去重
- 将新文章写入本地存储
- 记录同步状态和错误
- 为 UI 提供同步进度或状态

**验收标准**：
- 点击或调用 Sync 后能拉取文章
- 重复文章不会重复入库
- 同步成功和失败状态清楚
- 能和 T2、T3、T4 对接
- 单个订阅源失败不影响其他订阅源同步
- 能记录最近同步时间

### 协作依赖关系

**T5 所属协作小组**：Feed 数据链路（T3/T4/T5）

**依赖关系**：
- 输入来源：T3（Feed 解析）、T4（OPML 解析）
- 存储依赖：T2（数据模型/本地存储）
- 数据消费：T6（内容清洗）、T7（UI 展示）

---

## 1. 同步流程架构

```
┌─────────────────────────────────────────────────────────┐
│                     Sync Service                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐      ┌──────────────┐                │
│  │ Sync All     │      │ Sync Single  │                │
│  └──────┬───────┘      └──────┬───────┘                │
│         │                     │                          │
│         ▼                     ▼                          │
│  ┌──────────────────────────────────────────────┐    │
│  │         Get Active Feeds (T2 Storage)         │    │
│  └──────────────────────┬────────────────────────┘    │
│                         │                                │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐          │
│  │ Feed 1    │   │ Feed 2    │   │ Feed N    │          │
│  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘          │
│        │               │               │                  │
│        ▼               ▼               ▼                  │
│  ┌────────────────────────────────────────────────┐     │
│  │  Fetch Feed (T3/T4 Parser)                    │     │
│  └──────────────────┬─────────────────────────────┘     │
│                     │                                    │
│                     ▼                                    │
│  ┌────────────────────────────────────────────────┐     │
│  │  Parse Articles → Standardized Format          │     │
│  └──────────────────┬─────────────────────────────┘     │
│                     │                                    │
│                     ▼                                    │
│  ┌────────────────────────────────────────────────┐     │
│  │  Deduplication (URL/GUID/Title+PubDate)        │     │
│  └──────────────────┬─────────────────────────────┘     │
│                     │                                    │
│         ┌───────────┴───────────┐                      │
│         ▼                       ▼                        │
│  ┌─────────────┐         ┌─────────────┐                │
│  │ New Articles│         │ Existing    │                │
│  │             │         │ (Skip)      │                │
│  └──────┬──────┘         └─────────────┘                │
│         │                                                     │
│         ▼                                                     │
│  ┌────────────────────────────────────────────────┐     │
│  │  Save to Storage (T2 Database)                 │     │
│  └──────────────────┬─────────────────────────────┘     │
│                     │                                    │
│                     ▼                                    │
│  ┌────────────────────────────────────────────────┐     │
│  │  Update Sync Status & Timestamp                │     │
│  └──────────────────┬─────────────────────────────┘     │
│                     │                                    │
│                     ▼                                    │
│  ┌────────────────────────────────────────────────┐     │
│  │  Emit Progress Event → UI (T7)                │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 核心接口设计

```typescript
/**
 * Sync 模块核心接口
 * 位置：src/features/sync/types.ts
 */

import { Feed, Article, SyncStatus, SyncResult } from '@/core/types';

/**
 * 同步服务接口
 */
export interface ISyncService {
  /**
   * 同步所有活跃的订阅源
   */
  syncAll(options?: SyncOptions): Promise<SyncAllResult>;

  /**
   * 同步单个订阅源
   */
  syncFeed(feedId: string, options?: SyncOptions): Promise<SyncResult>;

  /**
   * 获取全局同步状态
   */
  getSyncStatus(): Promise<GlobalSyncStatus>;

  /**
   * 取消正在进行的同步
   */
  cancelSync(): Promise<void>;

  /**
   * 订阅同步进度事件（供 UI 使用）
   */
  onProgress(callback: (progress: SyncProgress) => void): void;
}

/**
 * 同步选项
 */
export interface SyncOptions {
  /**
   * 是否强制刷新（忽略缓存）
   */
  forceRefresh?: boolean;

  /**
   * 单次同步的最大文章数
   */
  maxArticles?: number;

  /**
   * 超时时间（毫秒）
   */
  timeout?: number;
}

/**
 * 同步进度（供 UI 使用）
 */
export interface SyncProgress {
  /**
   * 总订阅源数量
   */
  totalFeeds: number;

  /**
   * 已处理订阅源数量
   */
  processedFeeds: number;

  /**
   * 当前正在同步的订阅源名称
   */
  currentFeed?: string;

  /**
   * 总文章数
   */
  totalArticles: number;

  /**
   * 新增文章数
   */
  newArticles: number;

  /**
   * 状态
   */
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

  /**
   * 错误信息（如果有）
   */
  errors?: SyncError[];
}

/**
 * 单个订阅源同步结果
 */
export interface SyncResult {
  /**
   * 订阅源 ID
   */
  feedId: string;

  /**
   * 同步状态
   */
  status: 'success' | 'partial' | 'failed';

  /**
   * 解析到的文章总数
   */
  totalParsed: number;

  /**
   * 新增文章数
   */
  newArticles: number;

  /**
   * 已存在文章数（被去重过滤）
   */
  existingArticles: number;

  /**
   * 同步开始时间
   */
  startedAt: number;

  /**
   * 同步结束时间
   */
  completedAt?: number;

  /**
   * 错误信息
   */
  error?: SyncError;
}

/**
 * 全局同步结果
 */
export interface SyncAllResult {
  /**
   * 各个订阅源的同步结果
   */
  results: SyncResult[];

  /**
   * 汇总统计
   */
  summary: {
    totalFeeds: number;
    successCount: number;
    partialCount: number;
    failedCount: number;
    totalNewArticles: number;
  };
}

/**
 * 同步错误
 */
export interface SyncError {
  /**
   * 错误类型
   */
  type: 'network' | 'parse' | 'storage' | 'unknown';

  /**
   * 错误消息
   */
  message: string;

  /**
   * 错误详情
   */
  details?: any;

  /**
   * 发生时间
   */
  timestamp: number;
}
```

---

## 3. 数据结构设计（需要与 T2 对齐）

```typescript
/**
 * Sync 模块使用的数据结构
 * 位置：src/core/types.ts（与 T2 共享）
 */

/**
 * 订阅源（来自 T4）
 */
export interface Feed {
  id: string;
  url: string;
  title?: string;
  description?: string;
  isActive: boolean;
  lastSyncAt?: number; // 上次同步时间戳
  createdAt: number;
  updatedAt: number;
}

/**
 * 文章（来自 T3 解析 + T5 入库）
 */
export interface Article {
  id: string;

  /**
   * 所属订阅源
   */
  feedId: string;

  /**
   * 文章 URL（用作去重 key 之一）
   */
  url: string;

  /**
   * GUID（如果 Feed 提供，优先用于去重）
   */
  guid?: string;

  /**
   * 标题（用于辅助去重）
   */
  title: string;

  /**
   * 发布时间（用于辅助去重）
   */
  publishedAt?: number;

  /**
   * 作者
   */
  author?: string;

  /**
   * 摘要
   */
  summary?: string;

  /**
   * 原始内容 HTML
   */
  contentHtml?: string;

  /**
   * 文章状态
   */
  status: 'pending' | 'synced' | 'cleaned' | 'failed';

  /**
   * 创建时间
   */
  createdAt: number;

  /**
   * 更新时间
   */
  updatedAt: number;
}

/**
 * 文章内容（与 Article 分表存储）
 */
export interface ArticleContent {
  /**
   * 关联的文章 ID
   */
  articleId: string;

  /**
   * 原始 HTML
   */
  sourceHtml?: string;

  /**
   * 清洗后的 HTML（由 T6 生成）
   */
  cleanedHtml?: string;

  /**
   * Markdown（由 T6 生成）
   */
  canonicalMarkdown?: string;

  /**
   * 创建时间
   */
  createdAt: number;

  /**
   * 更新时间
   */
  updatedAt: number;
}

/**
 * 同步状态（订阅源级别）
 */
export interface FeedSyncStatus {
  /**
   * 订阅源 ID
   */
  feedId: string;

  /**
   * 同步状态
   */
  status: 'idle' | 'running' | 'success' | 'failed';

  /**
   * 上次同步时间
   */
  lastSyncAt?: number;

  /**
   * 上次同步结果
   */
  lastResult?: SyncResult;

  /**
   * 错误信息
   */
  error?: string;
}
```

---

## 4. 去重策略设计

**去重优先级**（按优先级排序）：

1. **GUID**（如果 Feed 提供）
   - 最可靠的唯一标识
   - 优先使用 guid 去重

2. **URL**
   - 文章的永久链接
   - 如果没有 guid，使用 URL

3. **组合键：标题 + 发布时间**
   - 最后的兜底方案
   - 当 URL 和 GUID 都不可用时使用

**去重逻辑**：

```typescript
/**
 * 去重逻辑伪代码
 */
function deduplicateArticles(newArticles: ParsedArticle[], existingArticles: Article[]): {
  new: Article[];
  existing: Article[];
} {
  const existingKeys = new Set<string>();

  // 构建已存在文章的 key 集合
  for (const article of existingArticles) {
    const key = article.guid || article.url || `${article.title}_${article.publishedAt}`;
    existingKeys.add(key);
  }

  const new: Article[] = [];
  const existing: Article[] = [];

  for (const parsed of newArticles) {
    const key = parsed.guid || parsed.url || `${parsed.title}_${parsed.publishedAt}`;

    if (existingKeys.has(key)) {
      existing.push(parsed);
    } else {
      new.push(parsed);
    }
  }

  return { new, existing };
}
```

---

## 5. 错误处理策略

**原则**：单个订阅源失败不影响其他订阅源

```typescript
/**
 * 错误处理伪代码
 */
async function syncAllFeeds(): Promise<SyncAllResult> {
  const feeds = await getActiveFeeds();
  const results: SyncResult[] = [];

  // 逐个处理订阅源，用 try-catch 隔离错误
  for (const feed of feeds) {
    try {
      const result = await syncFeed(feed.id);
      results.push(result);
    } catch (error) {
      // 单个订阅源失败，记录但继续处理其他订阅源
      results.push({
        feedId: feed.id,
        status: 'failed',
        totalParsed: 0,
        newArticles: 0,
        existingArticles: 0,
        startedAt: Date.now(),
        completedAt: Date.now(),
        error: {
          type: error.type || 'unknown',
          message: error.message,
          timestamp: Date.now()
        }
      });
    }
  }

  // 汇总结果
  return {
    results,
    summary: calculateSummary(results)
  };
}
```

**错误分类**：

| 类型 | 场景 | 处理方式 |
|------|------|----------|
| network | 网络超时、DNS 解析失败 | 标记失败，不影响其他订阅源 |
| parse | Feed 格式错误、解析失败 | 标记失败，记录错误详情 |
| storage | 数据库写入失败 | 标记失败，保留已解析数据供重试 |
| unknown | 未预期错误 | 标记失败，记录错误堆栈 |

---

## 6. Mock 数据设计

用于 Week 1 汇报和前期开发：

```typescript
/**
 * Mock Feed 数据
 */
const mockFeeds: Feed[] = [
  {
    id: 'feed-1',
    url: 'https://example.com/feed.xml',
    title: '示例博客',
    description: '这是一个示例订阅源',
    isActive: true,
    createdAt: 1716883200000,
    updatedAt: 1716883200000
  }
];

/**
 * Mock 解析结果（模拟 T3/T4 的输出）
 */
const mockParsedArticles = [
  {
    id: 'art-1',
    feedId: 'feed-1',
    url: 'https://example.com/article-1',
    guid: 'guid-1',
    title: '示例文章标题',
    publishedAt: 1716883200000,
    author: '张三',
    summary: '这是文章摘要...',
    contentHtml: '<p>文章内容...</p>'
  },
  {
    id: 'art-2',
    feedId: 'feed-1',
    url: 'https://example.com/article-2',
    guid: 'guid-2',
    title: '另一篇文章',
    publishedAt: 1716969600000,
    author: '李四',
    summary: '另一篇摘要...',
    contentHtml: '<p>另一篇内容...</p>'
  }
];

/**
 * Mock 同步结果
 */
const mockSyncResult: SyncResult = {
  feedId: 'feed-1',
  status: 'success',
  totalParsed: 2,
  newArticles: 2,
  existingArticles: 0,
  startedAt: 1716883200000,
  completedAt: 1716883260000
};
```

---

## 7. 目录结构建议

```
src/
  features/
    sync/
      types.ts              # Sync 相关类型定义
      sync.service.ts      # SyncService 核心实现
      deduplication.ts     # 去重逻辑
      mock/
        mock-data.ts       # Mock 数据
        mock-sync.ts       # Mock 实现（用于 Week 1）
      index.ts             # 导出
  core/
    types.ts               # 共享类型（与 T2 对齐）
    storage.interface.ts   # 存储接口（T2 提供）
```

---

## 8. 与其他模块的接口对接

### 与 T3（Feed 解析）对接

```typescript
// T3 提供的接口（假设）
interface IFeedParser {
  parse(url: string): Promise<ParsedFeed>;
}

interface ParsedFeed {
  articles: ParsedArticle[];
}

// Sync 调用
const parsed = await feedParser.parse(feed.url);
```

### 与 T4（OPML 解析）对接

```typescript
// T4 提供的接口（假设）
interface IOpmlParser {
  parse(opmlContent: string): ParsedOpml;
}

interface ParsedOpml {
  feeds: Array<{
    url: string;
    title?: string;
  }>;
}

// Sync 通过 T2 获取订阅源列表，T4 负责导入
```

### 与 T2（数据模型/存储）对接

```typescript
// T2 提供的接口（需要确认）
interface IStorage {
  // 获取活跃订阅源
  getActiveFeeds(): Promise<Feed[]>;

  // 检查文章是否存在
  articleExists(key: string): Promise<boolean>;

  // 保存文章
  saveArticle(article: Article): Promise<void>;

  // 批量保存文章
  saveArticles(articles: Article[]): Promise<void>;

  // 更新订阅源同步状态
  updateFeedSyncStatus(feedId: string, status: SyncStatus): Promise<void>;
}
```

### 与 T6（内容清洗）对接

```typescript
// Sync 完成后通知 T6
interface IReaderPipeline {
  processArticle(articleId: string): Promise<void>;
}

// 可选：同步后自动触发清洗
if (options.autoClean) {
  for (const article of newArticles) {
    await readerPipeline.processArticle(article.id);
  }
}
```

### 与 T7（UI）对接

```typescript
// Sync 进度事件
interface SyncProgressEvent {
  type: 'progress' | 'complete' | 'error';
  data: SyncProgress | SyncAllResult;
}

// UI 订阅
syncService.onProgress((event) => {
  updateUI(event);
});
```

---

## 9. 需要与 T2 确认的问题

在实现前需要与 T2（林杨）确认：

1. **Article 和 ArticleContent 是分开存储还是合并存储？**
   - 建议：分开存储，Article 存元数据，ArticleContent 存内容

2. **去重的 primary key 是什么？**
   - 选项 A：仅用 GUID
   - 选项 B：仅用 URL
   - 选项 C：GUID > URL > 标题+时间（优先级排序）

3. **同步状态是存在 Feed 表里还是独立的 SyncStatus 表？**
   - 建议：Feed 表里存 lastSyncAt，独立表存详细同步历史

4. **文章失败的存储策略？**
   - 是否保存失败的文章？
   - 失败后是否重试？

5. **createdAt / updatedAt 用什么类型？**
   - 建议：number（Unix 时间戳毫秒）

6. **同一家订阅源有多次更新，如何处理？**
   - 是否需要版本历史？
   - 还是最新的覆盖旧的？

---

## 10. Week 1 交付物清单

**方案文档**（本文档）：
- ✅ 同步流程设计
- ✅ 接口设计
- ✅ 数据结构设计
- ✅ 去重策略
- ✅ 错误处理策略
- ✅ Mock 数据设计

**可选附加**（如果时间允许）：
- [ ] 类型定义文件（TypeScript）
- [ ] Mock 实现文件
- [ ] 流程图（可视化）
- [ ] 接口对接确认记录

---

## 验证方式

Week 1 汇报时可以展示：

1. **流程图**：清晰展示从订阅源到入库的完整流程
2. **接口设计**：展示核心接口和类型定义
3. **Mock 数据**：演示用 mock 数据跑通流程
4. **协作对接**：展示与 T2/T3/T4/T6/T7 的接口对接方案

---

## 下一步行动

1. ✅ 完成方案文档设计
2. ⏳ 与 T2（林杨）确认数据模型细节
3. ⏳ 提交 PR 到 GitHub
4. ⏳ 准备周五汇报材料

---

**文档版本**：v1.0
**最后更新**：2026-05-28
