# T3 Week 3 汇报：真实 Feed 解析问题修复与 Reader Pipeline 支持

## 1. 周计划对应要求

根据《Mercury 五周排期与每周集成计划》，第 3 周 T3 的交付要求是：

```text
修复真实 Feed 解析中发现的问题
```

第 3 周项目重点是 Reader Pipeline 和阅读体验。T3 本周职责不是实现内容清洗，而是保证 Feed 解析结果稳定，尽量为 T6 提供可用的 `contentHtml`、`contentText` 和文章 URL。

## 2. 本周完成内容

本周围绕真实 Feed 中常见的异常情况，对 T3 解析模块做稳定性补充：

- 保留 RSS / Atom 解析结果中的原始 HTML 内容；
- 提供 `contentHtml` 和 `contentText` 字段，方便 T6 Reader Pipeline 使用；
- 处理文章缺失标题的情况；
- 处理文章缺失链接的情况；
- 处理发布时间或更新时间非法的情况；
- 处理重复文章，避免下游重复入库；
- 支持相对链接转绝对链接；
- 补充单元测试覆盖真实 Feed 解析中常见边界。

## 3. 面向 Reader Pipeline 的字段支持

T6 Reader Pipeline 后续可以优先读取以下字段：

| 字段 | 用途 |
| --- | --- |
| `article.contentHtml` | Feed 中自带的 HTML 正文，可作为内容清洗输入 |
| `article.contentText` | Feed 中可提取的纯文本内容，可作为 fallback |
| `article.summary` | Feed 摘要，可用于文章列表或清洗失败时展示 |
| `article.url` | 原文链接，可用于抓取完整网页 HTML |
| `article.title` | 文章标题 |
| `article.publishedAt` | 发布时间 |

## 4. 已处理的真实 Feed 问题

- 重复文章：优先按 `guid` 去重，其次按 URL 去重，并记录 warning。
- 缺失标题：优先使用摘要兜底，否则生成 `Untitled article N`。
- 缺失链接：生成稳定本地 URL，并记录 `ARTICLE_MISSING_LINK`。
- 非法日期：忽略无效日期字段，不中断整篇文章解析。

## 5. 验证方式

```bash
npm run typecheck
npm test
npm run smoke:feed
```

## 6. 本周结论

Week 3 的 T3 要求已覆盖：

- 已针对真实 Feed 常见问题增加稳定处理；
- 已提供 Reader Pipeline 所需的内容字段；
- 已保证异常文章不会轻易阻断整个 Feed；
- 后续主要根据 T5 / T6 集成反馈继续小修。
