# T3 Week 3 汇报：Feed Parser 回归与重复同步验证

## 1. 周计划对应要求

根据《第三周各组员任务》，第 3 周 T3 周康的交付要求是：

```text
1. 基于最新 main 测试至少 3 个真实 Feed，包含中文源和英文源。
2. 检查输出 title、url、summary、contentHtml、contentText、publishedAt。
3. 如真实源解析出现 contentHtml / contentText 为空，补 fallback。
4. 配合 T5 确认重复同步不会生成重复文章。
提交前自测：3 个真实 Feed、空正文 fallback、npm run smoke:week2 不被破坏。
```

本次实现基于最新 `main` 新建第三周分支 `feature/T3-week3-feed-parser-regression`，不继续叠加 Week 1 / Week 2 旧分支。

## 2. 本周完成内容

本周围绕真实 Feed 回归和 T5 Sync 联调，对 T3 解析模块做稳定性补充：

- `scripts/smoke-feed.ts` 默认测试 3 个真实 Feed，覆盖中文源和英文源；
- smoke 脚本检查 `title`、`url`、`summary`、`contentHtml`、`contentText`、`publishedAt` 字段；
- `parser.ts` 增加正文 fallback，真实源缺少 `contentHtml`、`contentText` 或 `summary` 时自动补齐；
- 增加 `ARTICLE_CONTENT_FALLBACK` warning，记录 fallback 内容生成情况；
- `npm run smoke:week2` 改为通过 T3 的 `week2FeedParser` 解析真实 Feed；
- `smoke:week2` 连续执行两次 `syncAll()`，验证第二次同步不会新增重复 Feed 或文章；
- 内存 storage adapter 按 `feedUrl` 复用已有 Feed，保证重复同步验证符合真实数据库行为；
- 补充单元测试覆盖稀疏正文 fallback。

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

## 4. 已验证的真实 Feed

`npm run smoke:feed` 当前默认验证：

| Feed | 类型 | 语言 | 验证结果 |
| --- | --- | --- | --- |
| `https://www.ruanyifeng.com/blog/atom.xml` | Atom | 中文 | 通过 |
| `https://css-tricks.com/feed/` | RSS | 英文 | 通过 |
| `https://xkcd.com/atom.xml` | Atom | 英文 | 通过，summary 使用 fallback |

每个默认 Feed 都至少找到一篇文章具备：

- `title`
- `url`
- `summary`
- `contentHtml`
- `contentText`
- `publishedAt`

## 5. 已处理的真实 Feed 问题

- 重复文章：优先按 `guid` 去重，其次按 URL 去重，并记录 warning。
- 缺失标题：优先使用摘要兜底，否则生成 `Untitled article N`。
- 缺失链接：生成稳定本地 URL，并记录 `ARTICLE_MISSING_LINK`。
- 非法日期：忽略无效日期字段，不中断整篇文章解析。
- 缺失正文 HTML：使用纯文本、摘要或标题生成 `<p>...</p>` fallback。
- 缺失正文纯文本：从 HTML 提取，必要时使用摘要或标题 fallback。
- 缺失摘要：使用 `contentText` 生成摘要 fallback。

## 6. 验证结果

```bash
npm run typecheck   # passed
npm test            # 14 files passed, 124 tests passed
npm run build       # passed
npm run smoke:feed  # 3 real feeds passed
npm run smoke:week2 # passed; repeated sync saved 0 duplicate articles
```

`npm run smoke:week2` 验证结果：

- 第一次同步：2 个真实订阅源，保存 18 篇文章；
- 第二次同步：保存 0 篇新文章；
- 第二次同步后 Feed 数量仍为 2，文章数量仍为 18；
- `getArticleContent(articleId)` 返回非空 `sourceHtml`、`cleanedHtml`、`canonicalMarkdown`。

## 7. 本周结论

Week 3 的 T3 要求已覆盖：

- 已基于最新 main 做第三周 Feed Parser 回归；
- 已验证 3 个真实 Feed，包含中文和英文源；
- 已检查并补齐 `title`、`url`、`summary`、`contentHtml`、`contentText`、`publishedAt` 输出；
- 已保证 `npm run smoke:week2` 不被破坏，并新增重复同步不重复的回归检查。
