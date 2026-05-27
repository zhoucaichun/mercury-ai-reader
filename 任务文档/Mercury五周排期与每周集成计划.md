# Mercury 五周排期与每周集成计划

## 总体策略

项目周期按 5 周规划，每周进行一次集成。

组员可以自行安排本周开发时间，但每周必须按时提交可审核、可合并、可验收的 Pull Request。组长每周末进行审核、集成和风险调整，保证后续任务不被阻塞。

核心原则：

1. 每周都有明确交付物；
2. 每周至少一次集成到 main；
3. main 分支始终尽量保持可运行；
4. 每个人每周都有可追踪的 GitHub 贡献；
5. 每周集成结果决定下一周是否调整范围；
6. 第 5 周冻结新功能，只做修复、文档和演示；

## 5.22 老师反馈后的排期调整

老师反馈后，排期做以下调整：

1. Week 1 不只是项目启动，也要完成反馈调整、技术定型和简易原型；
2. T8-T11 不再按线性等待推进，而是作为 AI 小组并行协作；
3. T0 负责测试和最终验收，T7 负责交互审查；
4. T9 的多模型测试需要提前规划，后续尽量覆盖 DeepSeek、学校模型、hymt2 或本地模型；
5. 下次汇报重点展示最终技术选型、修正版 Plan 和简易原型。

## 每周固定节奏（按周五需要汇报进行了修改）

```text
每周三前提交 PR
每周五前完成本周集成
```

如果遇到课堂汇报节点，则汇报前一天先提交轻量成果，不要求完整功能，但必须能说明设计、接口、原型或验证结果。

## PR 提交要求

每个 PR 必须包含：

1. 本周完成内容；
2. 如何运行或验证；
3. 截图或日志，能截图就截图；
4. 还没完成的风险点；
5. 是否影响其他模块。

建议 PR 模板：

```markdown
## 本周完成

## 验证方式

## 截图 / 日志

## 影响模块

## 未完成 / 风险

```

## 第 1 周：5.22-5.29｜反馈调整 + 技术定型 + 简易原型 + 架构契约

### 本周目标

完成老师反馈后的修正版计划、最终技术选型和简易原型。

本周结束时，项目至少要能启动，有基础页面或可展示原型，有 mock 数据，有初版 README 和 AGENTS。后天汇报前，先提交轻量成果：技术选型说明、Plan 调整、简易原型、核心接口草案。

### 本周必须交付

| 任务                                          | 本周交付                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| T0 组长 / AI 产品负责人 / 项目留痕 / 测试验收 | GitHub 仓库、成员邀请、Issues、PR 规则、README 初版、AGENTS 初版、老师反馈整理、测试验收清单 |
| T1 项目骨架 / 跨平台开发环境 / 基础页面框架   | 项目骨架、跨平台启动命令、基础页面、mock 数据                                                |
| T2 数据模型 / 本地存储                        | 数据模型草案和基础存储接口                                                                   |
| T3 Feed 解析 / Feed URL 添加                  | Feed 解析接口设计和至少 1 个 RSS/Atom 解析样例                                               |
| T4 OPML 导入 / 订阅源管理                     | OPML 解析接口设计和 1 个 OPML 样例                                                           |
| T5 Sync / 文章同步 / 入库                     | Sync 流程设计，先用 mock feed 结果                                                           |
| T6 Reader Pipeline / 内容清洗                 | Reader Pipeline 设计，mock HTML -> cleaned text / Markdown 原型                              |
| T7 阅读器 UI / 内容呈现 / 阅读样式 / 交互审查 | 文章列表 + 阅读器 mock UI、简易交互原型、体验审查清单                                        |
| T8 Agent Runtime / Prompt Templates           | Agent Runtime 状态设计 + prompt template 文件结构                                            |
| T9 LLM Providers / 模型配置 / 用量统计展示    | LLM Provider 接口设计 + mock provider、多模型测试方案                                        |
| T10 Summary Agent                             | Summary Agent mock 流程                                                                      |
| T11 Translation Agent / 单篇 Markdown 导出    | Translation Agent mock 流程 + 导出模板草案                                                   |

