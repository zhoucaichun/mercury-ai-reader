# Prism Reader

Prism Reader 是一个本地优先的跨平台 AI Feed 阅读器课程项目。它支持 RSS / Atom 订阅、OPML 导入、真实文章同步、本地 SQLite 存储、阅读内容清洗、AI 摘要与翻译、用量统计和单篇 Markdown 导出。

项目不要求注册或登录，不主动采集用户数据。订阅源、文章、阅读状态、AI 结果和模型配置优先保存在用户本机；桌面端 API Key 使用 Electron `safeStorage` 加密保存，不提交仓库，也不会上传到服务器。

## 当前可用功能

- 订阅源管理：支持输入 Feed URL 同步真实 RSS / Atom 文章，支持 OPML 批量导入，支持订阅源启用、停用和删除。
- 文章同步与存储：同步真实文章并写入本地 SQLite，支持去重、未读统计、已读状态和收藏状态。
- 阅读器 UI：三栏布局，支持订阅源列表、文章列表、正文阅读、阅读设置、面板收起和拖拽调整宽度。
- 内容清洗：保存 `sourceHtml`、`cleanedHtml` 和 `canonicalMarkdown`，为阅读、摘要、翻译和导出提供统一正文输入。
- AI 摘要：基于当前文章生成摘要，已有摘要再次点击时默认查看历史结果，不重复调用模型。
- AI 翻译：支持整篇逐段翻译、划词翻译、中英对照阅读和生成进度反馈。
- 模型配置：支持 OpenAI-compatible API，保存多个模型配置，摘要和翻译可以分别选择默认模型。
- Usage 统计：记录模型调用目的、Provider、Model、Token、状态和耗时。
- Markdown 导出：导出当前文章 Markdown，可包含正文、摘要和译文。
- 阅读增强：支持 12 种主题、文章列表简洁/详细视图、状态筛选、标签筛选、标签管理、阅读进度、文本高亮、下划线、笔记和 AI 历史记录。

## 下载运行

Windows 打包版本已上传到 GitHub Release：

https://github.com/zhoucaichun/mercury-ai-reader/releases/tag/v0.1.0-prism-reader

下载 `Prism.Reader-0.1.0-Windows-x64.zip` 后解压，双击 `Prism Reader.exe` 即可运行。

说明：

- 当前 Release 提供 Windows x64 zip 包。
- macOS / Linux 可基于源码运行和构建，打包配置已预留 `mac` 和 `linux` 目标。
- 如果 Windows 首次打开被系统安全提示拦截，请选择“仍要运行”。这是未签名课程项目常见提示。

## 使用方式

1. 打开 Prism Reader。
2. 在左侧输入 Feed URL，点击同步按钮；也可以留空同步默认真实源。
3. 如需批量导入订阅源，点击 OPML 导入按钮选择 `.opml` 文件。
4. 在中间文章列表选择文章，右侧阅读正文。
5. 在阅读设置中填写模型服务的 Base URL、Model 和 API Key。
6. 使用摘要、翻译、划词翻译、笔记、高亮、标签、导出和 Usage 功能。

可测试 Feed 示例：

```text
https://www.ruanyifeng.com/blog/atom.xml
https://blog.mozilla.org/en/feed/
https://xkcd.com/atom.xml
```

## AI 模型配置

Prism Reader 使用 OpenAI-compatible API 调用模型。常见配置包括：

| Provider | Base URL 示例 | Model 示例 | API Key |
| --- | --- | --- | --- |
| OpenAI-compatible 服务 | `https://api.example.com/v1` | 服务方提供 | 服务方提供 |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | DeepSeek API Key |
| Ollama 本地模型 | `http://localhost:11434/v1` | 如 `qwen2.5:7b` | 任意非空占位值 |

API Key 只保存在当前设备。桌面端会加密保存；浏览器预览环境只作为开发 fallback 使用。

## 最新阅读器 UI

Prism Reader 当前阅读器界面包含以下交互：

- 12 种主题：9 种国风主题，以及绿色护眼、明亮、夜间模式。
- 文章列表双视图：详细模式显示来源、日期、标签和阅读进度；简洁模式适合快速浏览。
- 文章筛选：支持全部、未读、已读、收藏筛选，并可叠加标签过滤。
- 标签管理：可为文章添加标签、移除单个标签、按标签筛选，也可全局删除某类标签。
- 划词工具栏：选中文字后可高亮、下划线、翻译、添加笔记或保存翻译结果。
- 高亮与笔记：标注和笔记保存在本地，可在笔记面板集中查看。
- 逐段翻译：翻译完成的段落会逐步显示，支持原文和译文对照阅读。
- AI 历史：摘要和翻译结果按文章保存历史，最多保留 20 条，可恢复或删除。
- 模型切换：可保存多个模型配置，并为摘要和翻译分别选择默认模型。
- 使用说明：内置帮助面板，按功能模块说明订阅、阅读、AI、标注、标签和数据安全。

## 技术栈

- Electron：跨平台桌面应用。
- React：前端 UI。
- TypeScript：统一类型与接口。
- Vite：前端开发与构建。
- SQLite / better-sqlite3：本地优先数据存储。
- rss-parser：RSS / Atom Feed 解析。
- OpenAI-compatible API：统一接入远程模型和本地模型。
- lucide-react：界面图标。

## 项目结构

```text
electron/                         Electron 主进程、preload、SQLite/AI IPC
src/
  app/                            React 应用入口
  core/                           公共类型和 mock 数据
  features/
    feed/
      parser/                     RSS / Atom 解析
      opml/                       OPML 导入
      subscriptions/              订阅源管理
      sync/                       同步、去重、入库
    reader/                       阅读器 UI 和数据端口
      pipeline/                   内容清洗 pipeline
    agent/
      runtime/                    Agent Runtime 契约
      prompts/                    Prompt 模板
      providers/                  LLM Provider
      summary/                    Summary Agent
      translation/                Translation Agent
    usage/                        LLM Usage 记录和统计
    export/                       单篇 Markdown 导出
  styles/                         全局样式
resources/prompts/                Prompt 模板资源
docs/features/                    各模块设计文档
task-documents/                   任务过程文档
```

## 本地开发

环境要求：

- Node.js 24.x
- npm 11.x
- Git

安装依赖：

```bash
npm install
```

启动开发版桌面应用：

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

## 测试与验收

运行单元测试：

```bash
npm test
```

验证 Feed 解析：

```bash
npm run smoke:feed
```

验证主链路：

```bash
npm run smoke:week2
```

`smoke:week2` 会执行订阅源同步、文章入库、文章内容读取和重复同步去重检查。当前主链路会同步阮一峰网络日志和 Mozilla Blog 两个真实源。

## 打包

Windows zip 打包：

```bash
npm run pack:win:zip
```

打包产物位于：

```text
release/Prism Reader-0.1.0-Windows-x64.zip
```

解压后运行：

```text
Prism Reader.exe
```

## 隐私与安全

- 不要求用户注册或登录。
- 不主动上传订阅源、文章、阅读记录、笔记或 AI 结果。
- 文章、阅读状态、AI 结果和 usage 记录优先保存在本地。
- 桌面端 API Key 使用 Electron `safeStorage` 加密保存。
- 真实 API Key 不提交到仓库。
- 示例配置使用占位符，不写真实密钥。

## 协作说明

本项目为课程小组协作项目，公共接口和开发约束见：

- [AGENTS.md](AGENTS.md)
- [docs/features](docs/features)
- [task-documents](task-documents)

开发时请基于最新 `main` 新建分支，提交 PR 前说明修改内容、影响模块和验证方式。
