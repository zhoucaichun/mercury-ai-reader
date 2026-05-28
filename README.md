# mercury-ai-reader
Mercury，一个本地优先 AI 阅读器课程项目。
本项目用于开源课程团队作业，目标是在 5 周内完成一个从 0 到 1 的 AI 阅读器 MVP。

## 项目目标
我们计划实现一个桌面端本地应用，支持用户订阅 RSS / Atom Feed，导入 OPML 订阅列表，同步文章，阅读清洗后的内容，并使用大语言模型完成文章总结和翻译。
项目不做登录、不做云端账户、不主动采集用户数据，尽量将订阅源、文章内容、AI 结果和用量统计保存在用户本地。

## 核心功能范围

### 必做功能
1. 基础功能：Feed / OPML 解析 + Sync + 内容呈现
2. 内容清洗：Cleaned HTML + Cleaned Markdown + 定制样式
3. AI 功能一：Summary Agent + LLM Providers
4. AI 功能二：Translation Agent

### 技术约束
1. 产品体验：设计规范清楚，用户体验简洁
2. 本地优先：无需注册登录或订阅，不主动采集用户数据
3. 平台中立：技术栈、运行脚本和本地路径处理按 Windows / Linux / macOS 跨平台设计
4. 大模型中立：支持标准 API 的大语言模型服务，包括本地模型
5. Coding Agent 留痕：形成有价值的工作过程文档
6. 团队协同留痕：正确记录提交人和提交历史

### 加分项
考虑时间，只做以下两个加分项：
1. 大语言模型用量统计
2. 单篇 Markdown 导出

## 初步技术栈

本项目初步采用：

- Electron：跨平台桌面应用框架
- React：前端界面开发
- TypeScript：主要开发语言
- Vite：前端构建工具
- SQLite：本地数据库
- rss-parser：RSS / Atom Feed 解析
- fast-xml-parser 或 opmlparser：OPML 解析
- jsdom / @mozilla/readability：网页正文提取
- sanitize-html：HTML 内容清洗
- turndown：HTML 转 Markdown
- OpenAI-compatible API：大模型服务适配
- lucide-react：界面图标

技术栈说明：参考老师 Mercury 的本地优先、桌面端、Feed 解析、内容清洗、LLM Provider 和 AI Agent 设计思路，但不直接照搬 SwiftUI 技术栈。由于本项目要求支持 Windows / Linux / macOS，因此初步选择 Electron + React + TypeScript + SQLite。

## 本地开发环境

### 环境要求

- Node.js 24 LTS 或更新的 24.x LTS 版本
- npm 11 或更新版本
- Git

当前 T1 开发环境已在本机安装并验证：

```bash
node -v
npm -v
```

本机验证版本：

```text
node v24.16.0
npm 11.13.0
```

### 安装依赖

```bash
npm install
```

### 启动开发版桌面应用

```bash
npm run dev
```

该命令会同时启动 Vite renderer 和 Electron 桌面窗口。

### 远程浏览器预览

如果在服务器上启动项目、从本机浏览器访问，需要让 Vite 监听外部网卡：

```bash
npm run dev:renderer:lan
```

然后在本机浏览器打开：

```text
http://<服务器 IP>:5173/
```

例如：

```text
http://49.52.27.92:5173/
```

如果服务器公网端口没有转发到当前容器，或者普通 SSH tunnel 访问不到当前运行环境，可以使用临时反向 tunnel：

```bash
cloudflared tunnel --url http://127.0.0.1:5173 --no-autoupdate
```

命令会输出一个 `https://*.trycloudflare.com` 地址，在本机浏览器打开该地址即可预览。当前 Vite 配置已允许 `*.trycloudflare.com` 作为开发预览 Host。

### 类型检查和构建

```bash
npm run typecheck
npm run build
```

### 构建后本地启动

```bash
npm run start
```

## Windows / Linux / macOS 运行说明草案

三平台的普通开发命令保持一致：

```bash
git clone <repo-url>
cd mercury-ai-reader
npm install
npm run dev
```

注意事项：

1. Windows 建议使用 PowerShell、Windows Terminal 或 Git Bash；
2. macOS / Linux 使用系统终端即可；
3. 不需要手动配置后端服务，T1 阶段使用 mock 数据；
4. 不提交 `node_modules`、`.env`、API Key 或个人本地配置；
5. 后续涉及文件路径时统一使用 Node.js `path` API 或 Electron 提供的跨平台路径能力，不写死 `C:\...`、`/Users/...`、`/home/...` 等个人绝对路径。

## T1 工程骨架

当前 T1 已完成 Electron + React + TypeScript + Vite 的基础工程骨架：

```text
electron/
  main.ts             # Electron 主进程入口
  preload.ts          # 安全暴露运行时信息
src/
  app/                # 应用入口和整体布局
  core/               # 共享类型、mock 数据
  features/
    feed/             # T3 / T4 / T5 接入入口
    reader/           # T6 / T7 接入入口
    agent/            # T8 / T9 / T10 / T11 Agent 和 Provider 契约入口
    usage/            # T9 LLM Usage 入口
    export/           # T11 Markdown Export 入口
  styles/             # 全局样式
```

T1 mock 页面目前提供：

