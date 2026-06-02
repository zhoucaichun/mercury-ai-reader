# T10 Summary Agent Design

负责人：宋金淼
任务编号：T10 Summary Agent
提交范围：Week 1 设计文档与 Week 2 接口对齐说明，不是最终代码实现

## 1. 本次交付说明

本文件按照最新 `AGENTS.md`、《各组员对齐要求.docx》以及当前 GitHub Issues 中的 T6 / T8 / T9 对齐信息整理。Summary Agent 本周不阻塞 Week 2 的 Feed / OPML / Sync / 本地存储 / 文章列表主链路，但必须提前对齐 `canonicalMarkdown`、Agent Runtime、Provider 和 Usage 接口，方便后续接入阅读页。

本次文档覆盖：

- Summary Agent 的输入结构；
- Summary Agent 的输出结构；
- `SummaryResult` 保存方式；
- Summary Prompt 参数；
- `summary.default.yaml` 模板草案；
- Mock Summary 流程；
- 与 T8 Runtime 的对接方式；
- 与 T9 Provider 的对接方式；
- usage record / usage event 生成方式；
- 可展示的 Mock 摘要样例；
- 简易摘要区域原型；
- 本周验证方式；
- 对 T2 / T6 / T7 / T8 / T9 的依赖和协作需求。

关键约定：

- Summary Agent 统一使用 T6 输出的 `canonicalMarkdown`，不单独处理原始 HTML；
- Summary / Translation 不直接调用具体模型 API，必须通过统一 Provider；
- Prompt 不硬编码在业务函数内部，使用独立模板；
- `SummaryResult`、`AgentTaskRun`、`LLMUsageEvent` 最终字段以 T2 数据模型和 AGENTS 公共契约为准。

## 2. Summary Agent 输入结构

Summary Agent 接收阅读器当前文章、文章内容和用户选择的摘要参数。核心输入建议如下：

```ts
export type SummaryDetailLevel = 'brief' | 'standard';
export type SummaryTargetLanguage = 'zh-CN' | 'en-US';

export interface SummaryRequest {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl?: string;
  canonicalMarkdown: string;
  targetLanguage: SummaryTargetLanguage;
  detailLevel: SummaryDetailLevel;
  regenerate?: boolean;
  metadata?: Record<string, unknown>;
}
```

字段说明：

| 字段 | 说明 | 来源 |
| --- | --- | --- |
| `articleId` | 当前文章唯一标识 | T2 / T7 |
| `contentId` | 当前文章内容记录标识，可选 | T2 / T6 |
| `title` | 文章标题 | Article |
| `sourceUrl` | 原文链接，可选 | Article |
| `canonicalMarkdown` | 清洗后的标准 Markdown 正文 | T6 Reader Pipeline / T2 ArticleContent |
| `targetLanguage` | 摘要输出语言 | 用户设置或默认值 |
| `detailLevel` | 摘要详细程度 | 用户选择 |
| `regenerate` | 是否重新生成摘要 | 用户操作 |
| `metadata` | 调试、UI 或调用上下文扩展字段 | T8 Runtime 可透传 |

MVP 先支持两种摘要详细程度：

- `brief`：一句总述加 3 条关键要点，适合快速浏览；
- `standard`：摘要、关键要点、阅读价值，适合阅读页展示。

## 3. Summary Agent 输出结构

Summary Agent 输出 Markdown 摘要，并附带 Provider / model / usage 信息供保存和展示。

```ts
export interface SummaryOutput {
  markdown: string;
  targetLanguage: SummaryTargetLanguage;
  detailLevel: SummaryDetailLevel;
  providerId: string;
  providerName: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimated?: boolean;
  };
}
```

输出 Markdown 建议结构：

```markdown
## 摘要
用 1 段话概括文章核心内容。

### 关键要点
- 要点 1
- 要点 2
- 要点 3

### 阅读价值
说明这篇文章适合什么场景下阅读，或读者能获得什么信息。
```

## 4. SummaryResult 保存方式

摘要结果建议保存为 `SummaryResult`。字段最终需要和 T2 数据模型对齐；若数据库内部字段名不同，需要在 T2 文档中说明映射关系。

```ts
export interface SummaryResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskRunId: string;
  targetLanguage: SummaryTargetLanguage;
  detailLevel: SummaryDetailLevel;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}
```

保存策略草案：

- 同一篇文章可以保存不同语言、不同详细程度的摘要；
- `regenerate = true` 时生成新的摘要结果，是否覆盖旧结果由 T2 存储策略最终确定；
- 阅读页默认读取当前文章最近一次成功生成的摘要；
- 清除摘要只影响摘要结果，不影响文章正文和 `canonicalMarkdown`；
- 保存时关联 `taskRunId`，用于追踪 Agent 任务运行状态；
- 每次模型请求另行生成 `LLMUsageEvent`，不与 `SummaryResult` 混用。

## 5. Summary Prompt 参数

Summary Agent 不在业务函数中硬编码 Prompt，而是通过 T8 Prompt Templates 机制加载 `resources/prompts/summary.default.yaml`。

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

