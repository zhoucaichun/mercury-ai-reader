# T3 Week 2 汇报：真实 Feed 解析与数据链路对接准备

## 1. 周计划对应要求

根据项目集成计划，第 2 周 Feed Parser 模块的交付要求是：

```text
支持 2-3 个真实 Feed 解析
```

第 2 周整体目标是让真实文章能够进入系统，打通 Feed / OPML / Sync / 本地存储 / 文章列表主链路。T3 在这一周的重点是把 Week 1 的接口和样例扩展到真实网络 Feed，保证输出可以交给 T5 Sync 使用。

## 2. 本周完成内容

本周在 Week 1 的接口基础上，完成真实 Feed 解析能力和 smoke 验证。

主要完成项：

- 实现远程 Feed 抓取；
- 支持 HTTP / HTTPS Feed URL；
- 自动补全未带协议的 URL；
- 处理网络失败、超时、HTTP 错误和空响应；
- 支持 RSS / Atom 真实 Feed；
- 可选支持 JSON Feed；
- 对真实 Feed 输出统一 `StandardFeed` / `StandardArticle`；
- 增加真实 Feed smoke 测试脚本；
- 在 README 和功能文档中记录测试 Feed 列表和验证命令。

## 3. 真实 Feed 测试脚本

真实 Feed smoke 测试脚本位于：

```text
scripts/smoke-feed.ts
```

运行命令：

```bash
npm run smoke:feed
```

默认测试 Feed：

| Feed | 类型 | 说明 |
| --- | --- | --- |
| `https://hnrss.org/frontpage` | RSS | Hacker News frontpage RSS |
| `https://xkcd.com/atom.xml` | Atom | xkcd Atom Feed |
| `https://www.theverge.com/rss/index.xml` | Atom | The Verge Feed |

也可以传入自定义 Feed：

```bash
npm run smoke:feed -- https://example.com/rss.xml
```

## 4. 真实 Feed 验证结果

本周 smoke 测试已通过 3 个真实 Feed。

一次实际输出示例：

```text
OK | RSS | Hacker News: Front Page | 20 articles
OK | ATOM | xkcd.com | 4 articles
OK | ATOM | The Verge | 10 articles
```

这证明 T3 已满足第 2 周“支持 2-3 个真实 Feed 解析”的要求。

## 5. 标准化输出对接 T5 Sync

T5 Sync 可以直接使用 T3 输出完成入库。

建议调用方式：

```ts
import { parseFeedUrl } from "./src/features/feed/parser/index.js";

const parsed = await parseFeedUrl(feed.url);

for (const article of parsed.articles) {
  // T5 在这里做去重、入库、同步状态更新
}
```

T5 可重点使用这些字段：

- `parsed.feed.id`
- `parsed.feed.url`
- `parsed.feed.title`
- `article.id`
- `article.guid`
- `article.url`
- `article.title`
- `article.summary`
- `article.contentHtml`
- `article.contentText`
- `article.publishedAt`
- `article.updatedAt`

去重建议：

1. 优先使用 `article.guid`；
2. 其次使用 `article.url`；
3. 如需本地稳定主键，可使用 `article.id`。

## 6. 错误处理对接 Sync / UI

T3 的致命错误会抛出 `FeedError`，T5 或 UI 可以根据 `code` 给出提示。

示例：

```ts
import { isFeedError, parseFeedUrl } from "./src/features/feed/parser/index.js";

try {
  const parsed = await parseFeedUrl(feed.url);
} catch (error) {
  if (isFeedError(error)) {
    console.error(error.code, error.message);
  }
}
```

常见错误码：

| 错误码 | 场景 |
| --- | --- |
| `INVALID_URL` | 用户输入空 URL 或非法 URL |
| `UNSUPPORTED_PROTOCOL` | 用户输入 `file://` 等非 HTTP/HTTPS 地址 |
| `FETCH_TIMEOUT` | Feed 请求超时 |
| `HTTP_ERROR` | Feed 地址返回 404 / 500 等状态 |
| `PARSE_FAILED` | Feed 内容不是合法 RSS / Atom / JSON |
| `EMPTY_FEED` | Feed 没有文章 |

非致命问题会进入 `warnings`，不会阻断整个 Feed：

- 重复文章；
- 缺失标题；
- 缺失链接；
- 无效日期。

## 7. 第 2 周测试覆盖

除真实 Feed smoke 测试外，本地测试继续覆盖：

- RSS 解析；
- Atom 解析；
- JSON Feed 解析；
- 添加 Feed URL；
- HTTP 错误；
- 空 Feed；
- JSON 解析失败；
- 重复文章；
- 缺失标题；
- 缺失链接；
- 无效日期；
- 相对链接转绝对链接。

验证命令：

```bash
npm run typecheck
npm test
npm run build
npm run smoke:feed
```

验证结果：

```text
npm run typecheck 通过
npm test          通过
npm run build     通过
npm run smoke:feed 通过
```

## 8. 耦合与等待关系评估

T3 和 T4 / T5 属于同一条 Feed 数据链路，但当前设计降低了等待关系。

### 不需要等待的部分

T3 不需要等待以下模块完成：

- 不需要等待 T2 数据库存储，因为 T3 先输出标准化对象；
- 不需要等待 T4 OPML，因为 OPML 最终只是提供多个 Feed URL；
- 不需要等待 T5 Sync，因为 T5 是调用 T3 的结果入库；
- 不需要等待 T7 UI，因为 T3 可以通过测试和 smoke 脚本独立验证。

### 需要协作的部分

后续集成时需要和以下模块确认字段映射：

- T2：`Feed`、`Article` 数据表字段如何映射 `StandardFeed` / `StandardArticle`；
- T4：OPML 导入后如何批量调用 `addFeedUrl`；
- T5：Sync 去重策略采用 `guid`、`url` 还是本地 `id`；
- T6：正文清洗优先使用 `contentHtml` 还是 `contentText`。

## 9. 本周结论

Week 2 的 T3 目标已完成：

- 已支持 3 个真实 Feed 解析；
- 已支持 RSS / Atom，额外支持 JSON Feed；
- 已实现远程抓取和错误处理；
- 已提供 smoke 测试脚本；
- 已提供可交给 T5 Sync 的标准化输出；
- 当前 T3 不被其他模块阻塞，后续主要工作是配合 T2 / T4 / T5 做字段映射和集成调试。