### 第 1 周集成验收

```text
项目能启动
能看到 mock 文章列表
能打开 mock 文章
README 有运行方式和分工初版
AGENTS 有基本规则
每个人至少一个 PR
后天汇报前有最终技术选型、修正版 Plan 和简易原型材料
```

### 组长审核重点

1. 项目能不能跑；
2. 目录结构是否清晰；
3. 是否有写死平台路径；
4. 每个人是否真的有 commit；
5. 各模块接口有没有明显冲突；
6. 简易原型是否能说明最终产品流程；
7. T8-T11 的 AI 小组接口是否统一。

## 第 2 周：Feed / OPML / Sync / 本地数据主链路

### 本周目标

让真实文章能够进入系统。

第 2 周不要求 AI 功能完整，但必须打通 Feed / OPML / Sync / 本地存储 / 文章列表这条主链路。

### 本周必须交付

| 任务                                        | 本周交付                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| T1 项目骨架 / 跨平台开发环境 / 基础页面框架 | 完善跨平台运行说明，保证 main 分支稳定启动                   |
| T2 数据模型 / 本地存储                      | Feed / Article / Content 存储可用                            |
| T3 Feed 解析 / Feed URL 添加                | 支持 2-3 个真实 Feed 解析                                    |
| T4 OPML 导入 / 订阅源管理                   | 支持 OPML 导入，生成订阅源列表                               |
| T5 Sync / 文章同步 / 入库                   | Sync 能调用 Feed / OPML 结果并写入本地存储                   |
| T6 Reader Pipeline / 内容清洗               | 能接收真实文章 HTML 或内容字段，输出 cleaned Markdown 原型   |
| T7 阅读器 UI / 内容呈现 / 阅读样式          | 文章列表从真实数据读取                                       |
| T8 Agent Runtime / Prompt Templates         | Agent 状态结构稳定，不阻塞 AI 功能后续接入                   |
| T9 LLM Providers / 模型配置 / 用量统计展示  | Provider 配置结构稳定                                        |
| T10 Summary Agent                           | Summary 继续基于 mock 文本，但接口改为接收 Article / Content |
| T11 Translation Agent / 单篇 Markdown 导出  | Translation / Export 接口改为接收 Article / Content          |
| T0 组长 / AI 产品负责人 / 项目留痕          | 更新 README 的数据流说明和本周集成记录                       |

### 多模型测试准备

从第 2 周开始，T9 需要准备至少 2-3 个 OpenAI-compatible 模型服务的配置和连通性测试方案，例如 DeepSeek、学校模型、hymt2 或本地模型。第 2 周不要求全部真实调用成功，但要明确 base URL、model、API key 配置方式和失败提示策略。

### 第 2 周集成验收

```text
添加 Feed 或导入 OPML
点击 Sync
文章进入本地存储
文章列表显示真实文章
能打开文章详情
```

### 组长审核重点

1. T2 / T3 / T4 / T5 是否真的打通；
2. 文章是否去重；
3. 失败状态是否有提示；
4. 数据模型是否够后续 AI 使用；
5. main 分支是否保持可运行。

## 第 3 周：Reader Pipeline + 阅读体验

### 本周目标

文章能被清洗、阅读，并作为 AI 输入。

本周重点是把真实文章从原始内容转换成可读内容，并产出 canonical Markdown，供 Summary、Translation、Export 使用。

### 本周必须交付

