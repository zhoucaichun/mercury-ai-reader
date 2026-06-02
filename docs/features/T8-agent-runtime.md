# T8 Agent Runtime / Prompt Templates

负责人：曾夏杨  
任务编号：T8  
提交范围：Week 1 设计文档整理 + Week 2 接口对齐基线，不是最终完整代码实现

## 1. 本模块负责什么

T8 负责 Mercury AI 功能的公共运行层，供 Summary Agent 和 Translation Agent 复用。

当前统一职责：

- Agent Runtime 的调用入口
- Agent 状态机
- Prompt Template 的加载与渲染
- Provider 调用适配层
- 错误、取消、重试、timeout 规则
- AgentTaskRun 与 LLMUsageEvent 的边界约定

T8 不负责：

- Feed / OPML / Sync / 本地存储主链路
- Summary 的业务规则细节
- Translation 的业务规则细节
- 具体某个模型服务的底层实现
- Usage 面板展示

Summary 和 Translation 都应该复用这套 Runtime，不各自重复实现状态机、Prompt 渲染和 Provider 调用逻辑。

## 2. 当前阶段目标

Week 1 已完成的重点是架构和契约草案。  
Week 2 的重点不是完整 AI 功能，而是按 `AGENTS.md` 把 Runtime / Prompt / Usage 接口统一下来，避免后续 T9 / T10 / T11 合并冲突。

本周目标：

- 对齐 Agent 状态命名
- 对齐 Prompt 输入为 `canonicalMarkdown`
- 对齐 Provider 调用为 `provider.chat()` / `response.content`
- 对齐 usage 字段为 `promptTokens / completionTokens / totalTokens / estimated`
- 明确 Runtime 对 T10 / T11 的统一输出结构

## 3. 推荐目录结构

按仓库 `AGENTS.md` 统一放置：

```text
docs/features/T8-agent-runtime.md

src/features/agent/runtime/
  types.ts
  runner.ts
  stateMachine.ts
  errors.ts

src/features/agent/prompts/
  loader.ts
  renderer.ts

resources/prompts/
  summary.default.yaml
  translation.default.yaml
```

Week 1 当前以文档为主；Week 2 可先提供 mock 实现或最小可运行骨架。

## 4. Agent 状态机规则

按 `AGENTS.md`，Runtime / UI 统一使用：

```text
idle / queued / running / succeeded / failed / cancelled
```

数据库中的 `AgentTaskRun` 建议只存：

```text
queued / running / succeeded / failed / cancelled
```

说明：

- `idle` 表示当前无任务或任务尚未进入执行，不强制入库
- `timeout` 不作为独立状态
- timeout 统一记为 `status = failed`，并附加 `errorCode = "timeout"`
- T7、T10、T11 的状态展示都应使用同一套口径

建议类型：

```ts
export type AgentStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PersistedAgentStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";
```

## 5. Runtime 输入输出契约

### 5.1 Agent 类型

```ts
export type AgentType = "summary" | "translation";
```

### 5.2 Runtime 输入

```ts
export interface AgentRunInput<TInput = Record<string, unknown>> {
  taskId: string;
  agentType: AgentType;
  templateId: string;
  input: TInput;
  providerId: string;
  providerName?: string;
  model: string;
  metadata?: Record<string, unknown>;
}
```

说明：

- `agentType` 供 Summary / Translation 区分调用路径
- `templateId` 对应 `summary.default`、`translation.default`
- `input` 为模板渲染所需变量集合
- `providerId / model` 由上层配置或 T9 provider 配置决定
- `metadata` 用于透传 `articleId`、`contentId`、`detailLevel`、`targetLanguage` 等信息

### 5.3 Runtime 输出

T8 不建议让 T10 / T11 直接依赖 T9 的原始响应结构，而是由 Runtime 做一层稳定适配。

```ts
export interface RuntimeLLMResult {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimated?: boolean;
  };
  raw?: unknown;
}

export interface AgentRunResult<TOutput = RuntimeLLMResult> {
  taskId: string;
  status: Extract<AgentStatus, "succeeded" | "failed" | "cancelled">;
  output?: TOutput;
  errorCode?: string;
  errorMessage?: string;
}
```

这样做的目的：

