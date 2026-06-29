# Prism Reader 技术栈说明

本文档记录 Prism Reader 的技术选型、使用原因和对应实现范围。

## 1. 产品目标

Prism Reader 是一个本地优先的桌面 Feed 阅读器，支持 AI 摘要和翻译。项目重点包括：

- RSS / Atom 订阅与文章同步；
- OPML 批量导入；
- 本地文章存储、阅读状态和订阅源状态管理；
- 正文清洗与 `canonicalMarkdown` 输出；
- AI 摘要、AI 翻译和划词翻译；
- OpenAI-compatible 模型配置；
- LLM 用量记录；
- 单篇 Markdown 导出；
- Windows 桌面端打包发布，并预留 macOS / Linux 构建能力。

## 2. 技术栈总览

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 桌面端框架 | Electron | 将应用打包为 Windows / macOS / Linux 桌面应用 |
| 前端 UI | React | 构建阅读器界面、设置面板、AI 面板和交互状态 |
| 开发语言 | TypeScript | 保持跨模块接口清晰，减少集成错误 |
| 构建工具 | Vite | 提供开发服务器和生产构建 |
| 本地存储 | SQLite / better-sqlite3 | 保存订阅源、文章、正文、AI 结果、usage 和设置 |
| 存储兜底 | JSON fallback | SQLite native 模块不可用时保证桌面端仍可运行 |
| Feed 解析 | rss-parser | 解析 RSS / Atom Feed |
| 网络请求 | undici / platform fetch | 获取 Feed、文章内容和模型 API 响应 |
| AI Provider | OpenAI-compatible API | 用统一接口接入远程模型或本地模型 |
| API Key 安全 | Electron safeStorage | 桌面端加密保存 API Key |
| 图标库 | lucide-react | 提供统一风格的界面图标 |
| 协作与发布 | GitHub Issues / PR / Releases | 记录任务、审查代码、发布打包产物 |

## 3. 选型理由

### Electron

课程要求项目具备跨平台能力。Electron 可以使用同一套 React / TypeScript 前端实现桌面应用，并支持访问本地文件、数据库和系统能力，适合课程团队快速交付可运行产品。

### React + TypeScript

阅读器页面、设置面板、AI 面板和 Usage 面板都适合组件化开发。TypeScript 能明确 Feed、Article、Content、Provider、Usage、Summary、Translation 等数据结构，降低多人协作时的接口成本。

### Vite

Vite 启动快、配置简单，适合 React + TypeScript 项目。当前项目使用 Vite 进行前端开发和生产构建，再由 Electron Builder 完成桌面端打包。

### SQLite / JSON fallback

项目定位是本地优先，不依赖云端账号系统。SQLite 适合保存结构化数据；当 native 模块在打包环境不可用时，JSON fallback 可以保证应用仍能运行和演示。

### OpenAI-compatible API

项目不绑定某一个模型厂商。只要服务兼容 OpenAI Chat Completions 格式，就可以通过统一 Provider 接口接入。当前配置支持保存多个模型，并为摘要和翻译分别选择默认模型。

### Electron safeStorage

API Key 属于敏感信息。桌面端使用 Electron `safeStorage` 加密保存，避免明文写入仓库或普通配置文件。

## 4. 架构说明

- Renderer 负责界面展示和交互；
- Electron main process 负责本地能力、Feed 同步、OPML 导入、AI IPC 和安全存储；
- `src/features/feed/` 负责 Feed、OPML、订阅源和同步；
- `src/features/reader/` 负责阅读器 UI 和阅读体验；
- `src/features/agent/` 负责 Runtime、Prompt、Provider、Summary、Translation；
- `src/features/usage/` 负责模型用量记录和统计；
- `src/features/export/` 负责单篇 Markdown 导出；
- `src/core/database/` 负责 SQLite 数据模型和 stores。

## 5. 验证命令

```bash
npm test
npm run build
npm run smoke:week2
npm run pack:win:zip
```

这些命令分别验证单元测试、生产构建、真实 Feed 主链路、重复同步去重、文章内容读取和 Windows 打包能力。

## 6. 当前交付状态

当前项目已经完成：

- 真实 Feed 同步；
- OPML 导入；
- 本地存储与 JSON fallback；
- 阅读器 UI；
- 内容清洗字段输出；
- AI 摘要和翻译；
- streaming 生成反馈；
- 多模型配置保存和切换；
- Usage 统计；
- Markdown 导出；
- Windows Release 打包。
