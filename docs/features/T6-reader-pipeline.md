# T6 Reader Pipeline / 内容清洗

> 负责人：杜茗天（jieshibang520） | Week 2 更新

## 1. 模块目标

T6 负责 Mercury 的内容清洗管道，将 T5 Sync 抓取的原始网页 HTML 转换为三层标准化内容，为下游提供统一的 canonicalMarkdown 输入。

- 对原始网页 HTML 做正文提取，去除导航、广告、脚本等噪声；
- 产出三层内容：sourceHtml、cleanedHtml、canonicalMarkdown；
- canonicalMarkdown 是 T7 阅读器、T10 Summary、T11 Translation、T11 Export 的唯一标准输入；
- 提供 pipelineVersion 版本号机制，支持按需重建旧文章内容。

## 2. 数据链路

`T5 Sync -> T6 runPipeline() -> T2 持久化 -> T7/T10/T11 读取 canonicalMarkdown`

1. T5 提供 (articleId, url, sourceHtml)
2. @mozilla/readability 正文提取 → { title, content }
3. 失败降级：jsdom 按 article → main → .post-content → body 查找
4. sanitize-html 白名单清洗（移除 script/style/nav/ad/comment/tracking）
5. turndown 转换 → canonicalMarkdown（fenced code blocks, GFM tables）
6. 组装 PipelineResult，写入 T2

## 3. 技术选型

| 环节 | 库 | 说明 |
|------|-----|------|
| 正文提取 | @mozilla/readability + jsdom | Firefox Reader View 引擎 |
| HTML 清洗 | sanitize-html | 白名单过滤，防 XSS |
| HTML→Markdown | turndown | GFM 表格、围栏代码、自定义规则 |

## 4. 核心接口

所有字段对齐 AGENTS.md 5. Core Data Contracts：camelCase，时间 ISO string。

```typescript
// 主入口
function runPipeline(sourceHtml: string, url?: string): PipelineResult;

interface PipelineResult {
  sourceHtml: string;          // 原始 HTML（T5 提供）
  cleanedHtml: string;         // 清洗后 HTML（中间层）
  canonicalMarkdown: string;   // 规范 Markdown（下游唯一标准输入）
  title: string;               // 文章标题
  url: string;                 // 来源 URL
  pipelineVersion: number;     // 版本号
  cleanedAt: string;           // ISO 8601
}
```

### Week 2 主链路接口（AGENTS.md 5A）

```typescript
// 从 src/features/reader/pipeline/index.ts 导出
export interface Week2ReaderPipeline {
  runPipeline(sourceHtml: string, url?: string): Promise<Week2ArticleContent>;
}

// Week2ArticleContent 见 AGENTS.md 5A
// { articleId, sourceHtml, cleanedHtml, canonicalMarkdown, createdAt, updatedAt }
```

## 5. 下游消费

| 下游 | 字段 | 方式 |
|------|------|------|
| T2 存储 | PipelineResult 全部 | db.save() |
| T7 阅读器 | canonicalMarkdown | markdown-it 渲染 |
| T10 Summary | canonicalMarkdown | Prompt {{canonicalMarkdown}} |
| T11 Translation | canonicalMarkdown | Prompt {{canonicalMarkdown}} |
| T11 Export | canonicalMarkdown | 写入 .md 文件 |

## 6. 测试样例

两篇 fixture（路径 `docs/features/T6-reader-pipeline-fixtures/`）：

| 样例 | 场景 | 源字符 | 噪声 |
|------|------|--------|------|
| sample_blog.html | 中文技术博客 | ~7,800 | 导航/侧边栏/广告/分享/评论/GA |
| sample_news.html | 英文科技新闻 | ~8,500 | header ad/newsletter/Disqus/LinkedIn |

预期去噪率 62-66%。T6 可用 fixture 独立开发测试，不依赖 T5。

## 7. 与其他模块的对齐

| 对齐项 | 来源 | 结论 |
|--------|------|------|
| ArticleContent 字段 | T5 #5 | sourceHtml / cleanedHtml / canonicalMarkdown |
| createdAt 类型 | AGENTS.md 5 | ISO string |
| Sync 触发方式 | T5 #5 | IReaderPipeline.processArticle(articleId) |
| Prompt 变量名 | T10 #2 | {{canonicalMarkdown}} |
| canonicalMarkdown 命名 | T10 #2 / AGENTS.md 5 | 已统一 |
| Agent 状态 | T8 #3 / AGENTS.md 6 | idle/queued/running/succeeded/failed/cancelled |

## 8. Week 2 交付

- [x] 文档按 AGENTS.md 重命名为单文件 T6-reader-pipeline.md
- [x] 字段统一为 camelCase + ISO string
- [x] 创建 src/features/reader/pipeline/ 代码目录
- [x] 导出 Week2ReaderPipeline 接口
- [ ] T1 骨架就绪后实现 runPipeline()
- [ ] 与 T5 联调 Sync → Pipeline
- [ ] 用 fixture 验证清洗效果

## 9. 历史

- Week 1：Pipeline 分析报告 + 接口草案 + 测试样例（#9）
- Week 2：按 AGENTS.md 对齐字段命名、文档路径、代码路径
