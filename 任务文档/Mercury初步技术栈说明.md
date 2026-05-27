# Mercury 初步技术栈说明

> 版本：v0.1  
> 用途：5.22 粗略汇报、组员认领任务、后续 README / AGENTS / Issues 编写参考  
> 说明：这是初步方案，5.22 老师点评后可以再调整。

## 1. 我们做的是什么项目

我们计划做一个参考 Mercury 思路的本地优先 AI 阅读器。

简单来说，它是一个桌面端应用，用户可以：

- 添加 RSS / Atom 订阅源；
- 导入 OPML 订阅列表；
- 同步文章；
- 阅读清洗后的文章内容；
- 使用大语言模型生成文章总结；
- 使用大语言模型翻译文章；
- 查看大模型使用量统计；
- 导出单篇文章 Markdown。

这个项目不做登录、不做云端账户、不做主动数据采集，数据尽量保存在用户自己的电脑上。

## 2. 为什么不直接照搬老师 Mercury 的技术栈

老师的 Mercury 仓库主要是 macOS 原生技术栈：

- Swift
- SwiftUI
- Xcode
- Swift Package Manager
- SQLite / GRDB.swift
- FeedKit
- SwiftSoup
- swift-readability
- swift-markdown
- SwiftOpenAI

这个技术栈很适合做 macOS 原生应用，但我们的作业要求里有一条：

> 平台中立：支持 Windows / Linux / macOS

所以我们不能完全照搬老师的 SwiftUI 方案。我们会参考老师 Mercury 的产品结构和功能设计，但采用更适合跨平台的技术栈。

## 3. 我们的初步技术栈

我们的初步方案是：

```text
桌面端框架：Electron
前端框架：React
开发语言：TypeScript
构建工具：Vite
本地数据库：SQLite
Feed 解析：rss-parser
OPML 解析：fast-xml-parser 或 opmlparser
网页抓取：undici 或 node-fetch
HTML 解析：jsdom
正文提取：@mozilla/readability
HTML 清洗：sanitize-html
Markdown 转换：turndown
AI 接口：OpenAI-compatible API 适配层
图标库：lucide-react
项目管理：GitHub Issues + Pull Requests
```

一句话理解：

> 用 Electron 做一个能在 Windows / Linux / macOS 上运行的桌面软件；用 React + TypeScript 做界面和功能；用 SQLite 保存本地数据；用一组成熟的 Node.js 库完成 Feed、OPML、HTML 清洗、Markdown 转换和 AI 调用。

## 4. 每个技术栈分别是什么意思

### 4.1 Electron：做跨平台桌面应用

Electron 是一个可以用网页技术开发桌面软件的框架。

你可以把它理解成：

> Electron = 给网页套一个桌面软件外壳。

我们平时写的 React 页面本质上是网页界面，Electron 可以把这个网页界面包装成真正的桌面 App，让它可以在 Windows、Linux、macOS 上运行。

适合我们的原因：

- 支持 Windows / Linux / macOS；
- 对学生团队比较友好；
- 可以使用 JavaScript / TypeScript 生态；
- 很多桌面软件也是 Electron 做的，例如 VS Code、Slack、Discord。

在我们项目中，Electron 负责：

- 打开桌面窗口；
- 访问本地文件；
- 连接本地数据库；
- 让应用以桌面软件形式运行。

### 4.2 React：做用户界面

React 是一个前端界面框架。

你可以把它理解成：

> React = 用组件拼出软件界面。

比如我们的应用会有：

- 左侧订阅源列表；
- 中间文章列表；
- 右侧阅读区域；
- AI 总结区域；
- 翻译区域；
- 设置页面；
- 用量统计页面。

这些都可以拆成一个个 React 组件，让不同同学分工开发。

适合我们的原因：

- 适合多人协作；
- 组件化清晰；
- 学习资料多；
- 和 Electron 搭配成熟。

在我们项目中，React 负责：

- 页面布局；
- 按钮、列表、表单、阅读区域；
- 文章内容展示；
- AI 总结和翻译结果展示；
- 设置页和统计页展示。

### 4.3 TypeScript：让代码更不容易写错

TypeScript 是 JavaScript 的增强版。

你可以把它理解成：

> TypeScript = 带类型检查的 JavaScript。

普通 JavaScript 写错字段名、传错数据，可能运行时才发现。TypeScript 会提前提醒我们。

例如文章对象可以定义成：

```ts
type Article = {
  id: string;
  title: string;
  url: string;
  contentHtml: string;
  contentMarkdown: string;
  publishedAt: string;
};
```

这样其他同学写代码时，就知道文章数据里应该有什么字段。

适合我们的原因：

- 适合多人合作；
- 能减少低级错误；
- 接口定义清楚；
- 方便 AI Coding Agent 理解项目结构。

在我们项目中，TypeScript 负责：

- 定义文章、订阅源、AI 请求、用量统计等数据结构；
- 让不同模块之间的接口更清楚；
- 降低多人开发时的沟通成本。

