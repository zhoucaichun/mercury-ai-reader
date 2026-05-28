# T10 Summary Agent Week 1 Design

负责人：宋金淼
任务编号：T10 Summary Agent
提交范围：Week 1 设计文档，不是最终代码实现

## 1. 本周交付目标

本周先完成 Summary Agent 的轻量设计文档，方便 AI 功能小组并行对齐。当前接口均为草案，后续需要继续和 T2 / T6 / T7 / T8 / T9 的实现保持一致。

本设计覆盖：

- Summary Agent 的输入结构；
- Summary Agent 的输出结构；
- `SummaryResult` 保存方式；
- Summary Prompt 参数；
- `summary.default.yaml` 模板草案；
- Mock Summary 流程；
- 与 T8 Runtime 的对接方式；
- 与 T9 Provider 的对接方式；
- usage record 生成方式；
- 可展示的 Mock 摘要样例；
- 简易摘要区域原型；
- 本周验证方式；
- 对 T2 / T6 / T7 / T8 / T9 的依赖和协作需求。

特别约定：Summary Agent 后续统一使用 T6 输出的 `canonicalMarkdown`，不单独处理原始 HTML。

## 2. Summary Agent 输入结构

Summary Agent 接收阅读器当前文章和清洗后的 Markdown 内容，核心输入建议如下：

```ts
type SummaryDetailLevel = 'brief' | 'standard';
type SummaryTargetLanguage = 'zh-CN' | 'en-US';

interface SummaryRequest {
  articleId: string;
  contentId: string;
  title: string;
  sourceUrl?: string;
  canonicalMarkdown: string;
  targetLanguage: SummaryTargetLanguage;
  detailLevel: SummaryDetailLevel;
  regenerate?: boolean;
}
```

字段说明：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `articleId` | 当前文章唯一标识 | T2 / Reader |
| `contentId` | 当前内容记录唯一标识 | T2 / T6 |
| `title` | 文章标题 | Article |
| `sourceUrl` | 原文链接，可选 | Article |
| `canonicalMarkdown` | 清洗后的 Markdown 正文 | T6 Reader Pipeline |
| `targetLanguage` | 摘要输出语言 | 用户设置或默认值 |
| `detailLevel` | 摘要详细程度 | 用户选择 |
| `regenerate` | 是否重新生成摘要 | 用户操作 |

MVP 中先支持两种摘要详细程度：

- `brief`：一句总述加 3 条要点，适合快速浏览；
- `standard`：概述、关键要点、阅读价值，适合阅读页展示。

## 3. Summary Agent 输出结构

Summary Agent 输出稳定的 Markdown 内容，方便阅读页展示、复制和后续 Markdown 导出。

```ts
interface SummaryOutput {
  markdown: string;
  targetLanguage: SummaryTargetLanguage;
  detailLevel: SummaryDetailLevel;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimated?: boolean;
  };
}
```

建议输出 Markdown 结构：

```markdown
## 摘要
本文介绍了本地优先 AI 阅读助手的核心设计思路。

### 关键要点
- 通过 Feed 获取文章内容；
- 使用 canonical Markdown 作为 AI 标准输入；
- Summary 与 Translation 共用 Agent Runtime 和 LLM Provider。

### 阅读价值
适合了解该项目的数据流与 AI 功能协作方式。
```

## 4. SummaryResult 保存方式

摘要结果建议保存为 `SummaryResult`。字段最终需要和 T2 的数据模型对齐。

```ts
interface SummaryResult {
  id: string;
  articleId: string;
  contentId: string;
  taskRunId: string;
  targetLanguage: SummaryTargetLanguage;
  detailLevel: SummaryDetailLevel;
  markdown: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}
```

保存策略：

- 同一篇文章可以保存不同语言、不同详细程度的摘要；
- `regenerate = true` 时生成新的摘要结果，是否覆盖旧结果由 T2 存储策略最终确定；
- 阅读页默认读取当前文章最近一次成功生成的摘要；
- 清除摘要时只清除摘要结果，不影响文章正文和 `canonicalMarkdown`；
- 保存时关联 `taskRunId`，方便追踪本次 Agent 调用状态和 usage record。

## 5. Summary Prompt 参数

Summary Agent 不直接在业务函数中硬编码 Prompt，而是通过 T8 的 Prompt Template 机制加载 `summary.default.yaml`。

建议 Prompt 参数：