- T9 未来可继续优化 Provider 细节
- T10 / T11 只依赖 Runtime 稳定结果
- Runtime 可以统一处理 usage 缺失、字段兜底和错误映射

### 5.4 调用入口

```ts
export interface AgentRuntime {
  runAgent<TInput, TOutput = RuntimeLLMResult>(
    input: AgentRunInput<TInput>,
  ): Promise<AgentRunResult<TOutput>>;
}
```

最小调用示例：

```ts
const result = await runtime.runAgent({
  taskId: "task-summary-001",
  agentType: "summary",
  templateId: "summary.default",
  providerId: "mock-provider",
  model: "mock-model",
  input: {
    title: article.title,
    canonicalMarkdown: articleContent.canonicalMarkdown,
    targetLanguage: "zh-CN",
    detailLevel: "standard",
  },
  metadata: {
    articleId: article.id,
    contentId: articleContent.articleId,
  },
});
```

## 6. Prompt Template 规则

Prompt 不应硬编码在 Summary / Translation 业务函数内部，统一走模板文件。

推荐文件：

```text
resources/prompts/summary.default.yaml
resources/prompts/translation.default.yaml
```

统一要求：

- 明确 `agentType`
- 明确模板版本和描述
- 明确输入变量
- 支持 `system` / `user` 两段消息
- 输入正文统一使用 `canonicalMarkdown`

Summary 示例：

```yaml
id: summary.default
agentType: summary
version: 1
description: Default summary prompt for Mercury.
input:
  - title
  - sourceUrl
  - canonicalMarkdown
  - targetLanguage
  - detailLevel
system: |
  你是 Mercury 的文章摘要助手。
  请仅依据给定正文生成摘要，不补充原文没有的信息。
  输出必须使用 Markdown。
user: |
  标题：{{title}}
  原文链接：{{sourceUrl}}
  详细程度：{{detailLevel}}

  文章内容：
  {{canonicalMarkdown}}
```

Translation 示例：

```yaml
id: translation.default
agentType: translation
version: 1
description: Default translation prompt for Mercury.
input:
  - title
  - canonicalMarkdown
  - sourceLanguage
  - targetLanguage
system: |
  You are a professional translator.
  Preserve the original Markdown structure.
  Output only the translated text.
user: |
  Title: {{title}}
  Source language: {{sourceLanguage}}
  Target language: {{targetLanguage}}

  Article content:
  {{canonicalMarkdown}}
```

## 7. Provider 对接规则

按 `AGENTS.md` 和当前 T9 分支方向，T8 应以统一 Provider 接口为准：

```ts
provider.chat(request);
response.content;
```

T8 不再以早期草案中的 `provider.call()` 或 `complete()` 作为最终共享契约。

建议 T8 对接 T9 时按以下类型理解：

```ts
export interface LLMChatRequest {
  purpose: "summary" | "translation" | "connection-test" | "other";
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
  metadata?: Record<string, string | number | boolean | null>;
  signal?: AbortSignal;
}

export interface LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimated: boolean;
  };
  status: "succeeded";
  latencyMs: number;
  raw?: unknown;
}
```

T8 Runtime 内部建议做如下适配：

```ts
function toRuntimeResult(response: LLMChatResponse): RuntimeLLMResult {
  return {
    text: response.content,
    providerId: response.providerId,
    providerName: response.providerName,
    model: response.model,
    usage: response.usage,
    raw: response.raw,
  };
}
```

这也是本周 T8 需要重点确认的收口点：  
T9 对外是 `chat()` / `content`，T8 对 T10 / T11 提供稳定的 Runtime 结果对象。

## 8. Usage Record 规则

按 `AGENTS.md`，`LLMUsageEvent` 与 `AgentTaskRun` 必须明确区分。

### 8.1 AgentTaskRun

表示一次 Agent 任务运行状态，用于 Summary / Translation 的任务进度追踪。

关心字段：

- `taskId`
- `agentType`
- `status`
- `startedAt`
- `finishedAt`
- `errorCode`
- `errorMessage`

### 8.2 LLMUsageEvent

表示一次模型请求记录，用于 T9 Usage 面板和后续统计。

统一字段：

