# Mercury 任务池与 AI 提示词

> 可参考老师自己做的mercury仓库 https://github.com/neolee/mercury
>
> 核心思路：不照搬老师完整项目，但学习它的工程组织方式：本地优先、模块边界清晰、Agent 可配置、Prompt 可治理、用量可追踪、协作过程有留痕。

## 群公告

大家好，我把这次开源课程大作业的项目范围、协作规则和任务池整理好了。老师 5.22 点评后，我们的调整方向是：先尽快验证一个简易原型，把耦合度高的模块组成小组协作，并在下次汇报时说明最终技术选型、修正版 Plan 和原型结果。

这次作业是小组完成一个产品从 0 到 1 的落地，最终提交 GitHub 仓库链接。老师会看：

1. 项目最终是否能运行、能演示；
2. README 里每个人的分工；
3. 每个人的 GitHub 提交记录；
4. 项目过程中的协作痕迹。

所以我们后续会用 GitHub 管理项目。每个人加入仓库，处理自己对应的 Issue，用自己的分支开发，通过 Pull Request 合并。README 里会写清楚每个人分工。

## 作业范围

作业：Mercury，一个本地优先的 AI 阅读助手。

### 必做功能

1. 基础功能：Feed / OPML 解析 + Sync + 内容呈现
2. 内容清洗：Cleaned HTML + Cleaned Markdown + 定制样式
3. AI 功能一：Summary Agent + LLM Providers
4. AI 功能二：Translation Agent

### 技术约束

1. 产品体验：设计规范清楚，用户体验简洁；
2. 本地优先：无需注册登录或订阅，不主动采集用户数据；
3. 平台中立：技术栈、运行脚本和本地路径处理按 Windows / Linux / macOS 跨平台设计；
4. 大模型中立：支持标准 API 的大语言模型服务，包括本地模型；
5. Coding Agent 留痕：形成有价值的工作过程文档；
6. 团队协同留痕：正确记录提交人和提交历史。

### 加分项

1. 大语言模型用量统计
2. 单篇 Markdown 导出

### 暂不做

- 完整多语言系统
- 完整标签系统 / Tag Agent
- 多篇导出
- 复杂日志上报

## 5.22 老师反馈后的调整

1. MVP 范围整体可行，但要尽快验证 AI 生成的简易原型，尽量在第 17 周前完成可演示版本；
2. T8-T11 的 AI 模块耦合度高，需要作为 AI 功能小组协作，不要各自孤立开发；
3. 技术栈方向基本可以，后续重点是定稿技术选型并写进标准化文档；
4. 评分会重点看 GitHub 仓库中的 README、AGENTS、PLAN、任务分工、提交记录和 PR 记录；
5. 增加 T7 作为交互审查负责人，负责从用户体验角度挑问题；
6. 增加 T0 作为测试和最终验收负责人，负责每周集成测试、Demo 链路测试和文档验收；
7. 大模型测试尽量覆盖多个 OpenAI-compatible 服务，例如 DeepSeek、学校模型、hymt2 或本地模型。

## 最终演示闭环

最终项目优先保证下面这条链路跑通：

```text
添加 Feed 或导入 OPML
-> Sync 拉取文章
-> 打开文章
-> 展示 cleaned reader 内容
-> 点击 Summary
-> 点击 Translation
-> 查看 LLM Usage
-> 导出当前文章 Markdown
```

## 协作规则

1. 每个人负责一个主任务；
2. 每个人都需要有 GitHub commit；
3. 不直接 push 到 main，统一走分支 + Pull Request；
4. 每个任务需要可验收，不只是写一点代码；
5. Pull Request 里写清楚完成内容和验证方式；
6. 最终 README 会记录每个人分工；
7. 开发时不要写死 Windows、Linux 或 macOS 专属绝对路径；
8. 普通启动脚本和文档命令应尽量三平台通用。

## 为了方便大家直接使用ai工具协作完成，我把一些提示词给大家：

## 通用 AI 提示词

每位同学确认任务后，可以先把下面通用提示词发给 AI，再附上自己任务对应的专用提示词。

