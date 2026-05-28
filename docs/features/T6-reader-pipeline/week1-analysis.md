# T6 Reader Pipeline — Week 1 分析报告

> 负责人：杜茗天（jieshibang520） | 2026-05-28

---

## 1. 模块目标

将 T5 Sync 抓取回来的原始网页 HTML，转换为**三层标准化内容**，供下游模块（阅读器、AI Agent、导出）使用：

```text
Source HTML → Cleaned HTML → Canonical Markdown
                              ↓
                    T7 阅读器 / T10 Summary / T11 Translation / T11 Export
```

### 三层内容定位

| 层级 | 内容 | 谁写入 | 谁读取 | 失效策略 |
|------|------|--------|--------|----------|
| **Source HTML** | 原始网页 HTML 原文 | T5 Sync | T6（重跑清洗时） | 源站更新时重新抓取 |
| **Cleaned HTML** | 正文提取 + 去噪后的 HTML | T6 Pipeline | T6（重跑 Markdown 转换时） | 清洗逻辑升级时从 Source HTML 重建 |
| **Canonical Markdown** | 标准 Markdown 格式正文 | T6 Pipeline | T7, T10, T11 | Markdown 转换逻辑升级时从 Cleaned HTML 重建 |

这一**分层失效**策略参考老师 Mercury 仓库：每层有独立的上游来源和独立的失效触发条件。改 Markdown 转换逻辑不需要重新下载原文、不需要重新跑正文提取。

---

## 2. 技术栈适配（TypeScript）

项目整体采用 **Electron + React + TypeScript + Vite + SQLite**。T6 适配方案如下：

| 环节 | Python 原型 | TypeScript 实现 | 说明 |
|------|-------------|-----------------|------|
| 正文提取 | trafilatura | **@mozilla/readability** + jsdom | Firefox Reader View 同款引擎，Mozilla 维护 |
| HTML 解析 | beautifulsoup4 + lxml | **jsdom** | Node.js 端 DOM 解析标准方案 |
| 噪声清洗 | BeautifulSoup select + decompose | **sanitize-html** | 可配置白名单/黑名单，npm 周下载量 200w+ |
| HTML→Markdown | markdownify | **turndown** | 3k+ GitHub stars，支持 GFM 表格/围栏代码等 |
| Markdown→HTML | markdown | 可选，T7 负责 | 阅读器渲染 Markdown 为 HTML |

### 库选型理由

- **@mozilla/readability**：被 Firefox、Safari、Brave 等浏览器使用，久经考验。专门为"从任意网页提取正文"设计，对中英文均友好
- **sanitize-html**：比手写 select/decompose 更安全（防 XSS），配置清晰
- **turndown**：比 markdownify 更活跃，TypeScript 类型定义完善，支持自定义规则

---

## 3. Pipeline 流程设计

### 3.1 整体流程

```
                    T5 Sync 抓取
                         │
                    source_html
                         │
                         ▼
              ┌──────────────────────┐
              │  Step 1: 正文提取     │
              │  readability.parse()  │
              │  + jsdom              │
              └──────────┬───────────┘
                         │ title + content (HTML)
                         ▼
              ┌──────────────────────┐
              │  Step 2: HTML 清洗    │
              │  sanitize-html()      │
              │  移除噪声 + 精简属性   │
              └──────────┬───────────┘
                         │ cleaned HTML
                         ▼
              ┌──────────────────────┐
              │  Step 3: MD 转换      │
              │  turndown()           │
              │  + 自定义规则          │
              └──────────┬───────────┘
                         │ canonical Markdown
                         ▼
              ┌──────────────────────┐
              │  PipelineResult       │
              │  { source_html,       │
              │    cleaned_html,      │
              │    markdown,          │
              │    title,             │
              │    pipeline_version } │
              └──────────────────────┘
```

### 3.2 Step 1: 正文提取

```typescript
// 输入
{ source_html: string, url: string }

// 处理
const doc = new JSDOM(source_html, { url });
const reader = new Readability(doc.window.document);
const article = reader.parse(); // { title, content, textContent, byline, ... }

// 输出
{ title: string, content_html: string }
```