| 参数 | 用途 |
| --- | --- |
| `title` | 帮助模型识别文章主题 |
| `sourceUrl` | 可选，保留来源上下文 |
| `canonicalMarkdown` | 摘要正文输入 |
| `targetLanguage` | 指定输出语言 |
| `detailLevel` | 控制摘要长度和结构 |
| `maxKeyPoints` | 控制关键要点数量，默认 3 |
| `outputFormat` | 固定 Markdown 输出结构 |

## 6. summary.default.yaml 模板草案

```yaml
id: summary.default
agentType: summary
version: 1
description: Default prompt template for Mercury Summary Agent.
input:
  - title
  - sourceUrl
  - canonicalMarkdown
  - targetLanguage
  - detailLevel
  - maxKeyPoints
system: |
  你是 Mercury 的文章摘要助手。
  请仅依据提供的文章内容生成摘要，不补充文章中没有出现的信息。
  输出必须使用 Markdown，语言为 {{targetLanguage}}。
user: |
  标题：{{title}}
  原文链接：{{sourceUrl}}
  摘要详细程度：{{detailLevel}}
  最大要点数量：{{maxKeyPoints}}

  请按以下结构输出：

  ## 摘要
  用 1 段话概括文章核心内容。

  ### 关键要点
  - 要点 1
  - 要点 2
  - 要点 3

  ### 阅读价值
  说明这篇文章适合什么场景下阅读，或读者能获得什么信息。

  文章内容：
  {{canonicalMarkdown}}
```

## 7. Mock Summary 流程

Week 1 先使用 Mock 流程验证设计，不要求真实 LLM 调用。

```text
用户在阅读页点击“生成摘要”
        ↓
T7 阅读页把当前文章信息传给 Summary Agent
        ↓
Summary Agent 接收 Article + canonicalMarkdown
        ↓
Summary Agent 组装 SummaryRequest 和 Prompt 参数
        ↓
调用 T8 Runtime：状态进入 running
        ↓
T8 Runtime 加载 summary.default.yaml 并渲染 Prompt
        ↓
T8 Runtime 调用 T9 Mock Provider
        ↓
Mock Provider 返回固定 Markdown 摘要和模拟 usage
        ↓
T8 Runtime 返回 succeeded，并生成 usage record
        ↓
Summary Agent 保存 SummaryResult
        ↓
T7 阅读页展示摘要区域
```

## 8. 与 T8 Runtime 的对接方式

Summary Agent 不重复实现 Agent 状态机，统一接入 T8 Runtime。

需要 T8 提供：

- Agent 状态：`idle / running / succeeded / failed / cancelled`；
- Prompt 模板加载方式；
- Prompt 参数渲染方式；
- `runAgent()` 或等价统一调用接口；
- 错误信息、重试、取消和清除的通用处理；
- usage record 的统一记录契约。

建议调用草案：

```ts
interface AgentRunInput<TInput> {
  agentType: 'summary' | 'translation';
  templateId: string;
  input: TInput;
}

interface AgentRunResult<TOutput> {
  taskRunId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output?: TOutput;
  errorMessage?: string;
}

const result = await runtime.runAgent<SummaryRequest, SummaryOutput>({
  agentType: 'summary',
  templateId: 'summary.default',
  input: summaryRequest
});
```

需要和 T8 对齐的待确认项：

- `runAgent()` 的最终函数名和参数结构；
- Agent 状态枚举命名；
- Prompt 模板文件放置路径；
- Runtime 是否直接负责保存 `AITaskRun` 和 usage record。

## 9. 与 T9 Provider 的对接方式

Summary Agent 不绑定具体模型服务，由 T8 Runtime 调用 T9 提供的统一 LLM Provider。

需要 T9 提供：

```ts
interface LLMProvider {
  complete(request: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
  }): Promise<{
    text: string;
    provider: string;
    model: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      estimated?: boolean;
    };
  }>;
}
```

Week 1 可先使用 `MockLLMProvider`：

```text
输入：Mock article Markdown
输出：固定 Markdown 摘要
usage：promptTokens=120, completionTokens=80, totalTokens=200, estimated=true
```

需要和 T9 对齐的待确认项：

- Provider 返回字段名；
- token usage 是否允许估算；
- provider / model 配置来源；
- 调用失败时的错误结构；
- 多模型测试时 provider name 和 model name 的展示格式。

## 10. usage record 生成方式

每次 Summary 调用都需要生成 usage record，供后续 T9 Usage 面板统计。

建议 usage record 草案：