```text
你是我的 AI Coding 助手。请注意：现在先做任务分析，不要直接改代码。请基于我负责的模块，输出：
1. 这个模块的目标；
2. 和其他模块的依赖关系；
3. 推荐的数据结构或接口；
4. 具体实现步骤；
5. 需要我和组长确认的问题；
6. 验收标准；
7. 可能的风险。
等我确认后，再进入代码实现。
```

## 任务总览

| 编号 | 模块                                       | 负责人                                      | 主要产出                                                                             |
| ---- | ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| T0   | 组长 / AI 产品负责人 / 项目留痕 / 测试验收 | 51285903036 周彩纯 git用户名：zhoucaichun   | 产品范围、GitHub 管理、PRD、README、AGENTS、LLM 用量统计需求定义、每周测试、最终验收 |
| T1   | 项目骨架 / 跨平台开发环境 / 基础页面框架   | 51285903058 张珈鸣 git用户名：DonFinliani   | 项目初始化、目录结构、跨平台运行脚本、基础页面                                       |
| T2   | 数据模型 / 本地存储                        | 51285903053 林杨 git用户名：lyTAT           | Feed、Article、Content、AITaskRun、LLMUsageEvent 等模型                              |
| T3   | Feed 解析 / Feed URL 添加                  | 51285903067 周康 git用户名：ReXT9527        | RSS / Atom 解析和标准化文章数据                                                      |
| T4   | OPML 导入 / 订阅源管理                     | 51285903038 李欣然 git用户名：ranwan20      | OPML 解析、订阅源列表、订阅源管理                                                    |
| T5   | Sync / 文章同步 / 入库                     | 51285903069 夏培玮 git用户名：maipower      | 刷新订阅源、去重、入库、同步状态                                                     |
| T6   | Reader Pipeline / 内容清洗                 | 51285903015 杜茗天 git用户名：jieshibang520 | source HTML、cleaned HTML、canonical Markdown                                        |
| T7   | 阅读器 UI / 内容呈现 / 阅读样式 / 交互审查 | 51285903044 余婧 git用户名：allacnobug      | 文章列表、阅读器、阅读设置、摘要/翻译/导出/Usage 入口、交互审查                      |
| T8   | Agent Runtime / Prompt Templates           | 51285903043 曾夏杨 git用户名：zxy-1a        | Agent 状态机、Prompt 模板、错误状态、共用调用契约                                    |
| T9   | LLM Providers / 模型配置 / 用量统计展示    | 51285903049 蔡钦楠 git用户名：QinnanCai0115 | 标准 API 配置、Provider / Model 统一调用接口、LLM Usage 统计面板、多模型测试方案     |
| T10  | Summary Agent                              | 51285903066 宋金淼 git用户名：songjinmiao   | 摘要生成、摘要展示、摘要保存                                                         |
| T11  | Translation Agent / 单篇 Markdown 导出     | 51285903011 余富康 git用户名：suzy327       | 翻译生成、译文展示、单篇导出                                                         |

## 协作小组划分

为了减少等待、提高并行开发效率，按模块相关性划分为 5 个协作方向：

| 协作方向       | 成员                | 协作重点                                                         |
| -------------- | ------------------- | ---------------------------------------------------------------- |
| 项目管理与验收 | T0                  | 产品范围、文档、GitHub 规则、测试验收、最终汇报                  |
| 基础工程与数据 | T1 / T2             | 项目骨架、跨平台运行、本地数据模型和存储接口                     |
| Feed 数据链路  | T3 / T4 / T5        | Feed 添加、OPML 导入、Sync、文章入库                             |
| Reader 与体验  | T6 / T7             | 内容清洗、阅读器 UI、阅读样式、交互审查                          |
| AI 功能小组    | T8 / T9 / T10 / T11 | Agent Runtime、LLM Provider、Summary、Translation、Usage、Export |

## 推荐目录结构

实际目录可以根据技术栈调整，但建议保持 feature-first，而不是简单按前端/后端粗分。

```text
src/
  app/                 # 应用入口、路由、全局布局
  core/                # 通用工具、数据库、任务状态、共享类型
  feed/                # Feed 解析、OPML、Sync
  reader/              # 内容清洗、Markdown、阅读器
  agent/               # Agent runtime、prompt templates、LLM provider
  usage/               # LLM 用量统计
  export/              # 单篇 Markdown 导出
  resources/
    prompts/
      summary.default.yaml
      translation.default.yaml
docs/
  features/
    summary-agent.md
    translation-agent.md
    usage-tracking.md
```

