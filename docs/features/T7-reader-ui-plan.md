# T7 阅读器 UI 方案

## 1. 负责范围

T7 负责 Mercury 的阅读体验相关工作：

- 文章列表
- 文章详情阅读页
- 清洗后正文内容展示
- 阅读样式设置
- Summary、Translation、Export、Usage 等入口预留
- 每周集成后的交互体验审查

在真实 Feed、Sync、本地存储和 Reader Pipeline 模块完全接入之前，本模块需要先支持使用 mock 数据开发和演示。

当前第 1 周静态原型见：

- [T7 阅读器 UI 原型](T7-reader-ui-prototype.html)

## 2. 用户流程

MVP 阅读流程如下：

1. 用户打开 Mercury。
2. 用户看到文章列表。
3. 用户选择一篇文章。
4. 阅读器展示文章元信息和清洗后的正文内容。
5. 用户按需调整阅读设置。
6. 用户可以从清晰可见的入口触发摘要、翻译或导出。
7. T9 提供 Usage 面板后，用户可以从应用级入口查看用量统计。

## 3. 页面结构

### 3.1 文章列表

文章列表需要支持快速浏览和筛选。每个文章项应展示：

- 文章标题
- Feed 或来源名称
- 发布时间
- 简短摘要或预览文本
- 已读 / 未读状态
- 可选的同步状态或内容处理状态

需要处理的状态：

- 加载中：展示骨架行或简单加载提示。
- 空状态：说明当前没有文章，并引导用户添加订阅源或执行同步。
- 错误状态：展示简洁错误信息，并提供重试操作。
- 正常状态：展示文章列表，并让当前选中文章有明确视觉反馈。

### 3.2 阅读器视图

阅读器视图应包含：

- 文章标题
- 来源名称
- 发布时间
- 原文链接
- 阅读器工具栏
- 清洗后的文章正文
- 可选的 AI 结果区域或抽屉占位

正文区域应优先保证可读性。文章宽度、行距、字号和主题都应可以调整。

### 3.3 阅读器工具栏

工具栏需要预留这些操作：

- 摘要 Summary
- 翻译 Translation
- 导出 Markdown
- 阅读设置

在 T10 和 T11 尚未接入前，按钮可以是禁用状态或 mock 状态，但位置和命名应保持稳定。

### 3.4 阅读设置

MVP 阅读设置包括：

- 字号：小 / 中 / 大
- 行距：紧凑 / 舒适 / 宽松
- 主题：浅色 / 深色
- 阅读宽度：窄 / 标准 / 宽

T7 最低验收要求至少支持两个阅读设置。建议优先实现：

- 字号
- 行距

如果时间允许，再补充主题和阅读宽度。

## 4. 组件拆分方案

T1 提供 React 项目骨架后，建议使用以下目录结构：

```text
src/reader/
  components/
    ArticleList.tsx
    ArticleListItem.tsx
    ReaderView.tsx
    ReaderToolbar.tsx
    ReadingSettingsPanel.tsx
    ReaderEmptyState.tsx
    ReaderErrorState.tsx
  mockArticles.ts
  types.ts
  settings.ts
```

建议组件职责：

| 组件 | 职责 |
| --- | --- |
| `ArticleList` | 渲染文章列表状态和当前选中文章状态 |
| `ArticleListItem` | 渲染单个文章项 |
| `ReaderView` | 渲染文章元信息、工具栏和清洗后正文 |
| `ReaderToolbar` | 渲染摘要、翻译、导出、阅读设置等操作 |
| `ReadingSettingsPanel` | 控制字号、行距、主题和阅读宽度 |
| `ReaderEmptyState` | 展示空文章列表或空正文状态 |
| `ReaderErrorState` | 展示加载失败或阅读器错误状态 |

## 5. Mock 数据契约

T7 可以先从以下 mock 数据结构开始：

```ts
export type ReaderArticle = {
  id: string;
  title: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  cleanedHtml: string;
  canonicalMarkdown: string;
  isRead: boolean;
};
```

后续集成关系：

- T2 提供持久化文章和内容实体。
- T5 提供同步后的文章记录。
- T6 提供 cleaned HTML 和 canonical Markdown。
- T10 提供摘要结果。
- T11 提供翻译和 Markdown 导出。
- T9 提供 Usage 面板入口和用量统计。

## 6. 视觉与交互规范

- 阅读内容应是页面的视觉中心。
- 文章列表和阅读器应使用稳定布局尺寸，避免操作时页面跳动。
- MVP 演示中的核心操作不要隐藏在难理解的菜单里。
- 当前选中文章需要有明确视觉状态。
- 阅读器中不要展示 raw HTML 或带噪声的源内容。
- 状态提示应简洁清楚。
- Summary、Translation、Export 的入口样式应保持一致。
- 项目依赖可用后，优先使用 `lucide-react` 图标。

## 7. 验收标准

T7 MVP 完成时应满足：

- 能看到文章列表。
- 用户可以打开文章详情阅读页。
- 能从 mock 数据或真实数据展示清洗后的正文。
- 加载、空状态和错误状态有明确处理。
- 至少两个阅读设置可以工作。
- Summary、Translation、Export 入口位置明确。
- 持续维护交互审查清单，并在每周集成时反馈给 T0。