| 任务                                       | 本周交付                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| T2 数据模型 / 本地存储                     | Content 存储支持 source HTML / cleaned HTML / canonical Markdown   |
| T5 Sync / 文章同步 / 入库                  | Sync 后能触发或支持内容清洗流程                                    |
| T6 Reader Pipeline / 内容清洗              | Reader Pipeline 可用：source HTML -> cleaned HTML -> Markdown      |
| T7 阅读器 UI / 内容呈现 / 阅读样式         | 阅读器展示 cleaned 内容，支持基础阅读设置                          |
| T3 Feed 解析 / Feed URL 添加               | 修复真实 Feed 解析中发现的问题                                     |
| T4 OPML 导入 / 订阅源管理                  | 修复 OPML / 订阅源管理中发现的问题                                 |
| T8 Agent Runtime / Prompt Templates        | Prompt templates 草案可读取或可被 Summary / Translation 使用       |
| T9 LLM Providers / 模型配置 / 用量统计展示 | LLM Provider mock 调用稳定                                         |
| T10 Summary Agent                          | Summary 使用 canonical Markdown 作为输入，先 mock 输出也可以       |
| T11 Translation Agent / 单篇 Markdown 导出 | Translation / Export 使用 canonical Markdown 作为输入              |
| T0 组长 / AI 产品负责人 / 项目留痕         | 更新 PRD / README，确认 Reader Pipeline 是后续 AI 和导出的标准输入 |

### 第 3 周集成验收

```text
真实文章可以打开
阅读器显示清洗后的正文
能看到基础阅读样式设置
系统中有 canonical Markdown
Summary / Translation / Export 能拿到 Markdown 输入
```

### 组长审核重点

1. Markdown 是否可用；
2. 阅读器是否比原始网页干净；
3. 内容清洗是否保留标题、链接、段落等基本结构；
4. T10 / T11 是否已经对接到正确输入，而不是自己造数据。

## 第 4 周：AI 功能 + 用量统计 + 单篇导出

### 本周目标

AI 主链路跑通。

本周要完成 Summary、Translation、LLM 用量统计和单篇 Markdown 导出。这里的 LLM 用量统计分两段推进：第 1-3 周先把 usage 记录链路和数据结构打通，第 4 周由 T9 统一做统计面板/页面收口。第 4 周结束后，核心功能必须能演示。

### 本周必须交付

| 任务                                          | 本周交付                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| T8 Agent Runtime / Prompt Templates           | Agent Runtime 状态：idle / running / succeeded / failed，可被 UI 使用；usage record 契约前置            |
| T9 LLM Providers / 模型配置 / 用量统计展示    | 真实 OpenAI-compatible Provider 调用，支持 base URL / API key / model；LLM Usage 统计面板可用           |
| T10 Summary Agent                             | Summary Agent 调用真实或可配置模型，保存并展示结果，并持续产出 usage record                             |
| T11 Translation Agent / 单篇 Markdown 导出    | Translation Agent 调用真实或可配置模型，保存并展示结果；单篇 Markdown 导出可用，并持续产出 usage record |
| T2 数据模型 / 本地存储                        | AITaskRun / LLMUsageEvent 存储可用，前 3 周先把 usage 记录落库                                          |
| T7 阅读器 UI / 内容呈现 / 阅读样式            | 阅读器中预留 Summary、Translation、Export 入口，Usage 面板由 T9 主实现并挂接入口                        |
| T6 Reader Pipeline / 内容清洗                 | 为 AI 提供稳定 Markdown 输入                                                                            |
| T5 Sync / 文章同步 / 入库                     | 修复同步和内容流中的集成问题                                                                            |
| T0 组长 / AI 产品负责人 / 项目留痕 / 测试验收 | LLM 用量统计验收、补 usage 文档、检查 API key 不提交仓库、完成 AI 功能集成测试                          |

### 第 4 周集成验收

```text
打开真实文章
点击 Summary 生成摘要
点击 Translation 生成译文
能看到 LLM 调用记录
能导出当前文章 Markdown
API key 不出现在仓库
至少完成 2-3 个模型服务的配置或连通性测试说明
```

### 说明

LLM 用量统计不会等到第 4 周才开始。正确推进方式是：