### 4.4 Vite：让项目启动和构建更快

Vite 是前端项目的开发和构建工具。

你可以把它理解成：

> Vite = 帮我们启动项目、打包项目的工具。

开发时，组员运行命令后就能看到界面；提交作业前，也可以用它把项目打包检查。

适合我们的原因：

- 启动快；
- 配置简单；
- 和 React / TypeScript 搭配成熟；
- 适合课程项目快速开发。

在我们项目中，Vite 负责：

- 本地开发启动；
- 前端代码编译；
- 打包检查。

### 4.5 SQLite：本地数据库

SQLite 是一个轻量级本地数据库。

你可以把它理解成：

> SQLite = 放在用户电脑里的一个小数据库文件。

它不需要服务器，也不需要注册登录。应用可以把订阅源、文章、AI 总结、翻译结果、用量统计等数据保存在本地。

适合我们的原因：

- 符合本地优先；
- 不需要后端服务器；
- 跨平台；
- 适合保存结构化数据；
- 老师 Mercury 也使用 SQLite 思路。

在我们项目中，SQLite 负责保存：

- 订阅源；
- 文章；
- 同步状态；
- 清洗后的 HTML；
- 转换后的 Markdown；
- AI 总结；
- AI 翻译；
- LLM 用量记录。

### 4.6 rss-parser：解析 RSS / Atom Feed

RSS / Atom 是很多网站提供的订阅格式。

rss-parser 是一个可以读取 RSS / Atom 内容的库。

你可以把它理解成：

> rss-parser = 把 RSS 链接里的文章列表读出来。

例如用户添加一个博客 RSS 地址，rss-parser 可以解析出：

- 文章标题；
- 文章链接；
- 发布时间；
- 摘要；
- 作者；
- 原始内容。

在我们项目中，rss-parser 负责：

- 解析订阅源；
- 获取文章列表；
- 为后续同步和阅读提供基础数据。

### 4.7 fast-xml-parser / opmlparser：解析 OPML

OPML 是一种常见的订阅源导入导出格式。

你可以把它理解成：

> OPML = 一份 RSS 订阅清单。

很多 RSS 阅读器都支持导出 OPML。用户可以把原来阅读器里的订阅源导出成 OPML，然后导入我们的应用。

fast-xml-parser 或 opmlparser 负责把 OPML 文件解析成订阅源列表。

在我们项目中，它负责：

- 读取 OPML 文件；
- 提取里面的订阅源名称；
- 提取 RSS 地址；
- 批量导入订阅源。

### 4.8 undici / node-fetch：抓取网页和 Feed 内容

undici 和 node-fetch 都可以用来发网络请求。

你可以把它理解成：

> 它们 = 帮应用访问一个网址，并把内容拿回来。

比如：

- 访问 RSS 地址；
- 下载文章原网页；
- 调用大模型 API。

在我们项目中，它负责：

- 获取 Feed 内容；
- 获取文章网页 HTML；
- 调用 LLM API。

### 4.9 jsdom：把 HTML 变成可处理的结构

HTML 是网页内容，但直接处理字符串很麻烦。

jsdom 可以把 HTML 变成类似浏览器里的 DOM 结构。

你可以把它理解成：

> jsdom = 在代码里模拟一个网页结构，方便我们找标题、正文、链接和图片。

在我们项目中，jsdom 负责：

- 解析文章网页；
- 给正文提取和内容清洗提供基础结构。

### 4.10 @mozilla/readability：提取正文

网页里不只有正文，还有导航栏、广告、评论区、推荐内容等。

@mozilla/readability 是 Mozilla 开源的正文提取工具。

你可以把它理解成：

> readability = 从杂乱网页里找出真正的文章正文。

在我们项目中，它负责：

- 从原网页 HTML 中提取标题；
- 提取正文；
- 去掉大部分无关区域；
- 为 Cleaned HTML 和 Cleaned Markdown 提供基础内容。

### 4.11 sanitize-html：清洗 HTML

网页 HTML 里可能有复杂样式、脚本、不安全标签。

sanitize-html 可以清理 HTML，只保留我们允许的内容。

你可以把它理解成：

> sanitize-html = 给 HTML 做安全和格式清理。

在我们项目中，它负责：

- 去掉 script 等不安全内容；
- 保留文章需要的标题、段落、链接、图片、代码块等；
- 生成 Cleaned HTML；
- 让阅读页展示更稳定。

### 4.12 turndown：HTML 转 Markdown

Markdown 是一种轻量文本格式，适合导出、保存和阅读。

turndown 可以把 HTML 转成 Markdown。

你可以把它理解成：

> turndown = 把网页正文转换成 Markdown 文本。

在我们项目中，它负责：

- 生成 Cleaned Markdown；
- 支持单篇文章 Markdown 导出；
- 给 AI 总结或翻译提供更干净的输入文本。

### 4.13 OpenAI-compatible API：大模型中立

