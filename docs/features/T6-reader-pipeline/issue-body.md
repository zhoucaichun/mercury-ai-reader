## 1. 模块目标

T6 负责 Mercury 的内容清洗管道，将 T5 Sync 抓取的原始网页 HTML 转换为三层标准化内容，为下游阅读器、AI Agent 和导出模块提供统一的 canonical Markdown 输入。

本模块职责包括：

- 对原始网页 HTML 做正文提取，去除导航、广告、脚本等噪声；
- 产出三层内容：source HTML、cleaned HTML、canonical Markdown；
- 保证 canonical Markdown 是下游模块的唯一标准输入；
- 提供版本号机制，支持按需重建旧文章内容；
- 处理提取失败、空内容、损坏 HTML 等边界情况。

## 2. T6 数据链路方案

主链路如下：

`T5 Sync 抓取 sourceHTML -> T6 正文提取 -> T6 HTML 清洗 -> T6 Markdown 转换 -> T2 持久化三层内容 -> T7/T10/T11 读取 canonicalMarkdown`

详细步骤：

1. T5 Sync 完成文章抓取，提供 `(articleId, url, sourceHtml)`。
2. T6 调用 `@mozilla/readability` 对 source HTML 做正文提取，得到 `{ title, content }`。
3. 如果 readability 提取失败，降级为 jsdom 按优先级查找 `<article>` → `<main>` → `.post-content` → `.entry-content` → `<body>`。
4. 调用 `sanitize-html` 对提取后的 HTML 做白名单过滤，移除 script、style、nav、footer、iframe、广告 class、评论区、追踪像素等噪声。
5. 属性精简：只保留 a.href/title、img.src/alt/title、code.class（语言标注）、th/td.colspan/rowspan。
6. 调用 `turndown` 将 cleaned HTML 转换为 canonical Markdown，自定义规则保留代码块语言标注。
7. 组装 `PipelineResult`，通过 T2 存储接口持久化。
8. 下游模块（T7/T10/T11）从 T2 读取 canonicalMarkdown 使用。

## 3. 技术细节

### 3.1 三层内容定位

| 层级 | 内容 | 写入方 | 读取方 | 失效时重建来源 |
|------|------|--------|--------|----------------|
| Source HTML | 原始网页 HTML 原文 | T5 Sync | T6 | 源站更新时重新抓取 |
| Cleaned HTML | 正文提取 + 去噪后 HTML | T6 Pipeline | T6 | source HTML |
| Canonical Markdown | 标准 Markdown 格式正文 | T6 Pipeline | T7/T10/T11 | cleaned HTML |

规则：改 Markdown 转换 → 从 cleaned HTML 重建，不需重新下载原文。改正文提取 → 从 source HTML 重建，不需重新抓网页。下游只读 canonicalMarkdown。

### 3.2 技术选型

| 环节 | 库 | 说明 |
|------|-----|------|
| 正文提取 | @mozilla/readability + jsdom | Firefox Reader View 同款引擎 |
| HTML 清洗 | sanitize-html | 白名单过滤，防 XSS |
| HTML 转 Markdown | turndown | GFM 表格、围栏代码、自定义规则 |

### 3.3 正文提取与降级

- `new Readability(doc).parse()` → `{ title, content }`
- 返回 null 时降级：jsdom 按 `<article>` → `<main>` → `.post-content` → `.article-content` → `.entry-content` → `#content` → `<body>` 查找，文本超 200 字符即有效

### 3.4 HTML 清洗白名单

保留标签：h1-h6, p, ul/ol/li, blockquote, pre/code, a, img, figure/figcaption, table/thead/tbody/tr/th/td, strong, em, del, video/audio/source

移除内容：script, style, iframe, nav, footer, header, form；广告 class（.ad, .advertisement, [class*=ad-]）；分享按钮（.social-share, .share-buttons）；评论区（.comments, #comments, .comment-list）；推荐区（.related-posts, .recommend）；侧边栏（.sidebar, .aside）；订阅弹窗（.newsletter, .subscribe）

保留属性：a(href,title), img(src,alt,title), code(class), th/td(colspan,rowspan)

### 3.5 Markdown 转换配置

```ts
const service = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});
```

自定义规则：检测 `<pre><code class="language-xxx">` → ` ```xxx`；`<figure>` → `![caption](src)`

输出保证：首行为 `# 标题`，代码块围栏语法，表格 GFM 格式，链接 `[text](url)`，不含 HTML 结构标签和噪声内容，首尾无多余空行。