Week 2 阶段 Summary 可继续使用 Mock Provider，不要求真实模型完整接入。

```text
用户在阅读页点击“生成摘要”
        ↓
T7 阅读页把当前文章信息传给 Summary Agent
        ↓
Summary Agent 接收 Article + canonicalMarkdown
        ↓
Summary Agent 组装 SummaryRequest 和 Prompt 参数
        ↓
调用 T8 Runtime，任务状态进入 queued / running
        ↓
T8 Runtime 加载 summary.default.yaml 并渲染 Prompt
        ↓
T8 Runtime 调用 T9 Mock Provider：provider.chat(request)
        ↓
Mock Provider 返回 response.content 和模拟 usage
        ↓
T8 Runtime 返回 succeeded，并生成 usage event
        ↓
Summary Agent 保存 SummaryResult
        ↓
T7 阅读页展示摘要区域
```

## 8. 与 T8 Runtime 的对接方式

Summary Agent 不重复实现 Agent 状态机，统一接入 T8 Runtime。

Runtime / UI 可使用完整状态：

```text
idle / queued / running / succeeded / failed / cancelled
```

数据库中的 `AgentTaskRun` 建议只存：

```text
queued / running / succeeded / failed / cancelled
```

说明：

- `idle` 表示当前没有任务或任务尚未开始，通常不需要入库；
- `cancelled` 属于 AgentTaskRun 状态；
- timeout 不作为单独状态，统一记录为 `status = failed`，并使用 `errorCode = "timeout"`；
- Summary、Translation、Usage、Reader UI 必须使用同一套状态口径。

建议 `runAgent()` 调用草案：

```ts
export interface AgentRunInput<TInput> {
  agentType: 'summary' | 'translation';
  templateId: string;
  input: TInput;
  providerId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunResult<TOutput> {
  taskRunId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output?: TOutput;
  errorCode?: string;
  errorMessage?: string;
}

const result = await runtime.runAgent<SummaryRequest, SummaryOutput>({
  agentType: 'summary',
  templateId: 'summary.default',
  input: summaryRequest,
  metadata: {
    articleId: summaryRequest.articleId,
    purpose: 'summary'
  }
});
```

需要和 T8 继续对齐：

- `runAgent()` 的最终函数名和参数结构；
- Prompt 模板文件放置路径和加载方式；
- Runtime 是否直接负责保存 `AgentTaskRun` 和 `LLMUsageEvent`；
- 错误、取消、重试的 UI 反馈字段。

## 9. 与 T9 Provider 的对接方式

Summary Agent 不绑定具体模型服务，由 T8 Runtime 调用 T9 提供的统一 Provider。

按照最新 AGENTS，Provider 调用形式统一为：

```ts
export interface LLMChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface LLMChatResponse {
  content: string;
  providerId: string;
  providerName: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimated?: boolean;
  };
  requestId?: string;
}

export interface LLMProvider {
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;
}
```

Week 2 可先使用 Mock Provider：

```text
输入：Mock article canonicalMarkdown
调用：provider.chat(request)
输出：response.content = 固定 Markdown 摘要
usage：promptTokens=120, completionTokens=80, totalTokens=200, estimated=true
```

需要和 T9 继续对齐：

- `providerId` / `providerName` / `model` 配置来源；
- `response.content` 的文本格式；
- provider 不返回 token usage 时的估算策略；
- 请求失败时的错误结构；
- 多模型测试时 provider name 和 model name 的展示格式。

## 10. usage record / usage event 生成方式

每次真实或 mock 模型调用都应形成 usage record / usage event，供后续 Usage 面板统计。

按照最新 AGENTS，建议 `LLMUsageEvent` 字段如下：

```ts
export interface SummaryLLMUsageEvent {
  id: string;
  taskRunId: string;
  purpose: 'summary';
  articleId: string;
  providerId: string;
  providerName: string;
  model: string;
  status: 'succeeded' | 'failed';
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  startedAt?: string;
  finishedAt?: string;
  latencyMs?: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}
```

注意区分：

- `AgentTaskRun` 是 AI 任务运行状态，可包含 `queued / running / succeeded / failed / cancelled`；
- `LLMUsageEvent` 是一次模型请求记录，只记录 `succeeded / failed`；
- `cancelled` 不放进 `LLMUsageEvent.status`；
- `timeout` 统一记录为 `status = failed`，可通过 `errorMessage` 或 T8 的 `errorCode = "timeout"` 标识；
- API key 等敏感信息不进入 usage event。

生成时机草案：

1. Runtime 开始执行时创建 `AgentTaskRun`；
2. 调用 Provider 前记录 `startedAt`；
3. Provider 返回后读取 `response.usage` 和 `response.requestId`；
4. Runtime 或 Usage 模块写入 `LLMUsageEvent`；
5. Summary Agent 消费 `response.content` 并保存 `SummaryResult`。

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

Mock usage event：