1. 第 1 周：T2 定 `LLMUsageEvent`，T8 定 usage record 契约，T9 定 provider 返回值结构；
2. 第 2-3 周：T10 / T11 在每次调用 AI 时持续记录 usage，T2 负责落库；
3. 第 4 周：T9 统一做 LLM Usage 统计面板/页面，T7 挂入口，T0 做验收。

也就是说，前 3 周先把“记录”做通，第 4 周再把“展示”收口。

### 组长审核重点

1. AI 调用失败时是否有提示；
2. API key 是否安全；
3. Summary / Translation 是否共用 Provider / Agent 契约；
4. Usage 是否按每次 request 记录；
5. 单篇导出是否格式清楚；
6. 多模型配置是否真的符合大模型中立要求。

## 第 5 周：冻结功能 + 测试 + 文档 + 演示

### 本周目标

最终提交能给老师看。

本周不再新增大功能，只做：

- bug fix
- README
- 分工表
- 截图 / 演示说明
- 跨平台说明
- 提交记录检查
- 最终集成

### 本周必须交付

| 任务                                          | 本周交付                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| T0 组长 / AI 产品负责人 / 项目留痕 / 测试验收 | README 完整版、成员分工、演示流程、平台中立说明、最终验收清单、最终测试记录 |
| T1 项目骨架 / 跨平台开发环境 / 基础页面框架   | 三平台运行说明最终版，检查启动命令                                          |
| T2 数据模型 / 本地存储                        | 数据模型稳定，清理测试数据或示例数据                                        |
| T3 Feed 解析 / Feed URL 添加                  | Feed 解析稳定，提供测试 Feed 列表                                           |
| T4 OPML 导入 / 订阅源管理                     | OPML 示例和订阅源管理稳定                                                   |
| T5 Sync / 文章同步 / 入库                     | Sync 异常处理和状态提示稳定                                                 |
| T6 Reader Pipeline / 内容清洗                 | 内容清洗样例和边界说明                                                      |
| T7 阅读器 UI / 内容呈现 / 阅读样式 / 交互审查 | UI 打磨，截图，空状态 / 错误状态，最终交互审查问题清单                      |
| T8 Agent Runtime / Prompt Templates           | Prompt 模板和 Agent 状态文档                                                |
| T9 LLM Providers / 模型配置 / 用量统计展示    | LLM Provider 配置说明、LLM Usage 统计验收                                   |
| T10 Summary Agent                             | Summary 功能说明和验收样例                                                  |
| T11 Translation Agent / 单篇 Markdown 导出    | Translation / Export 功能说明和验收样例                                     |

### 第 5 周最终验收

```text
README 能让老师看懂项目
每个人分工清楚
每个人 commit 进入 main
项目能按说明启动
完整 demo 链路能跑通
平台中立说明清楚
API key 没有泄露
```

### 组长审核重点

1. 老师打开 GitHub 第一眼是否清楚；
2. 每个人是否有提交；
3. README 分工是否和 commit 对得上；
4. main 分支是否可运行；
5. 有没有半成品功能入口；
6. 有没有没合并的 PR。

## 关键路径

5 周里最重要的先后关系：

```text
第 1 周：T1 / T2 / T8 / T9 定契约（含 usage record 结构）
第 2 周：T3 / T4 / T5 / T2 打通数据进入
第 3 周：T6 / T7 打通阅读和 Markdown
第 4 周：T8 / T9 / T10 / T11 / T2 打通 AI 和 usage 展示收口
第 5 周：T0 全面测试和文档收口，T7 完成交互体验收口
```

如果某周有人没完成，影响最大的是：

| 风险                | 影响                            |
| ------------------- | ------------------------------- |
| 第 1 周 T1 没完成   | 大家不好集成                    |
| 第 1-2 周 T2 没完成 | 数据流会乱                      |
| 第 2 周 T5 没完成   | 真实文章进不来                  |
| 第 3 周 T6 没完成   | AI 没有稳定输入                 |
| 第 4 周 T9 没完成   | Summary / Translation 只能 mock |
| 第 5 周 T0 没收口   | 老师看不懂贡献                  |