- 订阅源列表；
- mock 文章列表；
- mock 阅读器正文；
- Summary / Translation / Usage / Export 入口；
- mock Provider 和 mock usage event；
- 单篇 Markdown mock 导出。

### T9 目录对齐说明

为避免和最终目录规划冲突，当前工程不创建 `src/features/llm/*`。

T9 相关代码建议按职责放置：

- Provider / Model 调用契约：`src/features/agent/`
- LLM Usage 记录和统计展示：`src/features/usage/`
- Summary / Translation 调用 Agent 和 Provider 契约，不单独创建平行的 `llm` 功能目录。

## 团队分工

| 编号 | 模块                                     | 负责人                                      | 主要产出                                                                   |
| ---- | ---------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| T0   | 组长 / 项目留痕                         | 51285903036 周彩纯 git用户名：zhoucaichun   | 产品范围、GitHub 管理、PRD、README、AGENTS、LLM 用量统计需求定义、最终验收 |
| T1   | 项目骨架 / 跨平台开发环境 / 基础页面框架 | 51285903058 张珈鸣 git用户名：DonFinliani   | 项目初始化、目录结构、跨平台运行脚本、基础页面                             |
| T2   | 数据模型 / 本地存储                      | 51285903053 林杨 git用户名：lyTAT           | Feed、Article、Content、AITaskRun、LLMUsageEvent 等模型                    |
| T3   | Feed 解析 / Feed URL 添加                | 51285903067 周康 git用户名：ReXT9527        | RSS / Atom 解析和标准化文章数据                                            |
| T4   | OPML 导入 / 订阅源管理                   | 51285903038 李欣然 git用户名：ranwan20      | OPML 解析、订阅源列表、订阅源管理                                          |
| T5   | Sync / 文章同步 / 入库                   | 51285903069 夏培玮 git用户名：maipower      | 刷新订阅源、去重、入库、同步状态                                           |
| T6   | Reader Pipeline / 内容清洗               | 51285903015 杜茗天 git用户名：jieshibang520 | source HTML、cleaned HTML、canonical Markdown                              |
| T7   | 阅读器 UI / 内容呈现 / 阅读样式          | 51285903044 余婧 git用户名：allacnobug      | 文章列表、阅读器、阅读设置、摘要/翻译入口；见 [T7 Reader UI Prototype](docs/features/T7-reader-ui-prototype.html)、[T7 Reader UI Plan](docs/features/T7-reader-ui-plan.md) 和 [T7 UX Review Checklist](docs/features/T7-ux-review-checklist.md) |
| T8   | Agent Runtime / Prompt Templates         | 51285903043 曾夏杨 git用户名：zxy-1a        | Agent 状态机、Prompt 模板、错误状态、共用调用契约                          |
| T9   | LLM Providers / 模型配置 / 用量统计展示  | 51285903049 蔡钦楠 git用户名：QinnanCai0115 | 标准 API 配置、Provider / Model 统一调用接口、LLM Usage 统计面板           |
| T10  | Summary Agent                            | 51285903066 宋金淼 git用户名：songjinmiao   | 摘要生成、摘要展示、摘要保存                                               |
| T11  | Translation Agent / 单篇 Markdown 导出   | 51285903011 余富康 git用户名：suzy327       | 翻译生成、译文展示、单篇导出                                               |

## 五周计划

### 第 1 周：项目初始化与基础架构

目标：

- 完成项目初始化
- 确定技术栈与目录结构
- 完成基础数据模型设计
- 完成 Feed / OPML / Sync 的最小闭环
- 明确各任务 Issue 和 PR 规则

### 第 2 周：阅读与内容清洗闭环

目标：

- 完成文章列表与阅读页基础体验
- 完成 Cleaned HTML
- 完成 Cleaned Markdown
- 完成基础阅读样式
- 初步接通本地数据流

### 第 3 周：AI 能力闭环

目标：

- 完成 LLM Provider 配置
- 完成 Summary Agent
- 完成 Translation Agent
- 开始记录 LLM 用量事件
- 初步实现 AI 结果展示

### 第 4 周：集成、体验优化与加分项

目标：

- 完成主界面整合
- 完成 LLM 用量统计展示
- 完成单篇 Markdown 导出
- 修复跨模块问题
- 进行 Windows / Linux / macOS 兼容性检查

### 第 5 周：验收、文档与最终展示

目标：

- 完成最终集成
- 完成 README / AGENTS / 项目过程文档
- 整理团队分工和提交记录
- 准备最终演示和汇报材料

## 协作规则

1. `main` 分支为稳定分支，不直接提交代码
2. 每位成员基于自己的任务创建分支
3. 每个任务对应一个 GitHub Issue
4. 完成任务后通过 Pull Request 合并
5. Pull Request 需要写清楚修改内容、对应 Issue 和自测结果
6. 提交信息尽量清楚说明本次修改内容
7. 不提交 `node_modules`、本地配置、API Key 或无关临时文件

## 分支命名建议

```text
feature/T1-project-skeleton
feature/T2-storage-sync
feature/T3-reader-view
feature/T4-cleaned-html
feature/T5-cleaned-markdown
feature/T6-reading-style
feature/T7-main-ui
feature/T8-llm-agent
feature/T9-llm-provider-usage
feature/T10-summary-agent
feature/T11-translation-export
docs/T0-project-management
