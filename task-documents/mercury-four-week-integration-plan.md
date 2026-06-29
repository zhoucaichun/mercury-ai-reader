# Prism Reader 四周集成计划与验收记录

本文档记录 Prism Reader 的四周集成节奏、阶段成果和最终验收范围。

## 1. 集成策略

项目按照四周节奏推进：

```text
Week 1：项目骨架、技术栈、接口契约和阅读器原型
Week 2：真实 Feed / OPML / Sync / 本地存储 / 文章列表主链路
Week 3：AI 摘要、翻译、Usage、Export 和阅读器交互集成
Week 4：最终测试、问题修复、文档整理、打包和 Release
```

集成原则：

- `main` 分支保持可构建、可测试、可打包；
- 公共接口以 `AGENTS.md` 为准；
- 成员产出需要在代码、文档、测试或报告中留痕；
- 最终提交必须包含可直接运行的桌面端打包版本；
- 不提交真实 API Key、个人路径、内部草稿、`.docx` 或系统临时文件。

## 2. Week 1：项目骨架与接口草案

阶段目标：

- 确定技术栈；
- 建立 Electron / React / TypeScript / Vite 项目骨架；
- 明确模块目录和公共数据结构；
- 准备阅读器 UI 原型；
- 形成各模块设计文档。

完成成果：

- 项目骨架：`package.json`、`electron/`、`src/app/`、`src/main.tsx`；
- 公共约束：`AGENTS.md`；
- 数据模型文档：`docs/features/T2-data-model.md`；
- Feed Parser 文档：`docs/features/T3-feed-parser.md`；
- Reader Pipeline 文档：`docs/features/T6-reader-pipeline.md`；
- Reader UI 原型与审查清单：`docs/features/T7-*`；
- Agent Runtime、Provider、Summary、Translation / Export 文档：`docs/features/T8-*` 至 `docs/features/T11-*`。

## 3. Week 2：真实 Feed 主链路

阶段目标：

- 解析真实 RSS / Atom Feed；
- 支持 OPML 解析和订阅源管理；
- 将真实文章同步到本地存储契约；
- 将 Feed 和 Article 数据展示到阅读器页面；
- 提供主链路 smoke 测试。

完成成果：

- Feed Parser：`src/features/feed/parser/`；
- OPML：`src/features/feed/opml/`；
- Subscription：`src/features/feed/subscriptions/`；
- Sync：`src/features/feed/sync/`；
- 本地数据库：`src/core/database/`；
- Electron 主链路 IPC：`electron/week2-sync.ts`；
- OPML 测试文件：`test-opml/`；
- 主链路验证命令：`npm run smoke:week2`。

验证内容：

- 能同步真实 Feed；
- 能写入 feed / article / article content；
- 能读取非空正文；
- 重复同步不会产生重复 feed 或重复文章。

## 4. Week 3：AI、Export、Usage 与阅读器集成

阶段目标：

- 摘要和翻译接入阅读器页面；
- 支持 OpenAI-compatible Provider 配置；
- 支持多个模型配置保存和切换；
- 摘要和翻译可分别选择默认模型；
- 记录 usage event；
- 当前文章可导出 Markdown；
- 改善阅读器交互状态和产品体验。

完成成果：

- Agent Runtime：`src/features/agent/runtime/`；
- Prompt：`src/features/agent/prompts/` 和 `resources/prompts/`；
- Provider：`src/features/agent/providers/`；
- Summary：`src/features/agent/summary/`；
- Translation：`src/features/agent/translation/`；
- Usage：`src/features/usage/`；
- Export：`src/features/export/`；
- Reader UI：`src/features/reader/ReaderApp.tsx`；
- AI IPC：`electron/week3-ai.ts`；
- API Key 安全存储：`electron/secure-provider-store.ts`。

交互与产品化成果：

- 已读 / 未读 / 收藏状态；
- 标签、笔记、高亮、下划线；
- 阅读进度；
- 摘要和译文历史保留；
- streaming 生成反馈；
- 设置中查看、切换、删除模型配置；
- Usage 面板展示调用记录和统计。

## 5. Week 4：最终验证与 Release

阶段目标：

- 清理仓库文档；
- 检查每位成员的代码和文档留痕；
- 修复最终测试中发现的问题；
- 构建并上传 Windows Release；
- 保持 README、技术栈、集成计划和公共约束文档可供老师直接查看。

完成成果：

- 中文 README；
- 中文 `AGENTS.md`；
- 中文技术栈说明；
- 中文四周集成计划；
- 删除内部任务草稿；
- `.gitignore` 防止 `.docx`、`.DS_Store` 和本地草稿误提交；
- Windows Release 上传到 GitHub。

最终验证命令：

```bash
npm test
npm run build
npm run smoke:week2
npm run pack:win:zip
```

Release 地址：

```text
https://github.com/zhoucaichun/mercury-ai-reader/releases/tag/v0.1.0-prism-reader
```

## 6. 最终仓库应展示的内容

最终仓库应包含：

- 可运行的桌面应用源码；
- 可直接下载运行的 Windows Release 包；
- 中文 README；
- 公共开发约束和接口文档 `AGENTS.md`；
- 模块功能文档 `docs/features/`；
- 阶段报告 `docs/reports/`；
- 正式技术栈和集成计划 `task-documents/`；
- OPML 测试文件 `test-opml/`；
- 单元测试、smoke 测试和打包脚本；
- 无真实 API Key、个人路径、内部草稿或系统临时文件。

## 7. 当前已知限制

- 当前公开 Release 主要提供 Windows x64 zip 包；
- macOS / Linux 已预留构建配置，但公开 Release 暂未提供对应安装包；
- AI 功能需要用户自行配置 OpenAI-compatible 模型服务；
- 不提供云同步、账号系统或多设备同步；
- 正文清洗是课程项目级实现，复杂网页可能仍有清洗不完美的情况。
