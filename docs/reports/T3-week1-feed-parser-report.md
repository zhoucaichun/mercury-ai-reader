# T3 Week 1 汇报：Feed 解析接口设计与 RSS / Atom 样例

## 1. 周计划对应要求

根据项目集成计划，第 1 周 Feed Parser 模块的交付要求是：

```text
Feed 解析接口设计和至少 1 个 RSS/Atom 解析样例
```

第 1 周整体目标是完成技术定型、简易原型和核心接口草案。因此 T3 本周重点不是完整入库或 UI，而是先把 Feed 解析模块的边界、输入输出和样例验证做出来，避免后续 T4 OPML 和 T5 Sync 没有可调用的数据契约。

## 2. 本周完成内容

本周已完成 T3 Feed 解析模块的第一版接口设计和本地样例验证。

主要完成项：

- 建立 `src/features/feed/parser` 模块目录；
- 定义 Feed 解析对外入口；
- 定义标准化 Feed / Article 类型；
- 定义错误码和 warning 类型；
- 实现 RSS / Atom 解析基础能力；
- 增加本地 RSS / Atom fixture 样例；
- 增加单元测试，验证 RSS / Atom 能解析为统一结构；
- 增加 T3 功能说明文档，方便后续成员对接。

## 3. 接口设计

T3 对外提供统一入口：

```ts
import { addFeedUrl, parseFeedText, parseFeedUrl } from "./src/features/feed/parser/index.js";
```

### 3.1 `addFeedUrl`

用于“用户手动添加 Feed URL”的主流程。

```ts
const result = await addFeedUrl("https://example.com/feed.xml");
```

返回值包含：

- `feed`
- `articles`
- `duplicateArticleCount`
- `warnings`
- `source`

### 3.2 `parseFeedUrl`

用于抓取远程 Feed 并解析，后续可供 T5 Sync 使用。

```ts
const parsed = await parseFeedUrl(feed.url);
```

### 3.3 `parseFeedText`

用于解析已经获取到的 Feed 文本，主要方便测试、mock 和后续其他模块复用。

```ts
const parsed = await parseFeedText(feedXml, "https://example.com/feed.xml");
```

## 4. 标准化数据结构

### 4.1 `StandardFeed`

标准 Feed 输出字段包括：

- `id`
- `url`
- `title`
- `format`
- `fetchedAt`
- `requestedUrl`
- `siteUrl`
- `description`
- `language`
- `imageUrl`

### 4.2 `StandardArticle`

标准文章输出字段包括：

- `id`
- `feedId`
- `feedUrl`
- `title`
- `url`
- `guid`
- `author`
- `summary`
- `contentHtml`
- `contentText`
- `publishedAt`
- `updatedAt`
- `categories`
- `imageUrl`

这些字段是后续 T5 Sync 入库、T6 Reader Pipeline 内容清洗和 T7 文章列表展示的基础。

## 5. RSS / Atom 样例验证

本周加入了两个本地样例：

| 样例文件 | 类型 | 验证内容 |
| --- | --- | --- |
| `test/fixtures/rss-feed.xml` | RSS | 标题、链接、作者、发布时间、摘要、分类、重复文章、缺失字段 |
| `test/fixtures/atom-feed.xml` | Atom | Atom 标题、链接、作者、发布时间、相对链接解析 |

单元测试文件：

```text
test/feed.parser.test.ts
```

测试覆盖：

- RSS Feed 可以解析为 `StandardFeed`；
- RSS item 可以解析为 `StandardArticle`；
- Atom Feed 可以解析为 `StandardFeed`；
- Atom entry 可以解析为 `StandardArticle`；
- 相对链接可以转为绝对链接；
- 缺失标题有兜底；
- 重复文章可以识别并跳过。

## 6. 错误和边界设计

第 1 周已完成错误和 warning 的接口设计。

致命错误使用 `FeedError`，包含稳定 `code`：

- `INVALID_URL`
- `UNSUPPORTED_PROTOCOL`
- `FETCH_FAILED`
- `FETCH_TIMEOUT`
- `HTTP_ERROR`
- `PARSE_FAILED`
- `EMPTY_FEED`

非致命问题进入 `warnings`：

- `ARTICLE_DUPLICATE`
- `ARTICLE_MISSING_TITLE`
- `ARTICLE_MISSING_LINK`
- `ARTICLE_INVALID_DATE`

这样设计的原因是：单篇文章字段异常不应该导致整个 Feed 添加失败，但网络失败、空 Feed 或完全无法解析需要明确返回错误。

## 7. 验证方式

本周可用以下命令验证：

```bash
npm run typecheck
npm test
npm run build
```

验证结果：

```text
npm run typecheck 通过
npm test          通过
npm run build     通过
```

## 8. 与其他任务的关系

### T4 OPML 导入

T4 后续只需要从 OPML 中提取 Feed URL，然后调用：

```ts
await addFeedUrl(feedUrl, { source: "opml" });
```

### T5 Sync 入库

T5 后续可以直接调用：

```ts
const parsed = await parseFeedUrl(feed.url);
```

然后把 `parsed.feed` 和 `parsed.articles` 写入本地存储。

### T6 Reader Pipeline

T6 后续可以使用文章中的：

- `contentHtml`
- `contentText`
- `url`

作为正文清洗和 Markdown 转换的输入。

## 9. 本周结论

Week 1 的 T3 目标已完成：

- 已完成 Feed 解析接口设计；
- 已提供标准化 Feed / Article 输出契约；
- 已完成 RSS / Atom 本地样例解析；
- 已有测试验证；
- 已为 T4 / T5 / T6 后续集成预留稳定接口。

本周 T3 不需要等待 T2 数据库存储或 T7 UI 完成，可以先独立提供解析契约。后续其他模块可以基于该契约继续开发。