### 3.6 版本管理

```ts
const PIPELINE_VERSION = 1;
function needsRefresh(stored?: number): boolean { return !stored || stored < PIPELINE_VERSION; }
```

修改清洗/转换逻辑时版本 +1。T2 查询旧版本文章触发重洗，不需重新下载原文。

## 4. 基本接口草案

```ts
// 主入口
function runPipeline(sourceHtml: string, url?: string): PipelineResult;

// 返回值
interface PipelineResult {
  sourceHtml: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  title: string;
  url: string;
  pipelineVersion: number;
  cleanedAt: string;
}

// 内部子模块
interface ExtractedContent {
  title: string;
  contentHtml: string;
  byline?: string;
}
```

## 5. 与其他模块的对接

### 与 T2 数据模型 / 本地存储

需要对齐：ArticleContent 是否包含 `sourceHtml` / `cleanedHtml` / `canonicalMarkdown` / `pipelineVersion`；`createdAt` 用 `number` 还是 `string`；`pipelineVersion` 默认值和升级策略。

T5 Issue #5 已使用 `sourceHtml` / `cleanedHtml` / `canonicalMarkdown`，`createdAt` 为 `number`。建议 T6 保持一致。

### 与 T5 Sync / 文章同步 / 入库

T5 Issue #5 已设计 `IReaderPipeline.processArticle(articleId)` 调用方式，T6 遵循此接口。需确认 source HTML 由 T5 直接传入还是从 T2 读取。

### 与 T7 UI / 阅读器

T7 从 T2 读取 `canonicalMarkdown` 渲染阅读页，不直接读 cleanedHTML 或 sourceHTML。渲染库建议 `markdown-it`。

### 与 T8 Agent Runtime

Prompt 模板中引用 T6 内容的变量名。T10 已使用 `{{canonicalMarkdown}}`，建议 T8 保持一致。usage record 由 T8 统一记录，T6 不涉及。

### 与 T10 Summary / T11 Translation

T10 Issue #2 已确认使用 `canonicalMarkdown` 字段，SummaryRequest 接口已引用。T11 建议保持一致。

## 6. 还需要补充的细节

- `canonicalMarkdown` 字段命名是否全模块统一（T5/T10 已使用此名）
- 超长文章是否由 T6 截断（当前不做，由 Agent 侧决定）
- 图片防盗链是否在 T6 处理（当前保留原始 URL，由 T7 处理加载失败）
- T1 骨架就绪后 `src/reader/` 的最终目录结构
- `cleanedAt` 用 ISO 8601 字符串还是 Unix 时间戳（当前用字符串）

## 7. 第 2 周计划

1. 在 T1 项目骨架中创建 `src/reader/` 目录结构
2. 实现 `runPipeline()` 主入口和三层转换逻辑
3. 实现 readability 正文提取和降级策略
4. 实现 sanitize-html 白名单清洗配置
5. 实现 turndown 转换和自定义规则
6. 用两篇 fixture 验证清洗效果（预期去噪率 62-66%）
7. 与 T2 联调 ArticleContent 存储读写
8. 与 T5 联调 Sync → Pipeline 调用链路
9. 提供下游模块可读取的 canonicalMarkdown 样例

## 8. 合入 main 前的最低要求

- 能对 2-3 篇真实文章完成 source HTML → cleaned HTML → canonical Markdown 全流程
- 能去掉广告、脚本、导航等明显噪声
- 能输出可读 cleaned HTML（保留标题、段落、链接、图片、列表、代码块）
- 能输出规范 canonical Markdown（ATX 标题、围栏代码、GFM 表格）
- 图片、链接、列表、标题等基础语义结构尽量保留
- 提取失败时有降级策略，不崩溃

## 9. 当前产出

- T6 Reader Pipeline 流程设计与数据链路说明
- 技术选型方案（readability + sanitize-html + turndown）
- TypeScript 核心接口草案（PipelineResult / ExtractedContent）
- 2 篇测试样例 fixture（中英文各一篇，含导航/广告/评论/追踪等真实噪声）
- 与 T5/T8/T10 的接口对齐确认（已交叉阅读 #5 / #3 / #2）
- 后续将继续推进第 2 周的 Pipeline 实现和联调工作
