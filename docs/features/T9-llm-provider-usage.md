# T9 LLM Provider / 模型配置 / Usage 统计草案

负责人：T9 蔡钦楠

## 当前阶段

本文件对应 Week 1 的 LLM Provider / 模型配置 / Usage 统计字段与面板草案。

当前目标是先稳定 Provider 与 Usage 的目录、接口和字段口径，方便后续 T8 Agent Runtime、T10 Summary Agent、T11 Translation Agent 复用统一模型调用入口。这里不是最终真实模型全部接入版本，也不要求 DeepSeek、学校模型、hymt2、本地模型全部真实连通。

## AGENTS.md 对齐

本次整理已按 `AGENTS.md` 的目录规则放置：

- Provider 代码：`src/features/agent/providers/`
- Usage 代码：`src/features/usage/`
- 功能文档：`docs/features/T9-llm-provider-usage.md`

不再新增或继续使用平行目录 `src/features/llm/`。

## Week 2 说明

Week 2 主链路是：

```text
Feed / OPML -> Sync -> Local Storage -> Article List
```

T9 本周不作为主链路阻塞项，但必须按 `AGENTS.md` 对齐 Provider / Usage 目录和接口，避免后续合并冲突。

本周优先保证：

- mock provider 可用；
- `provider.chat(request)` 调用形式稳定；
- Usage event 字段稳定；
- Summary / Translation 后续可以复用同一 Provider 调用入口；
- Usage 面板先保持 MVP 字段与展示草案。

本周不强求：

- 所有真实模型全部接通；
- 完整账单或复杂报表；
- 云端同步；
- Summary / Translation 完整业务联动。

## Provider 接口

Provider 配置字段：

```ts
interface LLMProviderConfig {
  providerId: string;
  providerName: string;
  kind: "openai-compatible" | "mock";
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  defaultHeaders?: Record<string, string>;
  enabled?: boolean;
  timeoutMs?: number;
}
```

统一调用形式：

```ts
provider.chat(request);
response.content;
```

Provider 请求字段：

```ts
interface LLMChatRequest {
  purpose: "summary" | "translation" | "connection-test" | "other";
  messages: LLMChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}
```

Provider 返回字段：

```ts
interface LLMChatResponse {
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
}
```

## 已整理代码

Provider：

- `src/features/agent/providers/types.ts`
- `src/features/agent/providers/config.ts`
- `src/features/agent/providers/providerFactory.ts`
- `src/features/agent/providers/openAICompatibleProvider.ts`
- `src/features/agent/providers/mockProvider.ts`
- `src/features/agent/providers/tokenEstimate.ts`
- `src/features/agent/providers/LLMProviderSettingsPanel.tsx`

Usage：

- `src/features/usage/types.ts`
- `src/features/usage/usage.ts`
- `src/features/usage/LLMUsagePanel.tsx`
- `src/features/usage/LLMUsagePanel.css`

配置示例：

- `config/llm.providers.example.json`

## API key 与隐私要求

按 `AGENTS.md` 第 7 节和第 10 节执行：

- 不提交真实 API key；
- 不提交 `.env`；
- 不提交本地个人配置文件；
- 示例 key 统一写成 `<your-api-key>`；
- 不写真实 key 格式，也不写 `sk-...`；
- API key 建议通过 `apiKeyEnv` 指向本机环境变量；
- 文章、AI 结果、usage 记录后续优先保存在本地 SQLite。

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

也可以使用环境变量名：

```json
{
  "providerId": "deepseek",
  "providerName": "DeepSeek",
  "kind": "openai-compatible",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKeyEnv": "DEEPSEEK_API_KEY",
  "model": "deepseek-chat"
}
```

## 多模型测试方案

| Provider | Base URL | Model | API key 配置 | 测试重点 |
| --- | --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | `<your-api-key>` 或 `DEEPSEEK_API_KEY` | 远程 OpenAI-compatible 调用、usage 返回 |
| 学校模型 | 学校提供的 `/v1` endpoint | 学校提供 | `<your-api-key>` 或 `SCHOOL_LLM_API_KEY` | 课程环境连通、失败提示 |
| hymt2 | hymt2 提供的 `/v1` endpoint | 平台提供 | `<your-api-key>` 或 `HYMT2_API_KEY` | 第三方兼容端点参数差异 |
| Ollama 本地 | `http://localhost:11434/v1` | 例如 `qwen2.5:7b` | `<your-api-key>` 占位即可 | 本地模型、离线演示 |
| Mock Provider | `mock://local` | `mock-model` | 不需要 | 无网络、无真实 key 时联调 |

连通性测试建议：

1. 使用 `createLLMProvider(config)` 创建 provider。
2. 调用 `provider.testConnection()`。
3. 成功时记录 provider、model、latency。
4. 失败时返回 `errorMessage`，不要吞掉错误。
5. 测试结果可以形成 `purpose = "connection-test"` 的 usage event。

## Usage Event 字段

Usage event 按 `AGENTS.md` 第 8 节使用扁平字段：

```ts
interface LLMUsageEvent {
  id: string;
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

Usage 模块当前提供：

- `createUsageEventFromResponse()`
- `createFailedUsageEvent()`
- `callLLMWithUsage()`
- `summarizeUsage()`
- `InMemoryLLMUsageEventStore`
- `BrowserLocalStorageLLMUsageEventStore`

后续 T2 落 SQLite 时，可以用同一字段口径替换 store 实现。

## Usage 面板 MVP 展示方案

汇总字段：

- 总调用次数；
- 成功次数；
- 失败次数；
- 总 token；
- 估算 token。

分组统计：

- 按功能类型统计：Summary / Translation / Connection Test / Other；
- 按 Provider 统计；
- 按 Model 统计。

最近调用明细：

- 调用时间；
- 功能类型；
- Provider；
- Model；
- 状态；
- Token；
- 是否估算。

当前 `LLMUsagePanel` 只是草案面板，后续需要 T7 挂入口、T2 提供持久化、T8/T10/T11 持续产出 usage event。

## 后续对齐事项

- 与 T2 对齐：`LLMUsageEvent` 如何落库到本地 SQLite。
- 与 T8 对齐：Agent Runtime 在调用结束时如何交给 usage 模块记录。
- 与 T10 对齐：Summary Agent 使用 `provider.chat()` 并产生 `purpose = "summary"` 的 usage event。
- 与 T11 对齐：Translation Agent 使用 `provider.chat()` 并产生 `purpose = "translation"` 的 usage event。
- 与 T7 对齐：Usage 面板入口放在主 UI 的哪个位置。

## 当前验收点

- Provider 代码已放到 `src/features/agent/providers/`。
- Usage 代码已放到 `src/features/usage/`。
- 文档已放到 `docs/features/T9-llm-provider-usage.md`。
- 支持 `providerId / providerName / baseUrl / apiKey / apiKeyEnv / model` 配置。
- 支持 mock provider。
- 支持 OpenAI-compatible provider 草案。
- 支持 `provider.chat(request)` 统一调用形式。
- 支持 usage event 字段草案和统计汇总。
- API key 示例已使用 `<your-api-key>`，不提交真实 key、`.env` 或本地个人配置文件。
