# T3 Week 4 计划：AI 主链路阶段的 Feed 数据支持

## 1. 周计划对应要求

根据项目集成计划，第 4 周的项目重点是：

```text
AI 功能 + 用量统计 + 单篇导出
```

第 4 周没有给 T3 单独安排新的主功能开发任务。T3 在这一周的定位是配合集成，保证 Feed 解析输出能继续支撑 T5 Sync、T6 Reader Pipeline、T10 Summary、T11 Translation 和 Export 链路。

## 2. 本周 T3 职责边界

本周 T3 不负责实现：

- Summary Agent；
- Translation Agent；
- LLM Provider；
- LLM Usage 统计；
- Markdown 导出；
- Reader Pipeline 清洗逻辑；
- 数据库入库逻辑。

本周 T3 负责保证：

- Feed URL 能稳定解析；
- 标准化文章数据结构不随意变化；
- 下游能拿到标题、链接、摘要、正文 HTML / 文本和发布时间；
- 出错时有明确 `FeedError`；
- 非致命问题记录为 `warnings`，不阻断整条数据链路。

## 3. 对 AI 链路的间接支持

AI 链路的标准输入来自 T6 生成的 canonical Markdown，但 T6 的输入来源之一是 T3 解析出的文章信息。

T3 对 AI 链路的间接支持关系如下：

```text
Feed URL
-> T3 解析出 StandardArticle
-> T5 Sync 入库
-> T6 Reader Pipeline 清洗正文并生成 Markdown
-> T10 Summary / T11 Translation 使用 Markdown
```

因此，第 4 周 T3 的重点是保证链路前端稳定，避免后续 AI 功能因为文章基础字段缺失而无法运行。

## 4. 可供下游使用的字段

T3 输出中对第 4 周 AI 链路有价值的字段：

| 字段 | 下游用途 |
| --- | --- |
| `article.title` | Summary / Translation 展示标题上下文 |
| `article.url` | Reader Pipeline 抓取原文 |
| `article.summary` | 摘要 fallback 或文章列表摘要 |
| `article.contentHtml` | Reader Pipeline 清洗输入 |
| `article.contentText` | Reader Pipeline fallback 文本 |
| `article.publishedAt` | 文章排序和展示 |
| `article.author` | 阅读页元信息 |
| `article.categories` | 后续分类或筛选扩展 |

## 5. 集成风险与处理方式

### 5.1 风险：不同 Feed 正文字段差异大

处理方式：

- 保留 `contentHtml`；
- 提供 `contentText`；
- 保留 `summary`；
- 保留 `url` 给 T6 抓取完整网页。

### 5.2 风险：Feed 中日期格式不稳定

处理方式：

- 日期能解析则统一转 ISO 字符串；
- 日期无法解析则记录 warning；
- 不因单篇文章日期异常中断解析。

### 5.3 风险：下游字段映射不一致

处理方式：

- 在 `src/features/feed/parser/types.ts` 中集中定义类型；
- 在 `docs/features/T3-feed-parser.md` 中记录标准字段；
- 建议 T2 / T5 直接复用 `StandardFeed` 和 `StandardArticle`。

## 6. 本周验证方式

T3 在 Week 4 的验证重点仍是保证基础 Feed 数据稳定。

验证命令：

```bash
npm run typecheck
npm test
npm run build
npm run smoke:feed
```

验证项：

- TypeScript 类型契约稳定；
- 本地 RSS / Atom / JSON Feed 测试通过；
- 真实 Feed smoke 测试通过；
- 输出字段可供 Reader Pipeline 和 AI 链路前置使用。

## 7. 本周计划结论

Week 4 中 T3 没有独立新增主功能，计划以配合集成为主：

- 保持 Feed 解析接口稳定；
- 保持标准化文章字段稳定；
- 为 T5 Sync 和 T6 Reader Pipeline 提供输入；
- 间接支撑 Summary / Translation / Export 的上游数据链路；
- 如 AI 链路发现文章输入不足，T3 根据反馈补充字段或兼容更多 Feed 格式。