```ts
const mockUsageEvent: SummaryLLMUsageEvent = {
  id: 'usage-summary-demo-001',
  taskRunId: 'task-summary-demo-001',
  purpose: 'summary',
  articleId: 'article-demo-001',
  providerId: 'mock',
  providerName: 'Mock Provider',
  model: 'mock-summary-v1',
  status: 'succeeded',
  promptTokens: 120,
  completionTokens: 80,
  totalTokens: 200,
  estimated: true,
  startedAt: '2026-06-02T12:00:00.000Z',
  finishedAt: '2026-06-02T12:00:01.200Z',
  latencyMs: 1200,
  requestId: 'mock-request-summary-001',
  metadata: {
    detailLevel: 'standard',
    targetLanguage: 'zh-CN'
  }
};
```

## 12. 简易摘要区域原型

```text
┌──────────────────────────────────────┐
│ Mercury：本地优先的 AI 阅读助手设计    │
│ [生成摘要] [重新生成] [复制] [清除]     │
├──────────────────────────────────────┤
│ 摘要语言：中文    详细程度：标准        │
│ 状态：succeeded                       │
├──────────────────────────────────────┤
│ AI 摘要                               │
│ Mercury 是一个以本地数据管理和 AI...  │
│                                      │
│ 关键要点                              │
│ - 支持 Feed 与正文清洗                 │
│ - canonicalMarkdown 作为统一输入       │
│ - 共用 Runtime 和 Provider             │
├──────────────────────────────────────┤
│ Mock Provider · mock-summary-v1       │
│ estimated tokens: 200 · latency 1.2s │
└──────────────────────────────────────┘
```

T7 负责阅读页按钮和摘要展示区域的实际 UI 接入。T10 只提供调用接口、结果结构和交互状态需求。

## 13. Week 2 说明

Week 2 主链路优先打通：

```text
Feed / OPML -> Sync -> Local Storage -> Article List
```

T10 本周不作为主链路阻塞项，但需要完成以下对齐：

- 输入继续统一使用 `canonicalMarkdown`；
- Provider 调用统一为 `provider.chat(request)` 和 `response.content`；
- Usage 字段统一为 `purpose / providerId / providerName / model / status / promptTokens / completionTokens / totalTokens / estimated / startedAt / finishedAt / latencyMs`；
- `cancelled` 只作为 AgentTaskRun 状态，不作为 LLMUsageEvent 状态；
- 阅读页入口和摘要展示区域后续由 T7 接入。

## 14. 本周验证方式

本次提交是设计文档和接口对齐说明，验证方式为检查文档是否覆盖 Week 1 / Week 2 对 T10 的交付要求。

检查项：

- 是否按 AGENTS 命名为 `docs/features/T10-summary-agent.md`；
- 是否明确 Summary Agent 输入结构；
- 是否明确 Summary Agent 输出结构；
- 是否说明 `SummaryResult` 保存方式；
- 是否提供 Summary Prompt 参数；
- 是否提供 `summary.default.yaml` 模板草案；
- 是否说明 Mock Summary 流程；
- 是否说明与 T8 Runtime 的对接方式；
- 是否说明与 T9 Provider 的对接方式；
- 是否说明 usage record / usage event 生成方式；
- 是否使用 `provider.chat()` 和 `response.content`；
- 是否使用 `estimated` 而不是 `isEstimated`；
- 是否把 `cancelled` 从 `LLMUsageEvent.status` 中移除；
- 是否提供 Mock 摘要样例和简易摘要区域原型；
- 是否说明对 T2 / T6 / T7 / T8 / T9 的依赖。

## 15. 依赖和协作需求

| 模块 | 需要对齐的内容 |
| --- | --- |
| T2 数据模型 / 本地存储 | `SummaryResult`、`AgentTaskRun`、`LLMUsageEvent` 字段和保存接口 |
| T6 Reader Pipeline | `canonicalMarkdown` 字段命名和输出稳定性 |
| T7 阅读器 UI | 摘要按钮、摘要区域、`idle / queued / running / succeeded / failed / cancelled` 状态展示 |
| T8 Agent Runtime / Prompt Templates | `runAgent()`、Agent 状态、Prompt 模板加载和渲染方式 |
| T9 LLM Provider / Usage | `provider.chat()`、`response.content`、Provider 返回结构和 usage 字段 |

## 16. 当前风险和后续计划

当前风险：

- 当前接口仍是草案，T2 / T8 / T9 定稿后需要同步更新；
- Week 2 不接入真实模型，不保证真实模型摘要质量；
- 摘要缓存、重新生成和清除策略需要和 T2 本地存储实现进一步对齐；
- T7 阅读页入口尚未联调，当前只提供交互需求和展示原型。

后续计划：

- Week 2 保持文档和接口草案对齐，等待主链路输出真实 `Week2ArticleContent.canonicalMarkdown`；
- Week 3 接入 T8 Runtime 和 T9 Provider 的真实或可配置模型调用；
- Week 3-4 持续产出 usage event，并配合 Usage 面板展示；
- 与 T7 联调阅读页摘要入口和展示区域。