## T0 组长 / AI 产品负责人 / 项目留痕

### 任务内容

- 明确 MVP 范围和产品需求；
- 建 GitHub 仓库、Issues、分支规则、PR 规则；
- 管理 README 分工和最终验收；
- 编写轻量版 PRD / Roadmap；
- 编写或维护轻量版 `AGENTS.md`；
- 设计 LLM 用量统计的产品需求；
- 在 README 和 AGENTS 中写清楚平台中立约束；
- 最终验收时检查是否存在写死平台路径、平台专属命令、只适配单一系统的问题；
- 负责每周集成测试，检查 main 分支是否可运行；
- 负责最终 Demo 链路测试，覆盖 Feed / OPML、Sync、Reader、Summary、Translation、Usage、Export；
- 负责检查 README、AGENTS、PLAN、成员分工、Issue、PR、commit 是否能支撑老师评分；
- 负责最终集成和演示流程。

### 建议产出

- `README.md`
- `AGENTS.md`
- `docs/PRD.md` 或 README 中的产品需求章节
- `docs/features/usage-tracking.md`
- GitHub Issues / PR 模板
- 最终验收清单
- 平台中立验收说明
- 每周集成测试记录
- 最终 Demo 测试记录

### 验收标准

- 有清晰的 MVP 范围；
- GitHub 协作流程可执行；
- README 能说明项目、运行方式和成员分工；
- `AGENTS.md` 能说明技术栈、目录规则、Agent 规则、Prompt 规则、隐私规则；
- `AGENTS.md` 能说明跨平台开发规则，例如禁止写死 OS 专属路径、使用跨平台路径 API；
- README 能说明 Windows / Linux / macOS 的运行方式，或如实说明已验证平台和理论支持平台；
- 每个人的任务、Issue、PR、commit 能对应上；
- 每周集成后有测试记录或验收说明；
- 最终 Demo 链路可以按 README 跑通；
- 最终项目能完成一条完整演示流程。

### AI 提示词

```text
你是一个 AI 产品经理和技术项目助理。我们正在做一个本地优先的 AI 阅读助手 Mercury，课程要求完成 Feed/OPML、Sync、内容呈现、内容清洗、Summary Agent、Translation Agent，并额外做 LLM 用量统计和单篇 Markdown 导出。项目还要求平台中立，需要按 Windows / Linux / macOS 跨平台运行方式设计。请参考真实开源项目的组织方式，帮我分析作为组长应该如何设计 MVP 范围、GitHub 协作流程、README 分工结构、AGENTS.md 约束、平台中立验收说明、LLM 用量统计需求和最终验收清单。请先输出任务拆解、关键风险、验收标准，不要直接写代码。
```

## T1 项目骨架 / 跨平台开发环境 / 基础页面框架

### 任务内容

- 初始化项目结构；
- 配置跨平台运行脚本；
- 建立基础页面布局；
- 建立主要模块目录；
- 建立 mock 数据入口，方便其他同学不等后端接口也能开发；
- 避免使用单一操作系统专属命令作为普通启动方式；
- 使用跨平台路径处理方式，不写死 `C:\...`、`/Users/...` 等本机绝对路径；
- 为 README 提供 Windows / Linux / macOS 运行命令草案；
- 保证所有成员可以本地运行项目。

### 验收标准

- 项目能按照 README 命令启动；
- 有基础页面或入口；
- 目录结构清晰；
- 后续模块能接入；
- 有 mock 数据或示例数据；
- 普通启动命令在 Windows / Linux / macOS 上尽量一致；
- 本地文件路径使用跨平台 API 或相对路径；
- README 中有三平台运行说明草案；
- 不引入过度复杂的工程配置。

### AI 提示词

```text
你是资深全栈工程师。我们要做 Mercury，一个本地优先 AI 阅读助手，项目要求平台中立，目标支持 Windows / Linux / macOS 本地运行。我的任务是负责项目骨架、跨平台开发环境和基础页面框架。请根据项目目标分析应该如何初始化项目结构、目录划分、跨平台运行脚本、基础页面布局、mock 数据入口和模块边界。请特别注意不要写死 OS 专属路径或依赖单一平台命令。请输出推荐目录结构、开发步骤、三平台运行说明草案、可能影响其他成员的接口、验收标准。先做分析，不要直接写代码。
```