OpenAI-compatible API 指的是一类兼容 OpenAI 调用格式的大模型接口。

你可以把它理解成：

> 只要服务商接口格式接近 OpenAI，我们就可以用同一套代码调用不同模型。

例如可能支持：

- OpenAI；
- DeepSeek；
- 通义千问；
- 智谱；
- Moonshot；
- 本地 Ollama；
- 其他兼容 OpenAI API 的模型服务。

在我们项目中，它负责：

- 提供统一的大模型调用方式；
- 支持 Summary Agent；
- 支持 Translation Agent；
- 记录模型调用用量；
- 避免项目绑定某一家模型服务商。

### 4.14 lucide-react：图标库

lucide-react 是一个 React 图标库。

你可以把它理解成：

> lucide-react = 给按钮和界面提供统一风格的小图标。

比如：

- 同步图标；
- 设置图标；
- 导出图标；
- 翻译图标；
- 统计图标；
- 搜索图标。

在我们项目中，它负责：

- 提升界面一致性；
- 让按钮更容易理解；
- 减少大家自己画图标的时间。

### 4.15 GitHub Issues + Pull Requests：团队协作管理

GitHub Issues 是任务单。

Pull Request 是代码合并申请。

你可以把它理解成：

```text
Issue = 老师/组长分配的任务卡
Branch = 每个人做任务的独立分支
Commit = 每个人每次修改留下的记录
Pull Request = 做完后申请合并到 main
README = 给老师看的项目总说明
```

在我们项目中，它负责：

- 记录每个人负责什么；
- 记录每个人做了哪些提交；
- 方便组长审核；
- 方便老师根据提交记录评分；
- 留下团队协作过程。

## 5. 技术栈和任务分工的对应关系

| 任务 | 主要相关技术 |
| --- | --- |
| T0 组长 / AI 产品负责人 / 项目留痕组长 | GitHub、README、AGENTS、Issues、PR 规则、项目验收 |
| T1 Feed / OPML 解析 | rss-parser、fast-xml-parser / opmlparser、undici / node-fetch |
| T2 本地数据模型 / 存储 / Sync 基础 | SQLite、TypeScript 数据类型、Electron 本地能力 |
| T3 内容呈现 / 阅读页 | React、TypeScript、CSS、Cleaned HTML 展示 |
| T4 Cleaned HTML | jsdom、@mozilla/readability、sanitize-html |
| T5 Cleaned Markdown | turndown、Markdown 数据结构、单篇导出基础 |
| T6 定制阅读样式 | React、CSS、阅读主题、字号、行宽等 |
| T7 产品体验 / 主界面整合 | React、lucide-react、页面结构、交互体验 |
| T8 LLM Agent 基础协议 | TypeScript 接口、Prompt 结构、Agent 输入输出 |
| T9 LLM Providers / 模型配置 / 用量统计展示 | OpenAI-compatible API、模型配置、LLM Usage 面板 |
| T10 Summary Agent | LLM Provider、Summary Prompt、文章摘要展示 |
| T11 Translation Agent / 单篇 Markdown 导出 | LLM Provider、Translation Prompt、turndown、文件导出 |

## 6. 初步目录结构建议

后续建仓库时，可以考虑这样的目录结构：

```text
mercury-ai-reader/
  README.md
  AGENTS.md
  package.json
  electron/
    main.ts
    preload.ts
  src/
    app/
    components/
    pages/
    features/
      feeds/
      articles/
      cleaning/
      llm/
      export/
      usage/
    styles/
  docs/
    PRD.md
    PLAN.md
    TASKS.md
    WEEKLY_INTEGRATION.md
  .github/
    pull_request_template.md
```

这只是初步结构，不代表现在就必须完全建好。5.22 老师点评后，可以再定最终版本。

## 7. 5.22 汇报时可以怎么说

可以这样表述：

> 我们参考老师 Mercury 的本地优先、桌面端、Feed 解析、内容清洗、LLM Provider 和 AI Agent 设计，但不会直接照搬 SwiftUI 技术栈。因为本次作业要求平台中立，需要支持 Windows、Linux 和 macOS，所以我们初步选择 Electron + React + TypeScript + SQLite。这个方案可以用桌面应用形态满足本地优先，也方便团队成员按 Feed、存储、阅读页、内容清洗、AI Agent、LLM Provider、用量统计和导出功能进行分工。5.22 老师点评后，我们会再根据建议调整技术细节，并同步到 README、AGENTS 和 Issues。

## 8. 当前结论

当前推荐采用：

```text
Electron + React + TypeScript + Vite + SQLite
```

并配合：

```text
rss-parser / fast-xml-parser / jsdom / readability / sanitize-html / turndown / OpenAI-compatible API
```

这套方案的核心优点是：

- 满足 Windows / Linux / macOS 平台中立；
- 满足本地优先；
- 适合 12 人分工；
- 适合 5 周课程项目；
- 能参考老师 Mercury 的产品设计，但不被 macOS-only 技术栈限制。
