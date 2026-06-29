# Prism Reader

Prism Reader 是一个本地优先、跨平台的 AI Feed 阅读器课程项目。它支持 RSS / Atom 订阅、OPML 导入、真实文章同步、本地存储、阅读内容清洗、AI 摘要与翻译、模型用量统计，以及单篇 Markdown 导出。

项目不要求用户注册或登录。订阅源、文章、阅读状态、笔记、AI 结果、用量记录和模型配置优先保存在用户本机。桌面端 API Key 使用 Electron `safeStorage` 加密保存，不提交到仓库，也不会上传到服务器。

## 当前功能

- 订阅源管理：支持输入 Feed URL 同步真实 RSS / Atom 文章，支持 OPML 批量导入，支持订阅源启用、停用和删除。
- 文章同步：支持真实文章抓取、Feed 去重、文章去重、文章列表和正文内容本地保存。
- 阅读器界面：三栏布局，包括订阅源列表、文章列表和阅读区，支持面板收起、宽度调整和阅读设置。
- 内容清洗：保存 `sourceHtml`、`cleanedHtml` 和 `canonicalMarkdown`，为阅读、摘要、翻译和导出提供统一正文输入。
- AI 摘要：基于当前文章生成摘要；已有摘要再次点击时优先查看历史结果，避免重复调用模型。
- AI 翻译：支持整篇翻译、划词翻译、中英对照阅读和生成进度反馈。
- 模型配置：支持 OpenAI-compatible API；可保存多个模型配置，为摘要和翻译分别选择默认模型，并支持连接测试和删除配置。
- Usage 统计：记录 AI 调用目的、Provider、Model、Token、状态和耗时。
- Markdown 导出：支持导出当前文章，可包含正文、摘要和译文。
- 阅读增强：支持主题、已读/未读、收藏、标签、阅读进度、高亮、下划线、笔记和 AI 历史记录。

## 下载运行

Windows x64 打包版本：

https://github.com/zhoucaichun/mercury-ai-reader/releases/tag/v0.1.0-prism-reader

下载 `Prism.Reader-0.1.0-Windows-x64.zip` 后解压，双击运行：

```text
Prism Reader.exe
```

说明：

- 当前公开 Release 提供 Windows x64 zip 包。
- macOS 和 Linux 的构建目标已在配置中预留，可基于源码构建。
- 如果 Windows 首次打开时出现未签名应用安全提示，请选择“仍要运行”。这是课程项目未签名构建的常见提示。

## 基本使用

1. 打开 Prism Reader。
2. 在左侧输入 Feed URL 并点击同步；也可以留空同步默认真实订阅源。
3. 如需批量导入订阅源，点击 OPML 导入按钮并选择 `.opml` 文件。
4. 在中间文章列表选择文章，在右侧阅读正文。
5. 如需使用 AI 摘要或翻译，在设置中配置 OpenAI-compatible 模型服务。
6. 在阅读页使用摘要、翻译、划词翻译、笔记、高亮、标签、Usage 和 Markdown 导出功能。

可测试 Feed 示例：

```text
https://www.ruanyifeng.com/blog/atom.xml
https://blog.mozilla.org/en/feed/
https://xkcd.com/atom.xml
```

OPML 测试文件位于：

```text
test-opml/
```

## AI 模型配置

Prism Reader 使用 OpenAI-compatible API 调用模型。常见配置示例：

| Provider | Base URL 示例 | Model 示例 | API Key |
| --- | --- | --- | --- |
| OpenAI-compatible 服务 | `https://api.example.com/v1` | 服务方提供 | 服务方提供 |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | DeepSeek API Key |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` | 任意非空占位值 |

API Key 只保存在当前设备。桌面端会通过 Electron `safeStorage` 加密保存；浏览器预览模式仅作为开发 fallback 使用。

## 技术栈

- Electron：跨平台桌面应用。
- React：前端 UI。
- TypeScript：统一类型和接口。
- Vite：开发与构建工具。
- SQLite / better-sqlite3：本地优先数据存储。
- rss-parser：RSS / Atom Feed 解析。
- OpenAI-compatible API：统一接入远程模型和本地模型。
- lucide-react：界面图标。

## 项目结构

```text
electron/                         Electron 主进程、preload、本地存储和 AI IPC
src/
  app/                            React 应用入口
  core/                           公共类型、数据库 stores、适配器和种子数据
  features/
    feed/
      parser/                     RSS / Atom 解析
      opml/                       OPML 解析
      subscriptions/              订阅源管理
      sync/                       Feed 同步、去重和存储集成
    reader/                       阅读器 UI 和 ReaderDataPort
      pipeline/                   内容清洗 pipeline
    agent/
      runtime/                    Agent Runtime 契约
      prompts/                    Prompt 加载和渲染
      providers/                  LLM Provider 配置和调用
      summary/                    Summary Agent
      translation/                Translation Agent
    usage/                        LLM Usage 记录和统计
    export/                       单篇 Markdown 导出
  styles/                         全局样式