## T2 数据模型 / 本地存储

### 任务内容

- 设计 Feed、Article、Content 等阅读基础数据结构；
- 设计 Summary、Translation 的 AI 结果结构；
- 设计 `AITaskRun` 或类似结构，记录 AI 任务状态；
- 设计 `LLMUsageEvent` 或类似结构，记录每次模型请求；
- 实现本地存储接口；
- 提供增删改查方法。

### 推荐核心实体

- `Feed`
- `Article`
- `ArticleContent`
  - source HTML
  - cleaned HTML
  - canonical Markdown
- `AITaskRun`
  - task type: summary / translation
  - status: queued / running / succeeded / failed / cancelled
  - provider / model
  - createdAt / updatedAt
- `SummaryResult`
- `TranslationResult`
- `LLMUsageEvent`
  - agent type
  - provider
  - model
  - status
  - prompt tokens
  - completion tokens
  - total tokens
  - createdAt

### 验收标准

- 能保存订阅源；
- 能保存文章；
- 能保存 source HTML、cleaned HTML、canonical Markdown；
- 能保存摘要和翻译结果；
- 能保存 LLM 调用记录；
- 接口命名清楚，方便其他模块调用；
- 敏感信息如 API key 不进入普通业务数据表或提交到仓库。

### AI 提示词

```text
你是数据建模和本地存储专家。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是设计数据模型和本地存储接口。请分析 Feed、Article、ArticleContent、SummaryResult、TranslationResult、AITaskRun、LLMUsageEvent 等实体应该包含哪些字段，它们之间是什么关系，本地存储应提供哪些方法。请特别注意 source HTML、cleaned HTML、canonical Markdown 三层内容，以及每次 LLM request 的用量记录。请输出数据模型设计、接口清单、边界说明、验收标准和风险点。先分析，不要直接写代码。
```

## T3 Feed 解析 / Feed URL 添加

### 任务内容

- 支持 RSS / Atom Feed 解析；
- 可选支持 JSON Feed；
- 支持用户添加 Feed URL；
- 返回标准化文章数据；
- 处理解析失败、空 Feed、重复文章等情况。

### 验收标准

- 能解析至少 2-3 个真实 Feed；
- 能提取标题、链接、发布时间、作者、摘要等字段；
- 解析失败有错误信息；
- 输出格式能交给 T5 Sync 使用；
- 缺失字段时有合理兜底。

### AI 提示词

```text
你是 RSS/Atom 解析模块工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现 Feed URL 添加和 RSS/Atom 解析，可选支持 JSON Feed。请分析应该支持哪些 Feed 格式，标准化输出哪些字段，如何处理网络错误、解析错误、重复文章、缺失字段。请给出实现步骤、接口设计、测试样例和验收标准。先分析，不要直接写代码。
```

## T4 OPML 导入 / 订阅源管理

### 任务内容

- 支持 OPML 文件解析；
- 从 OPML 中提取订阅源列表；
- 实现订阅源列表管理；
- 支持启用、删除、查看订阅源。

### 验收标准

- 能导入常见 OPML 文件；
- 能提取多个 Feed 地址；
- 能保存订阅源；
- 能在界面或数据层看到订阅源列表；
- 重复订阅源不会重复添加；
- 无效订阅源有提示或错误记录。

### AI 提示词

```text
你是 OPML 和订阅源管理模块工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现 OPML 导入和订阅源管理。请分析 OPML 的常见结构、需要提取哪些字段、如何和 Feed 数据模型对接、如何处理重复订阅源和无效 URL。请输出接口设计、实现步骤、测试样例和验收标准。先分析，不要直接写代码。
```

## T5 Sync / 文章同步 / 入库

### 任务内容

- 根据订阅源刷新文章；
- 调用 Feed 解析结果；
- 文章去重；
- 将新文章写入本地存储；
- 记录同步状态和错误；
- 为 UI 提供同步进度或状态。

### 验收标准