**降级策略**：当 readability 返回 null（无法识别正文区域）：
1. 用 jsdom 查找 `<article>`, `<main>`, `.post-content` 等常见容器
2. 找到则使用该容器内容，找不到则回退到 `<body>` 原文

### 3.3 Step 2: HTML 清洗

```typescript
// 输入: readability 输出的 content_html

// 处理
const cleaned = sanitizeHtml(content_html, {
  allowedTags: [           // 白名单：只保留语义标签
    'h1','h2','h3','h4','h5','h6',
    'p','br','hr',
    'ul','ol','li',
    'blockquote','pre','code',
    'a','img','figure','figcaption',
    'table','thead','tbody','tr','th','td',
    'strong','em','del','sup','sub',
    'video','audio','source',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    code: ['class'],       // 保留 language-xxx 类
    th: ['colspan','rowspan'],
    td: ['colspan','rowspan'],
  },
});

// 输出: cleaned_html
```

### 3.4 Step 3: HTML → Markdown

```typescript
// 输入: cleaned_html

// 处理
const turndownService = new TurndownService({
  headingStyle: 'atx',   // # 标题风格
  bulletListMarker: '-', // 减号列表
  codeBlockStyle: 'fenced', // 围栏代码块 ```
  emDelimiter: '*',
});

// 自定义规则：保留代码块语言标记
turndownService.addRule('fencedCodeBlock', {
  filter: (node) => node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE',
  replacement: (content, node) => {
    const code = node.firstChild as HTMLElement;
    const lang = code.className.replace('language-', '') || '';
    return '\n```' + lang + '\n' + code.textContent + '\n```\n';
  },
});

const markdown = turndownService.turndown(cleaned_html);

// 输出: canonical Markdown
```

### 3.5 完整接口

```typescript
// 主入口
function runPipeline(sourceHtml: string, url?: string): PipelineResult;

// 返回值
interface PipelineResult {
  sourceHtml: string;       // 原始 HTML
  cleanedHtml: string;      // 清洗后 HTML
  markdown: string;         // 规范 Markdown（下游标准输入）
  title: string;            // 文章标题
  url: string;              // 文章来源 URL
  pipelineVersion: number;  // Pipeline 版本号（用于缓存失效）
  cleanedAt: string;        // ISO 8601 时间戳
}
```

---

## 4. 下游消费方式

| 下游模块 | 消费内容 | 使用方式 |
|----------|----------|----------|
| **T2 存储** | PipelineResult 全部 | `db.save(result)` |
| **T7 阅读器** | markdown | 用 markdown-it 等库渲染为 HTML 展示 |
| **T10 Summary** | markdown | 作为 LLM Prompt 的 `{{content}}` 变量 |
| **T11 Translation** | markdown | 作为 LLM Prompt 的 `{{content}}` 变量 |
| **T11 Export** | markdown | 直接写入 `.md` 文件 |

**核心承诺**：所有下游模块只读 `result.markdown`，不需要关心 HTML 清洗细节。

---

## 5. 测试样例

### Sample 1: 中文技术博客

- **来源**：模拟博客园/CSDN 风格页面
- **内容**：Python 异步编程教程（~7800 字符源 HTML）
- **噪声包含**：nav 导航栏、sidebar 侧边栏、广告 banner、社交分享按钮、评论区、相关推荐、Google Analytics 追踪脚本
- **验证点**：标题提取、h2/h3 层级保留、代码块围栏、链接保留、blockquote 保留、广告/评论/追踪全部去除
- **预期去噪率**：~66%

### Sample 2: 英文科技新闻

- **来源**：模拟 Medium/TechCrunch 风格页面
- **内容**：Rust in Linux Kernel 技术报道（~8500 字符源 HTML）
- **噪声包含**：header ad、newsletter 订阅弹窗、Disqus 评论区、LinkedIn tracking pixel、Google Tag Manager
- **验证点**：英文标题提取、代码块（含 language-rust 标注）、表格（Metric | C vs Rust）、内联代码、链接、引用
- **预期去噪率**：~62%

> 两个 sample HTML 文件存放于 `docs/features/T6-reader-pipeline/fixtures/`

---

## 6. 与其他模块的依赖关系

```
T3 Feed 解析 ──→ T5 Sync ──→ ★ T6 Pipeline ★ ──→ T7 阅读器 UI
                 (提供 HTML)                       (用 Markdown 渲染)
                                     │
                                     ├──→ T10 Summary Agent
                                     ├──→ T11 Translation Agent
                                     └──→ T11 Export
                                     │
                               T2 数据模型/存储
                               (持久化三层内容)
