# Mercury 四周排期与每周集成计划

## 1. 总体策略

项目周期按 4 周推进，每周至少完成一次可审查、可合并、可验证的阶段成果。当前节奏调整为：

```text
Week 1：项目调整 + 技术栈确定 + 项目骨架 + mock 原型
Week 2：真实 Feed 主链路 + 前端接入 + Windows 打包
Week 3：主链路收尾 + AI 功能 + Export + Usage 一周集成完成
Week 4：最终测试 + bug fix + 文档 + 截图 + 打包 + 提交
```

核心原则：

1. Week 3 结束前完成所有剩余功能开发和 MVP 集成；
2. Week 4 不再新增大功能，只做修复、测试、文档和演示收口；
3. main 分支始终保持可运行；
4. 所有 PR 必须说明完成内容、验证方式、影响模块和未完成风险；
5. 公共接口以 `AGENTS.md` 为准，成员不得自行新增一套字段或目录规则；
6. 最终交付必须包含可直接运行的打包版本，不只提交源码仓库。

## 2. 当前 main 已完成成果

截至当前最新 main，项目已经完成以下成果：

- Electron + React + TypeScript + Vite 项目骨架已进入 main；
- Reader 三栏前端页面已形成：订阅源、文章列表、阅读区、AI 功能入口；
- Feed / Sync 主链路可拉取真实 RSS / Atom；
- 前端 Add Feed / Sync 已通过 Electron IPC 接入真实 Week2 Feed 同步链路；
- `npm run smoke:week2` 可同步真实 Feed，并输出 feeds / articles / articleContent；
- SQLite 数据模型、stores、Week2StorageAdapter 已有代码和测试；
- OPML / Subscription 已有解析和内存订阅源管理代码；
- Reader Pipeline 已有 mock pipeline 和接口；
- Agent Runtime、Provider、Usage、Summary 已有基础代码或文档；
- T11 Translation / Export 已通过 clean 分支合入 main；
- 单篇 Markdown Export 已有基础代码；
- Windows zip 打包配置已进入 main，`npm run pack:win:zip` 可生成打包产物；
- 当前验证结果：`npm test`、`npm run smoke:week2`、`npm run build`、`npm run pack:win:zip` 均可通过。

当前仍需注意：

- 前端真实同步链路目前使用内存 `MockStoragePort`，SQLite 还没有正式接入前端同步流程；
- OPML 导入还没有完整前端交互；
- Reader Pipeline 仍是 mock 清洗流程；
- Summary / Translation / Usage / Export 已有入口或基础代码，但还没有完整接入真实前端操作流；
- `origin/feature/T2-storage-sync` 是旧危险分支，相对 main 有大量删除风险，不能直接合并；
- 最终打包产物位于 `release/`，该目录已加入 `.gitignore`，提交时不进入仓库。

## 3. 每周固定节奏

```text
每周三前：成员提交 PR 或可审查成果
每周五前：组长完成集成、测试和风险调整
```

如果遇到课堂汇报或提交节点，则提前一天提交轻量成果。轻量成果可以是代码、文档、截图、测试日志或可运行包，但必须能说明本周推进了什么。

## 4. PR 提交要求

每个 PR 必须包含：

1. 本次完成内容；
2. 如何运行或验证；
3. 截图、日志或测试结果；
4. 是否影响公共接口；
5. 是否为 mock / 草案 / 正式实现；
6. 未完成风险和后续依赖。

建议 PR 模板：

```markdown
## 本次完成

## 验证方式

## 截图 / 日志

## 影响模块

## 未完成 / 风险
```

## 5. Week 1：5.22-5.29 项目调整 + 技术定型 + mock 原型

### 本周目标

完成老师反馈后的计划调整、技术栈确定、项目骨架、GitHub 协作规则和可展示 mock 原型。

### 已完成交付

| 模块 | 已完成内容 |
| --- | --- |
| 项目管理 | GitHub 仓库、成员邀请、Issue / PR 规则、任务文档、AGENTS 初版 |
| 技术栈 | Electron + React + TypeScript + Vite + SQLite + OpenAI-compatible API |
| 项目骨架 | Electron / React / Vite 项目可启动 |
| Reader UI | 三栏 mock 阅读器原型、文章列表、阅读区、AI 功能入口 |
| 数据模型 | Feed、Article、Content、AITaskRun、LLMUsageEvent 等草案 |
| Feed / Sync | Feed Parser、Sync 流程、测试 Feed 初步完成 |
| Reader Pipeline | sourceHtml -> cleanedHtml -> canonicalMarkdown 流程草案 |
| AI 小组 | Runtime、Provider、Summary、Translation、Usage、Export 初步接口草案 |