- 点击或调用 Sync 后能拉取文章；
- 重复文章不会重复入库；
- 同步成功和失败状态清楚；
- 能和 T2、T3、T4 对接；
- 单个订阅源失败不影响其他订阅源同步；
- 能记录最近同步时间。

### AI 提示词

```text
你是同步流程和数据入库模块工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现 Sync，同步订阅源文章并写入本地存储。请分析同步流程应该如何设计，如何调用 Feed 解析结果，如何去重，如何记录同步状态、错误和更新时间，以及如何给 UI 提供同步进度或状态。请输出流程图式步骤、接口设计、边界情况、验收标准。先分析，不要直接写代码。
```

## T6 Reader Pipeline / 内容清洗

### 任务内容

- 获取或接收文章原始 HTML；
- 对文章原始 HTML 做清洗；
- 提取正文内容；
- 生成 cleaned HTML；
- 生成 canonical Markdown；
- 让 Markdown 成为 Summary、Translation、Export 的标准输入。

### 推荐 pipeline

```text
source HTML
-> cleaned HTML
-> canonical Markdown
-> rendered reader content
```

### 验收标准

- 能去掉明显广告、脚本、导航等噪声；
- 能输出可读 cleaned HTML；
- 能输出 canonical Markdown；
- 能处理至少 2-3 篇真实文章样例；
- 输出内容能被阅读器、AI Agent、导出模块复用；
- 图片、链接、列表、标题等基础结构尽量保留。

### AI 提示词

```text
你是内容清洗和正文提取模块工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现 Reader Pipeline，输出 source HTML、cleaned HTML 和 canonical Markdown。请分析原始网页内容可能有哪些噪声，清洗流程如何设计，HTML 和 Markdown 分别应该如何输出，如何为阅读器、摘要、翻译、导出提供统一内容。请特别注意 Markdown 是后续 AI 和导出的标准输入。请输出实现方案、接口设计、测试样例、验收标准和风险点。先分析，不要直接写代码。
```

## T7 阅读器 UI / 内容呈现 / 阅读样式

### 任务内容

- 实现文章列表；
- 实现文章详情阅读页；
- 展示 cleaned reader 内容；
- 支持加载、空状态、错误状态；
- 支持基础阅读样式设置；
- 为摘要、翻译、导出按钮预留位置。
- 作为交互审查负责人，从用户体验角度检查页面流程和视觉一致性；
- 每周集成后向 T0 反馈体验问题，例如入口是否清楚、阅读是否舒服、状态提示是否明确；
- 审查 Summary、Translation、Export、Usage 等入口是否自然、统一、容易理解。

### 建议阅读设置

- 字号
- 行距
- 主题或浅色/深色
- 阅读宽度

### 验收标准

- 能看到文章列表；
- 能打开文章详情；
- 能展示清洗后的正文；
- 页面状态清楚；
- 至少支持 2 个阅读设置；
- 摘要、翻译、导出入口位置明确；
- 即使后端接口未完成，也能先用 mock 数据开发。
- 有交互审查记录或体验问题清单；
- 能指出并推动修正至少若干个影响演示体验的问题。

### AI 提示词

```text
你是前端阅读体验工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现文章列表、阅读器页面和基础阅读样式设置。请分析用户阅读流程、页面结构、需要展示哪些字段、如何处理加载状态、空状态、错误状态，以及如何为摘要、翻译、导出功能预留交互入口。请同时分析字号、行距、主题、阅读宽度等阅读设置如何设计。请输出页面结构、组件拆分、数据依赖、验收标准。先做分析，不要直接写代码。
```

## T8 Agent Runtime / Prompt Templates

### 任务内容

- 定义 Summary 和 Translation 共用的 Agent 调用状态；
- 设计 prompt templates 文件结构；
- 提供 summary / translation 调用时共用的参数渲染方式；
- 定义 running / succeeded / failed / cancelled 等状态；
- 定义错误提示和重试/清除行为；
- 避免 Summary 和 Translation 各自重复写一套 AI 调用流程。

### 建议产出

```text
resources/prompts/summary.default.yaml
resources/prompts/translation.default.yaml
src/agent/runtime/*
src/agent/prompts/*
```

### 验收标准

- `summary.default.yaml` 存在；
- `translation.default.yaml` 存在；
- Summary 和 Translation 都通过统一 Agent 调用契约执行；
- 失败状态能被 UI 展示；
- 每次调用能生成 usage record；
- Prompt 不直接硬编码在 Summary / Translation 函数内部。