```ts
interface SummaryUsageRecord {
  id: string;
  taskRunId: string;
  agentType: 'summary';
  articleId: string;
  provider: string;
  model: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  errorMessage?: string;
  createdAt: string;
}
```

生成时机：

- Runtime 开始执行时创建 `AITaskRun`；
- Provider 返回后读取 usage 字段；
- Runtime 或 Summary Agent 将 usage 转为 `LLMUsageEvent`；
- 成功、失败、取消都应该记录状态；
- API key 等敏感信息不进入 usage record。

最终字段名需要和 T2 的 `LLMUsageEvent` 以及 T8 / T9 的统一调用契约对齐。

## 11. 可展示的 Mock 摘要样例

输入文章标题：

```text
Mercury：本地优先的 AI 阅读助手设计
```

输入正文节选：

```markdown
Mercury 支持 Feed 阅读、正文清洗、文章摘要与翻译。
系统使用 canonical Markdown 作为 AI 功能的统一输入，并通过统一 Provider 调用模型。
```

Mock 输出：

```markdown
## 摘要
Mercury 是一个以本地数据管理和 AI 辅助阅读为核心的阅读工具。

### 关键要点
- 支持 Feed 阅读、正文清洗、摘要和翻译；
- canonical Markdown 作为 AI 功能统一输入；
- Summary 与 Translation 可复用统一模型调用能力。

### 阅读价值
该设计有助于减少模块耦合，并方便后续接入不同大模型服务。
```

## 12. 简易摘要区域原型

```text
┌──────────────────────────────────────┐
│ Mercury：本地优先的 AI 阅读助手设计    │
│ [生成摘要] [重新生成] [复制] [清除]     │
├──────────────────────────────────────┤
│ 摘要语言：中文    详细程度：标准        │
├──────────────────────────────────────┤
│ AI 摘要                               │
│ Mercury 是一个以本地数据管理和 AI...  │
│                                      │
│ 关键要点                              │
│ - 支持 Feed 与正文清洗                 │
│ - Markdown 作为统一输入                │
│ - 共用 Runtime 和 Provider             │
├──────────────────────────────────────┤
│ Mock Provider · mock-summary-v1       │
└──────────────────────────────────────┘
```

T7 负责阅读页按钮和摘要展示区域的实际 UI 接入，T10 只提供调用接口、结果结构和交互状态需求。

## 13. 本周验证方式

本次提交是 Week 1 设计文档，验证方式为检查文档是否覆盖本周交付要求。

检查项：

- 是否明确 Summary Agent 输入结构；
- 是否明确 Summary Agent 输出结构；
- 是否说明 `SummaryResult` 保存方式；
- 是否提供 Summary Prompt 参数；
- 是否提供 `summary.default.yaml` 模板草案；
- 是否说明 Mock Summary 流程；
- 是否说明与 T8 Runtime 的对接方式；
- 是否说明与 T9 Provider 的对接方式；
- 是否说明 usage record 生成方式；
- 是否提供 Mock 摘要样例；
- 是否提供简易摘要区域原型；
- 是否说明对 T2 / T6 / T7 / T8 / T9 的依赖。

## 14. 依赖和协作需求

| 模块 | 需要对齐的内容 |
| --- | --- |
| T2 数据模型 / 本地存储 | `SummaryResult`、`AITaskRun`、`LLMUsageEvent` 字段和保存接口 |
| T6 Reader Pipeline | `canonicalMarkdown` 字段命名和输出稳定性 |
| T7 阅读器 UI | 摘要按钮、摘要区域、loading / failed / succeeded 状态展示 |
| T8 Agent Runtime / Prompt Templates | `runAgent()`、Agent 状态、Prompt 模板加载和渲染方式 |
| T9 LLM Provider / Usage | Provider 返回结构、usage 字段、provider / model 命名 |

## 15. 当前风险和后续计划

当前风险：

- 接口仍是草案，T2 / T8 / T9 定稿后需要同步更新；
- Week 1 只做设计文档和 Mock 流程，不保证真实模型摘要效果；
- 摘要缓存、重新生成和清除策略需要和本地存储实现进一步对齐。

后续计划：

- Week 2 将 Summary Agent 输入改为接收真实 Article / Content 数据；
- Week 3 接入 T8 Runtime 和 T9 Provider 的真实或可配置模型调用；
- Week 3-4 持续产出 usage record，并配合 T9 Usage 面板展示；
- 与 T7 联调阅读页摘要入口和展示区域。
