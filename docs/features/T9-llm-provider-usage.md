# T9 Week 3 LLM Provider / Usage

负责人：T9 蔡钦楠

## 本周目标

第三周 T9 的目标是把 LLM Provider 和 Usage 记录做成可被 T8 Runtime、T10 Summary、T11 Translation 稳定调用的 Week 3 接口版本。

本周重点不是把所有真实模型全部接通，而是保证：

- Provider 公共接口符合 `AGENTS.md` 第 5B 节；
- 所有模型调用统一走 `provider.chat(request)`；
- OpenAI-compatible Provider 支持 base URL、model、环境变量 API key、连接测试和超时错误；
- Mock Provider 可用于内部 fallback 和自测；
- 每次 Summary / Translation / connection-test 调用都能生成 `Week3LLMUsageEvent`；
- Usage summary 只统计真实发生的调用或内部 fallback 调用，不把固定假数据当真实数据展示；
- API key 和本地配置不进入仓库。

## 代码位置

按 `AGENTS.md` 目录规则：

- Provider：`src/features/agent/providers/`
- Usage：`src/features/usage/`
- 文档：`docs/features/T9-llm-provider-usage.md`

不新增 `src/features/llm/` 平行目录。

## Week 3 Provider Contract

Provider 类型在 `src/features/agent/providers/types.ts` 中导出，Week 3 主接口如下：

```ts
export type Week3LLMPurpose =
  | "summary"
  | "translation"
  | "connection-test"
  | "other";

export type Week3LLMProviderKind = "openai-compatible" | "mock";

export interface Week3LLMProviderConfig {
  providerId: string;
  providerName: string;
  kind: Week3LLMProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export interface Week3LLMChatRequest {
  purpose: Week3LLMPurpose;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Week3LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage?: Week3RuntimeUsage;
  status: "succeeded";
  latencyMs: number;
  raw?: unknown;
}

export interface Week3LLMProvider {
  readonly config: Week3LLMProviderConfig;
  chat(request: Week3LLMChatRequest): Promise<Week3LLMChatResponse>;
  testConnection?(signal?: AbortSignal): Promise<Week3LLMConnectionTestResult>;
}
```

为了不破坏已有导入，代码里保留了 `LLMProviderConfig`、`LLMChatRequest`、`LLMChatResponse` 等旧名称作为 Week 3 类型别名。

## Provider 实现

当前提供：

- `MockLLMProvider`
  - 用于内部 fallback 和本地自测；
  - 支持成功调用；
  - 输入包含 `[mock-fail]` 时触发失败路径；
  - `testConnection()` 返回 `status: "succeeded"`。

- `OpenAICompatibleProvider`
  - 调用 `/chat/completions`；
  - 支持 `baseUrl`、`model`、`apiKey`、`apiKeyEnv`；
  - 支持 `timeoutMs`；
  - 超时时抛出 `LLMProviderError`，`code = "timeout"`；
  - 网络失败使用 `code = "network_error"`；
  - Provider HTTP 失败保留状态码和错误信息；
  - Provider 不返回 usage 时，Usage 模块可以补 token 估算。

- `createWeek3LLMProvider`
  - 根据 `kind` 创建 mock 或 OpenAI-compatible provider；
  - 保留 `createLLMProvider` 作为兼容别名。

## API Key 与隐私

按 `AGENTS.md` 第 7、10 节执行：

- 不提交真实 API key；
- 不提交 `.env`；
- 不提交个人本地配置文件；
- 示例统一写 `<your-api-key>`；
- 不写真实 key 格式，不写 `sk-...`；
- 优先使用 `apiKeyEnv` 指向本机环境变量；
- `redactProviderConfig()` 不暴露 key 首尾字符，只显示 `<redacted>`。

示例：

```json
{
  "providerId": "deepseek",
  "providerName": "DeepSeek",
  "kind": "openai-compatible",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "<your-api-key>",
  "model": "deepseek-chat"
}
```

## 多模型接入测试

| Provider | Base URL | Model | API key 配置 | 测试重点 |
| --- | --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | `<your-api-key>` 或 `DEEPSEEK_API_KEY` | 远程 OpenAI-compatible 调用、usage 返回 |
| 学校模型 | 学校提供的 `/v1` endpoint | 学校提供 | `<your-api-key>` 或 `SCHOOL_LLM_API_KEY` | 课程环境连通、失败提示 |
| hymt2 | hymt2 提供的 `/v1` endpoint | 平台提供 | `<your-api-key>` 或 `HYMT2_API_KEY` | 第三方兼容端点参数差异 |
| Ollama 本地 | `http://localhost:11434/v1` | 例如 `qwen2.5:7b` | `<your-api-key>` 占位即可 | 本地模型、离线演示 |
| Mock Provider | `mock://local` | `mock-model` | 不需要 | 无网络、无真实 key 时联调 |

连接测试建议：

1. 用 `createWeek3LLMProvider(config)` 创建 provider。
2. 调用 `provider.testConnection()` 只做连通性状态检查。
3. 如果需要产生 usage event，调用 `testLLMConnectionWithUsage(provider, usageStore)`。
4. 失败时返回或记录 `errorMessage`，不要吞掉错误。

## Week 3 Usage Contract

Usage 类型在 `src/features/usage/types.ts` 中导出：

```ts
export interface Week3LLMUsageEvent {
  id: string;
  purpose: Week3LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: "succeeded" | "failed";
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  startedAt?: Week3ISODateString;
  finishedAt?: Week3ISODateString;
  latencyMs?: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}
```

Usage 模块当前提供：

- `callLLMWithUsage(provider, request, usageStore)`
- `testLLMConnectionWithUsage(provider, usageStore, signal?)`
- `createUsageEventFromResponse()`
- `createFailedUsageEvent()`
- `summarizeUsage()`
- `InMemoryLLMUsageEventStore`
- `BrowserLocalStorageLLMUsageEventStore`

其中 `metadata` 建议包含：

- `taskId`
- `articleId`
- `contentId`
- `agentType`

后续 T2 可以用同一字段口径替换 store，实现 SQLite 持久化。

## Usage Summary

`summarizeUsage()` 返回 `Week3LLMUsageSummary`：

```ts
export interface Week3LLMUsageSummary {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  estimatedTokens: number;
  byPurpose: Array<{ purpose: Week3LLMPurpose; calls: number; totalTokens: number }>;
  byProvider: Array<{ providerId: string; providerName: string; calls: number; totalTokens: number }>;
  byModel: Array<{ model: string; calls: number; totalTokens: number }>;
  recent: Week3LLMUsageEvent[];
}
```

Usage 面板只消费实际传入的 usage events。未调用 AI 时，页面应展示空状态，不展示固定假数据。

## 自测范围

已新增 `src/features/agent/providers/week3ProviderUsage.test.ts` 覆盖：

- Mock provider 成功调用；
- Mock provider 失败调用；
- usage event 字段完整性；
- connection-test 生成 usage event；
- usage summary 只统计实际调用；
- API key 从环境变量解析；
- Provider 配置脱敏；
- OpenAI-compatible provider 超时错误码。

提交 PR 前建议运行：

```text
npm test
npm run build
npm run smoke:week2
```

## 后续对齐

- T2：把 `Week3LLMUsageEvent` 落到 SQLite。
- T8：Runtime 调用 Provider 后统一交给 Usage 模块记录。
- T10：Summary 使用 `provider.chat()`，产生 `purpose = "summary"` 的 usage event。
- T11：Translation 使用 `provider.chat()`，产生 `purpose = "translation"` 的 usage event。
- T7：在真实文章页面展示 Usage 空状态、最近调用和 token 汇总。
