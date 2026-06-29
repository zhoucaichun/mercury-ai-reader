# T3 Week 5 计划：Feed 解析稳定性与最终验收

## 1. 周计划对应要求

根据项目集成计划，最终验收阶段 Feed Parser 模块的交付要求是：

```text
Feed 解析稳定，提供测试 Feed 列表
```

第 5 周项目进入功能冻结、测试、文档和演示阶段。T3 本周不再新增大功能，重点是确保 Feed 解析模块稳定、可验证、可说明，并为最终 demo 提供测试 Feed。

## 2. 本周计划内容

本周计划围绕最终验收完成以下内容：

- 固化 T3 对外接口；
- 保留本地测试 fixture；
- 保留真实 Feed smoke 脚本；
- 提供默认测试 Feed 列表；
- 在 README 中记录 T3 验证命令；
- 在功能文档中记录接口、错误码和标准输出；
- 按周整理 T3 汇报文档；
- 检查没有提交 `node_modules`、本地配置、API Key 或无关临时文件。

## 3. 最终测试 Feed 列表

T3 推荐最终演示或验收使用以下 Feed：

| Feed | 类型 | 用途 |
| --- | --- | --- |
| `https://hnrss.org/frontpage` | RSS | 验证常见 RSS 文章列表 |
| `https://xkcd.com/atom.xml` | Atom | 验证 Atom Feed |
| `https://www.theverge.com/rss/index.xml` | Atom | 验证真实媒体 Feed |

运行命令：

```bash
npm run smoke:feed
```

自定义测试：

```bash
npm run smoke:feed -- https://example.com/rss.xml
```

## 4. 最终验收命令

T3 的最终验收可以使用以下命令：

```bash
npm install
npm run typecheck
npm test
npm run build
npm run smoke:feed
```

预期结果：

```text
typecheck 通过
test 通过
build 通过
smoke:feed 至少 2-3 个真实 Feed 解析成功
```

## 5. 最终交付文件

T3 相关交付文件如下：

| 文件 | 作用 |
| --- | --- |
| `src/features/feed/parser/index.ts` | T3 统一导出入口 |
| `src/features/feed/parser/addFeed.ts` | Feed URL 添加和远程解析入口 |
| `src/features/feed/parser/fetchFeed.ts` | Feed 网络请求和错误处理 |
| `src/features/feed/parser/parser.ts` | RSS / Atom / JSON Feed 解析与标准化 |
| `src/features/feed/parser/types.ts` | 标准类型定义 |
| `src/features/feed/parser/errors.ts` | Feed 错误类型 |
| `src/features/feed/parser/utils.ts` | URL、日期、文本和 ID 工具 |
| `test/feed.parser.test.ts` | 单元测试 |
| `test/fixtures/rss-feed.xml` | RSS 测试样例 |
| `test/fixtures/atom-feed.xml` | Atom 测试样例 |
| `test/fixtures/json-feed.json` | JSON Feed 测试样例 |
| `scripts/smoke-feed.ts` | 真实 Feed 验证脚本 |
| `docs/features/T3-feed-parser.md` | T3 功能说明 |
| `docs/reports/T3-week1-feed-parser-report.md` | Week 1 汇报 |
| `docs/reports/T3-week2-feed-parser-report.md` | Week 2 汇报 |
| `docs/reports/T3-week3-feed-parser-maintenance-report.md` | Week 3 汇报 |
| `docs/reports/T3-week4-feed-integration-support-report.md` | Week 4 汇报 |
| `docs/reports/T3-week5-feed-final-validation-report.md` | Week 5 汇报 |

## 6. 平台中立检查

T3 实现符合平台中立要求：

- 不写死 Windows / Linux / macOS 专属路径；
- 测试路径使用 Node.js `node:path`；
- 使用 npm scripts 作为统一命令；
- 网络请求使用 Node.js 生态库；
- 不提交 API Key；
- 不提交 `node_modules`；
- 不提交本地 `.env` 配置。

## 7. 协作与 PR 说明

T3 已按协作要求使用独立分支：

```text
feature/T3-feed-parser
```

PR 描述中建议包含：

- 本周完成内容；
- 验证方式；
- smoke 测试日志；
- 影响模块；
- 未完成 / 风险；
- 对应 Issue，例如 `Closes #issue编号`。

## 8. 最终验收目标

Week 5 的 T3 验收目标是：

- Feed 解析模块稳定；
- 提供测试 Feed 列表；
- 提供本地测试和真实 Feed smoke 测试；
- 完成接口和功能文档；
- 按周整理汇报材料；
- 进入 PR 审核和主分支集成阶段。

T3 当前不计划新增主功能。后续如果 T2 / T4 / T5 / T6 集成时发现字段映射问题，只做小范围兼容修复。
