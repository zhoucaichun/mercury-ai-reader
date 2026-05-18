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
| T7   | 阅读器 UI / 内容呈现 / 阅读样式          | 51285903044 余婧 git用户名：allacnobug      | 文章列表、阅读器、阅读设置、摘要/翻译入口                                  |
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
feature/T1-feed-opml
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