### AI 提示词

```text
你是 AI Agent 架构工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是设计 Summary 和 Translation 共用的 Agent Runtime 与 Prompt Templates。请分析如何定义统一的 Agent 调用状态，例如 idle、running、succeeded、failed、cancelled；如何设计 prompt 模板文件，例如 summary.default.yaml 和 translation.default.yaml；如何渲染模板参数；如何让 Summary Agent 和 Translation Agent 复用同一套调用契约、错误处理和 usage record 记录方式。请输出架构设计、文件结构、接口设计、Prompt 模板草案、验收标准和风险点。先分析，不要直接写代码。
```

## T9 LLM Providers / 模型配置 / 用量统计展示

### 任务内容

- 设计统一 LLM Provider 接口；
- 支持标准 API 服务；
- 支持 base URL、API key、model 配置；
- 支持本地模型和远程模型；
- 提供模型连通性测试；
- 设计多模型测试方案，尽量覆盖 DeepSeek、学校模型、hymt2 或本地模型等 OpenAI-compatible 服务；
- 为 Summary 和 Translation 提供统一调用方法；
- 记录调用结果给用量统计；
- 实现 LLM Usage 统计面板或页面；
- 展示总调用次数、成功/失败次数、总 token 或估算用量；
- 展示按功能类型、provider、model 维度的基础统计；
- 展示最近调用明细，例如功能类型、provider、model、状态、token、调用时间。

### 用量统计职责边界

T9 是 LLM 用量统计展示的主负责人，但不是所有数据来源的唯一负责人。

- T0 负责定义 LLM 用量统计的产品需求和最终验收标准；
- T2 负责 `LLMUsageEvent` 或类似数据结构，以及本地存储接口；
- T8 负责 Agent Runtime 中统一的 usage record 记录契约；
- T9 负责 Provider 返回 token / 用量信息，并完成统计面板或页面展示；
- T10 Summary Agent 负责摘要调用时产生日志或把日志交给统一记录接口；
- T11 Translation Agent 负责翻译调用时产生日志或把日志交给统一记录接口。

MVP 中用量统计不追求复杂报表，优先保证“有记录、能汇总、能展示、能用于演示”。

### 验收标准

- 摘要和翻译能通过同一 Provider 调用；
- 用户可配置 provider name、base URL、API key、model；
- 至少整理 2-3 个模型服务的接入方式或测试计划；
- 调用失败有错误信息；
- 能返回 token 或估算用量信息；
- 能看到 LLM Usage 统计面板或页面；
- 统计面板能展示调用总数、成功/失败次数、token 或估算用量；
- 明细列表能区分 Summary 和 Translation 调用；
- 明细列表能展示 provider、model、状态和调用时间；
- API key 等敏感信息不提交到仓库；
- 支持 OpenAI-compatible API 的扩展思路。

### AI 提示词补充说明

使用下面的 T9 专用提示词时，需要额外告诉 AI：本任务不只做 LLM Provider，还要负责一个轻量的 LLM Usage 统计面板或页面。统计展示范围控制在 MVP 级别，包括总调用次数、成功/失败次数、token 或估算用量、按功能类型/provider/model 的基础统计、最近调用明细。不要做复杂报表、账单系统或云端同步。

### AI 提示词

```text
你是 LLM Provider 和 AI 工程化专家。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是设计并实现统一 LLM Provider，支持标准 API 的大模型服务，包括远程模型和本地模型。请分析配置项、接口方法、连通性测试、错误处理、隐私约束、如何给 Summary Agent 和 Translation Agent 调用，以及如何记录 token/调用状态给用量统计。请输出接口设计、数据结构、实现步骤、验收标准。先分析，不要直接写代码。
```

## T10 Summary Agent

### 任务内容

- 实现文章摘要功能；
- 调用 LLM Provider；
- 使用 T8 的 prompt template；
- 支持目标语言和摘要详细程度；
- 保存摘要结果；
- 支持重新生成、复制、清除或失败重试。

### 验收标准