resources/prompts/                Prompt 模板资源
docs/features/                    功能设计和模块文档
docs/reports/                     模块进度和验证报告
task-documents/                   正式项目计划和技术文档
test-opml/                        OPML 导入测试文件
```

## 成员分工与仓库留痕

| 成员 | 负责内容 | 仓库留痕 |
| --- | --- | --- |
| T0 周彩纯 | 项目管理、集成测试、打包发布、仓库文档整理 | `README.md`、`AGENTS.md`、`task-documents/`、Release、集成提交 |
| T1 张珈鸣 | 项目骨架、Electron / React / Vite 初始化、构建脚本 | `package.json`、`electron/`、`src/app/`、`src/main.tsx`、`vite.config.ts` |
| T2 林杨 | 数据模型、SQLite 本地存储、stores、Storage Adapter | `src/core/database/`、`docs/features/T2-data-model.md` |
| T3 周康 | Feed URL 添加、RSS / Atom Parser、解析测试和报告 | `src/features/feed/parser/`、`test/`、`docs/features/T3-feed-parser.md`、`docs/reports/T3-*` |
| T4 李欣然 | OPML 导入、订阅源管理 | `src/features/feed/opml/`、`src/features/feed/subscriptions/`、`docs/features/T4-opml-subscriptions.md`、`test-opml/` |
| T5 夏培玮 | Feed 同步、文章去重、Week 2 主链路 smoke 测试 | `src/features/feed/sync/`、`docs/features/T5-sync-design.md` |
| T6 杜茗天 | Reader Pipeline、内容清洗、canonical Markdown | `src/features/reader/pipeline/`、`docs/features/T6-reader-pipeline.md`、`docs/features/T6-reader-pipeline-fixtures/` |
| T7 余婧 | 阅读器 UI、交互设计、主题、笔记、高亮、阅读状态 | `src/features/reader/`、`docs/features/T7-reader-ui-plan.md`、`docs/features/T7-ux-review-checklist.md` |
| T8 曾夏杨 | Agent Runtime、Prompt 加载、AI 任务状态 | `src/features/agent/runtime/`、`src/features/agent/prompts/`、`docs/features/T8-agent-runtime.md` |
| T9 蔡钦楠 | LLM Provider、模型配置、Usage 记录和设置面板 | `src/features/agent/providers/`、`src/features/usage/`、`docs/features/T9-llm-provider-usage.md` |
| T10 宋金淼 | Summary Agent、摘要结果契约和测试 | `src/features/agent/summary/`、`docs/features/T10-summary-agent.md` |
| T11 余富康 | Translation Agent、单篇 Markdown 导出 | `src/features/agent/translation/`、`src/features/export/`、`docs/features/T11-translation-export.md` |

## 本地开发

环境要求：

- Node.js 24.x
- npm 11.x
- Git

安装依赖：

```bash
npm install
```

启动桌面端开发模式：

```bash
npm run dev
```

只启动浏览器预览：

```bash
npm run dev:renderer
```

构建：

```bash
npm run build
```

运行构建后的桌面应用：

```bash
npm run start
```

## 测试与验证

运行单元测试：

```bash
npm test
```

验证 Feed 解析：

```bash
npm run smoke:feed
```

验证 Feed 同步主链路：

```bash
npm run smoke:week2
```

`smoke:week2` 会同步真实 Feed，写入 feeds / articles / article content，验证 `getArticleContent(articleId)`，并检查重复同步不会产生重复订阅源或重复文章。

Windows zip 打包：

```bash
npm run pack:win:zip
```

打包产物位于：

```text
release/Prism Reader-0.1.0-Windows-x64.zip
```

## 隐私与安全

- 不要求用户注册或登录。
- 不主动上传订阅源、文章、阅读记录、笔记或 AI 结果。
- 文章数据、阅读状态、AI 结果和 usage 记录优先保存在本地。
- 桌面端 API Key 使用 Electron `safeStorage` 加密保存。
- 真实 API Key 不提交到仓库。
- 示例配置只使用占位符，不写真实密钥。

## 项目文档

- [AGENTS.md](AGENTS.md)：公共代码约束、数据契约、目录规则和 AI 集成规则。
- [功能文档](docs/features)：各模块设计与实现说明。
- [报告文档](docs/reports)：模块进度与验证记录。
- [技术栈说明](task-documents/mercury-tech-stack.md)：项目技术选型与原因。
- [集成计划](task-documents/mercury-four-week-integration-plan.md)：四周集成计划与验收范围。