### Week 1 验收结果

```text
项目可以启动
main 有可运行骨架
页面可以展示 mock 阅读器
GitHub 已形成 Issues / PR / 分支协作记录
后续模块有公共接口约束
```

## 6. Week 2：5.29-6.3 真实 Feed 主链路 + 前端接入 + 打包

### 本周目标

让真实文章进入系统，并在前端页面中展示出来；同时完成可直接运行的 Windows 打包版本。

### 已完成交付

| 模块 | 已完成内容 |
| --- | --- |
| Feed Parser | 支持真实 RSS / Atom Feed 解析 |
| OPML / Subscription | 已有 OPML 解析和内存订阅源管理代码 |
| Sync | 已有 `syncAll()`，可同步真实 Feed |
| Storage | SQLite stores 和 Week2StorageAdapter 已有测试 |
| Reader UI | 前端可通过 Add Feed / Sync 触发真实同步，并展示同步后的 Feed、文章列表和正文 |
| Electron IPC | 前端通过 `window.mercury.runWeek2Sync()` 调用主进程同步逻辑 |
| Export | 当前文章可执行基础 Markdown 下载 |
| 打包 | 已配置 electron-builder，可生成 Windows zip |
| 测试 | `npm test`、`npm run smoke:week2`、`npm run build`、`npm run pack:win:zip` 通过 |

### Week 2 验收结果

```text
点击 Add Feed / Sync 可以触发真实 Feed 同步
真实文章可以显示在文章列表
点击文章可以显示正文内容
Windows 打包版本可以生成
```

### Week 2 当前限制

```text
前端同步结果目前保存在内存 MockStoragePort 中
SQLite 还没有正式接入前端同步流程
OPML 导入尚未做成完整前端入口
AI 功能区仍以 mock / 入口展示 / 基础代码为主
```

## 7. Week 3：6.3-6.10 主链路收尾 + AI 功能 + Export + Usage 一周集成完成

### 本周目标

本周是最后一个功能开发周。主链路、AI 功能和导出功能必须在本周完成 MVP 集成。Week 3 结束后，不再新增大功能。

### 本周必须完成

| 模块 | Week 3 必须完成 |
| --- | --- |
| T0 组长 / 测试验收 | 持续审查 main；组织 Week 3 集成测试；更新排期、README、运行说明和验收记录 |
| T1 项目骨架 | 检查启动、构建、打包命令是否稳定；协助处理跨平台启动问题 |
| T2 数据模型 / 本地存储 | SQLite 正式接入前端同步链路；保证 feeds / articles / contents 可持久化读取 |
| T3 Feed Parser | 修复真实 Feed 解析中发现的问题；稳定输出 `Week2ParsedFeed` |
| T4 OPML / 订阅源管理 | 完成 OPML 导入入口或最小可调用接口；输出 active subscriptions |
| T5 Sync | Sync 改为可调用 T2 StoragePort；同步状态、失败提示、去重逻辑稳定 |
| T6 Reader Pipeline | 至少提供可用 pipeline：`sourceHtml -> cleanedHtml -> canonicalMarkdown` |
| T7 Reader UI | 前端读取真实 ReaderDataPort / IPC 数据；完善 Add Feed / Sync / 文章列表 / 阅读区；补空状态和错误状态 |
| T8 Agent Runtime | Runtime、Prompt loader、状态机可被 Summary / Translation 调用 |
| T9 Provider / Usage | Provider 配置、Mock Provider、至少一个 OpenAI-compatible Provider 调用可用；Usage 记录可生成 |
| T10 Summary | Summary 接入 Runtime / Provider；能基于当前文章 canonicalMarkdown 生成并展示摘要 |
| T11 Translation / Export | Translation 接入 Runtime / Provider；单篇 Markdown Export 可用并能从阅读页触发 |

### Week 3 最低验收标准

```text
真实 Feed 可以添加或同步
文章进入 SQLite 或统一 StoragePort
前端可以读取真实文章列表和正文
Reader Pipeline 可以产出 canonicalMarkdown
Summary 可以基于当前文章生成结果
Translation 可以基于当前文章生成结果
Usage 可以记录至少 mock / provider 调用
Export 可以导出当前文章 Markdown
npm test 通过
npm run smoke:week2 通过
npm run build 通过
npm run pack:win:zip 通过
Windows 打包版本可打开
```