```

### T6 的上下游

| 方向 | 模块 | 需要什么 | 提供什么 |
|------|------|----------|----------|
| **上游** | T5 Sync | 抓取完成后的 `(article_id, url, source_html)` | — |
| **下游** | T2 存储 | — | `PipelineResult` 全部字段 |
| **下游** | T7 阅读器 | — | `markdown` (渲染为阅读页) |
| **下游** | T10 Summary | — | `markdown` (LLM 输入) |
| **下游** | T11 Translation | — | `markdown` (LLM 输入) |
| **下游** | T11 Export | — | `markdown` (直接写文件) |

### Week 1 开发策略：不等人

T6 可以用 **mock 文章 HTML fixture** 独立开发和测试，不依赖 T5（Sync）完成：
- 在 `docs/features/T6-reader-pipeline/fixtures/` 放置 2 篇真实网页 HTML
- Pipeline 从本地文件读取，验证清洗效果
- T5 Sync 好了之后，把 `runPipeline(sourceHtml)` 的调用接入即可

---

## 7. 与其他模块的对齐情况

已通过阅读各模块 Week 1 Issue 交叉确认：

| 对齐项 | 来源 | 结论 |
|--------|------|------|
| ArticleContent 三层字段 | T5 #5 | 已包含 sourceHtml / cleanedHtml / canonicalMarkdown |
| createdAt 类型 | T5 #5 | number（Unix 时间戳毫秒） |
| Sync 触发 Pipeline 方式 | T5 #5 | IReaderPipeline.processArticle(articleId) |
| Prompt 变量名 | T10 #2 | {{canonicalMarkdown}} |
| canonicalMarkdown 字段名 | T10 #2 | 与 T6 一致，SummaryRequest 已引用 |
| Agent Runtime 状态契约 | T8 #3 | idle/running/succeeded/failed/cancelled |

待对齐：T2 林杨尚未提交 Issue，需确认 pipelineVersion 和 LLMUsageEvent 字段。

---

## 8. Week 1 交付清单

- [x] Pipeline 流程分析与图示
- [x] TypeScript 技术栈适配方案（jsdom + readability + sanitize-html + turndown）
- [x] 下游消费方式说明
- [x] 2 篇测试样例文章 HTML fixture
- [x] 模块依赖关系图
- [x] 降级/错误处理策略
- [x] 与 T5/T8/T10 接口对齐（已交叉确认 #5 / #3 / #2）
- [ ] T1 项目骨架就绪后编写实现代码
- [ ] T2 提交后确认 pipelineVersion 字段

---

## 9. 风险评估

| 风险 | 严重度 | 缓解措施 |
|------|--------|----------|
| @mozilla/readability 对中文网页效果不如 Python trafilatura | 中 | 准备降级策略（jsdom 启发式查找正文容器） |
| 某些网站的正文区域结构特殊（如分页、动态加载） | 低 | MVP 只处理单页静态 HTML，动态内容由 T5 负责 |
| sanitize-html 白名单可能遗漏某些合法标签 | 低 | 先宽松后收紧，Week 2-3 在实际文章中验证 |
| turndown 对复杂嵌套表格/列表处理不够精确 | 低 | 增加自定义规则，必要时对特殊结构做预处理 |