```ts
export interface LLMUsageEvent {
  purpose: "summary" | "translation" | "connection-test" | "other";
  providerId: string;
  providerName: string;
  model: string;
  status: "succeeded" | "failed";
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

注意：

- `cancelled` 属于 `AgentTaskRun` 状态，不建议写入 `LLMUsageEvent.status`
- `estimated` 统一使用该字段名，不再使用 `isEstimated`
- 时间字段统一为 ISO string

## 9. 错误、取消、重试与 timeout

T8 需要统一这些行为，避免 Summary 和 Translation 各写一套。

建议错误类型：

```ts
export type AgentErrorCode =
  | "provider_error"
  | "network_error"
  | "prompt_error"
  | "timeout"
  | "cancelled"
  | "unknown_error";
```

处理规则：

- Provider 抛错：记录 `status = failed`
- 网络错误：记录 `status = failed`
- Prompt 渲染失败：记录 `status = failed`
- timeout：记录 `status = failed`，`errorCode = "timeout"`
- 用户取消：Runtime 返回 `status = cancelled`
- 重试：由上层重新触发一次新的 `runAgent()`，不复用旧任务状态

## 10. 与 T9 / T10 / T11 的协作要求

### 10.1 对 T9

需要重点确认：

- `provider.chat()` 调用签名
- `response.content / providerId / providerName / model / usage` 是否稳定
- mock provider 与真实 provider 的返回结构是否一致

T8 本周不应依赖 T9 的具体目录实现细节，而应依赖统一接口，避免 `src/features/llm/` 后续迁移时再次大改。

### 10.2 对 T10 Summary

T10 需要按 T8 统一：

- 输入正文字段为 `canonicalMarkdown`
- 不直接调用底层 Provider
- 不使用 `complete()` / `text` / `isEstimated`
- 使用 Runtime 返回结果中的 `text / providerId / providerName / model / usage`

### 10.3 对 T11 Translation

T11 当前方向与 T9 更接近，但还需要继续对齐：

- 目录迁移到 `src/features/agent/translation/`
- 避免直接覆盖 `App.tsx` 等主骨架文件
- 通过 Runtime 消化 Provider 细节，而不是长期内联 system prompt

## 11. Week 2 建议交付

本周不作为 Feed / OPML / Sync / 本地存储 / 文章列表主链路阻塞项，但建议交付以下最小成果：

1. `docs/features/T8-agent-runtime.md` 文档
2. `src/features/agent/runtime/types.ts` 最小类型骨架
3. `src/features/agent/runtime/runner.ts` mock `runAgent()` 骨架
4. `src/features/agent/prompts/` 的模板加载和渲染骨架
5. 一组 mock 验证结果

最低验证标准：

- Runtime 能调用 mock provider
- 能返回统一 `RuntimeLLMResult`
- 能带回 `text / providerId / providerName / model / usage`
- provider 切换时，T10 / T11 无需修改调用接口

## 12. PR 说明建议

PR 中建议明确写清楚：

- 当前提交是 T8 Week 1 设计文档整理 + Week 2 契约对齐，不是最终完整 AI 实现
- Runtime、Prompt、Usage 的字段命名已按 `AGENTS.md` 收口
- 本次重点为 T9 / T10 / T11 提供统一接入基线
- 当前仍需继续与 T2 的 `AITaskRun / LLMUsageEvent` 落库字段对齐

建议附带验证内容：

- 一段 mock `runAgent()` 结果日志
- 一份 usage 样例 JSON
- 说明 Summary / Translation 后续都通过同一 Runtime 执行

## 13. 当前风险

- T9 目录结构尚未完全按 `AGENTS.md` 收敛，T8 应避免绑定旧路径
- T10 仍有旧 Provider 契约草案，需要继续同步
- T11 已部分对齐 T9，但分支内容改动范围偏大，合并前需要收敛目录和骨架改动
- T2 的 `AITaskRun / LLMUsageEvent` 最终落库字段仍需再次确认

## 14. 本文档当前结论

T8 本周最重要的不是扩展 AI 功能，而是统一接口：

- 对外统一 `runAgent()`
- 对内统一 `provider.chat()` / `response.content`
- 对下游统一 `RuntimeLLMResult`
- 对记录统一 `AgentTaskRun` 和 `LLMUsageEvent` 的边界

只要这层先收口，后续 T9 / T10 / T11 就能在不互相阻塞的情况下继续并行开发。