### Week 3 范围控制

本周只做 MVP，不做以下扩展：

- 不做多篇文章批量导出；
- 不做复杂账单系统；
- 不做云端同步；
- 不做账号登录；
- 不做复杂订阅源分组管理；
- 不强制所有真实模型都调通，但至少保留 OpenAI-compatible 配置和 mock fallback；
- 不追求完整生产级正文清洗，只要求 pipeline 输出稳定字段。

## 8. Week 4：6.10-6.17 最终验收 + 修复 + 文档 + 打包 + 提交

### 本周目标

Week 4 是最终收口周，不再新增功能。只做测试、修复、文档、截图、打包和提交。

### 本周必须完成

| 模块 | Week 4 必须完成 |
| --- | --- |
| T0 组长 / 测试验收 | 最终测试、最终 README、运行说明、打包说明、提交材料、截图和演示流程 |
| T1 项目骨架 | 检查启动命令、构建命令、打包命令是否可用 |
| T2 数据模型 | 确认数据库初始化、迁移、示例数据和持久化读取稳定 |
| T3 Feed Parser | 提供最终测试 Feed 列表和解析说明 |
| T4 OPML / 订阅源管理 | 提供 OPML 示例和导入说明 |
| T5 Sync | 修复同步失败、重复文章、空 Feed 等问题 |
| T6 Reader Pipeline | 提供内容清洗说明和测试样例 |
| T7 Reader UI | UI 打磨、空状态、错误状态、截图、交互审查 |
| T8 Agent Runtime | Runtime / Prompt 文档收口 |
| T9 Provider / Usage | Provider 配置说明、API key 脱敏检查、Usage 验收 |
| T10 Summary | Summary 功能说明和验收样例 |
| T11 Translation / Export | Translation / Export 功能说明和验收样例 |

### Week 4 最终验收标准

```text
老师可以直接下载或打开打包版本
不需要 git clone / npm install / npm run dev 才能看产品
README 能说明项目目标、技术栈、运行方式、分工和已知限制
主链路 demo 可以跑通
AI MVP 可以演示或说明 mock / provider fallback
API key 没有提交到仓库
npm test 通过
npm run smoke:week2 通过
npm run build 通过
npm run pack:win:zip 通过
Windows 打包版本通过测试
GitHub main 保持可运行
```

## 9. 关键路径与风险

四周版关键路径如下：

```text
Week 1：T1 / T2 / T8 / T9 定技术和接口
Week 2：T3 / T4 / T5 / T7 打通真实 Feed 到前端展示
Week 3：T2 / T5 / T6 / T8 / T9 / T10 / T11 完成全部功能 MVP 集成
Week 4：T0 统一测试、修复、文档、截图、打包和最终提交
```

当前关键风险：

| 风险 | 影响 | 处理方式 |
| --- | --- | --- |
| `origin/feature/T2-storage-sync` 旧分支直接合并会删除 main 大量文件 | 严重破坏 main | 不直接合并，关闭旧 PR 或删除旧分支，只保留已进入 main 的有效 T2 成果 |
| SQLite 未接入前端真实同步 | 当前前端真实链路只能演示内存数据 | Week 3 优先接入 T2 StoragePort |
| Reader Pipeline 仍是 mock | AI 输入质量不稳定 | Week 3 至少输出稳定 canonicalMarkdown |
| Summary / Translation 尚未完整接入前端点击流程 | AI 功能只能展示入口或基础代码 | Week 3 接入 Runtime + Provider mock fallback |
| OPML 前端入口未完成 | 无法完整演示 OPML 导入 | Week 3 做最小入口或可调用演示 |
| 打包产物未通过跨机器充分测试 | 老师可能打不开 | Week 4 固定打包版本，并在 Windows / macOS 至少各测一次 |

## 10. 最终交付物

最终需要提交：

- GitHub 仓库链接；
- Windows 可直接运行 zip 或 Release；
- README；
- 运行说明；
- 测试记录；
- 成员分工说明；
- 主要功能截图；
- 已知限制说明；
- API key 脱敏说明；
- 最终演示流程。

## 11. 给成员的统一提醒

每位成员后续修改必须遵守：

1. 先阅读 `AGENTS.md`；
2. 基于最新 main 重整分支；
3. 不删除 main 中已有文件；
4. 不新增平行目录；
5. 公共字段、状态、Provider、Usage、Prompt 输入以 `AGENTS.md` 为准；
6. PR 里必须写清楚如何验证；
7. Week 3 结束后不再新增功能，只允许修复和收口。