- 能对文章生成摘要；
- 摘要结果能展示；
- 摘要结果能保存；
- 支持至少 2 种摘要详细程度；
- 失败时有提示；
- 调用记录能交给用量统计；
- 摘要输出结构稳定，适合阅读。

### AI 提示词

```text
你是 AI Agent 产品工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现 Summary Agent。请分析文章摘要功能应该如何设计，包括输入内容选择、目标语言、摘要详细程度、prompt template 参数、输出格式、摘要缓存、重新生成、复制、清除、失败处理、和 LLM Provider 的对接、以及如何记录调用用量。请输出功能拆解、接口设计、prompt 参数建议、验收标准和风险点。先分析，不要直接写代码。
```

## T11 Translation Agent / 单篇 Markdown 导出

### 任务内容

- 实现文章翻译功能；
- 调用 LLM Provider；
- 使用 T8 的 prompt template；
- 保存并展示译文；
- 支持当前文章导出为 Markdown；
- 导出内容可包含标题、原文链接、摘要、译文等。

### 建议翻译范围

MVP 中优先做整篇文章翻译或按段落翻译的简化版。不要一开始追求复杂的多段并发、断点续传和高级重试。

### 验收标准

- 能对文章生成译文；
- 译文能展示和保存；
- 翻译失败有提示；
- 当前文章能导出 Markdown；
- 导出内容格式清晰；
- 调用记录能交给用量统计。

### AI 提示词

```text
你是 AI 翻译和内容导出模块工程师。我们要做 Mercury，本地优先 AI 阅读助手。我的任务是实现 Translation Agent 和单篇 Markdown 导出。请分析翻译功能如何设计，包括输入内容、目标语言、translation prompt template 参数、输出格式、保存方式、失败处理、和 LLM Provider 的对接；同时分析单篇文章 Markdown 导出应该包含哪些字段，例如标题、原文链接、摘要、译文、正文 Markdown。请输出功能拆解、接口设计、prompt 参数建议、Markdown 模板、验收标准。先分析，不要直接写代码。
```

## 并行开发说明

每个任务工作量尽量设计得接近。某些模块会有依赖，但大家可以先用 mock 数据开发，不需要等别人全部完成。

- 阅读器可以先用 mock 文章；
- Summary / Translation 可以先用 mock 文本；
- Sync 可以先用 mock Feed 解析结果；
- 导出可以先用 mock Markdown；
- 用量统计可以先用 mock 调用记录；
- LLM Provider 可以先用 mock provider，后续再接真实 API；
- Prompt templates 可以先用固定 YAML / JSON / Markdown 文件，后续再接配置 UI。

T8-T11 属于 AI 功能小组，需要优先统一 Agent Runtime、Provider 接口、Prompt 模板和 usage record，再分别推进 Summary、Translation、Usage 和 Export。这样可以避免 Summary 和 Translation 各写一套模型调用逻辑。

大家确认任务后可以马上让 AI 分析自己的任务，不用等待其他同学。

## 平台中立说明

平台中立不是要求一开始就打包 Windows / Linux / macOS 三端安装包，而是要求技术栈、路径处理、运行脚本和文档说明具备跨平台设计。

最低要求：

1. README 提供 Windows / Linux / macOS 的运行方式；
2. 普通启动命令尽量三平台一致；
3. 不写死本机绝对路径；
4. 不把 Windows-only、macOS-only 或 Linux-only 命令作为唯一启动方式；
5. 本地数据目录、导出目录、临时目录使用跨平台 API 或相对路径；
6. 如果无法验证某个平台，需要在 README 中如实说明已验证平台和理论支持平台。

## 对老师 Mercury 仓库的参考点

我们不照搬老师完整项目，但参考以下做法：

1. feature-first 目录结构：`Feed`、`Reader`、`Agent`、`Usage` 等模块边界清楚；
2. `AGENTS.md` 固化工程规则和 AI 协作规则；
3. Agent 不只是 API 调用，而是包含 Provider、Model、Prompt、Runtime、Result、Usage；
4. Prompt 尽量独立成模板文件，不硬编码在业务函数里；
5. Reader 内容采用分层 pipeline：source HTML -> cleaned HTML -> Markdown -> reader content；
6. LLM usage 按每次 request 记录，而不是只按功能记录；
7. README 要能让老师快速看懂产品、运行方式、功能范围和成员分工。
