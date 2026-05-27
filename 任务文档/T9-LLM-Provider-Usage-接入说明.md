# T9 LLM Providers / 模型配置 / 用量统计展示接入说明

## 本次交付

- `src/features/llm/types.ts`：统一 Provider、请求、响应、usage event 类型。
- `src/features/llm/openAICompatibleProvider.ts`：OpenAI-compatible `/chat/completions` 调用实现，支持 `baseUrl`、`apiKey`、`apiKeyEnv`、`model`、超时和连通性测试。
- `src/features/llm/mockProvider.ts`：本地 mock provider，供 T8 / T10 / T11 在真实模型未配置时联调。
- `src/features/llm/usage.ts`：usage event 创建、内存/浏览器本地存储适配、汇总统计。
- `src/features/llm/LLMUsagePanel.tsx`：用量统计面板，展示总调用数、成功/失败、token、功能类型、provider、model 和最近明细，可从 `src/features/llm/ui.ts` 引入。
- `src/features/llm/LLMProviderSettingsPanel.tsx`：模型配置面板，支持 provider、base URL、API key、API key env、model 和测试连接，可从 `src/features/llm/ui.ts` 引入。
- `config/llm.providers.example.json`：多模型配置示例，不包含真实 API key。

## Provider 配置

配置字段：

```ts
interface LLMProviderConfig {
  id: string;
  name: string;
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

建议真实密钥只放在本机环境变量或本地未提交配置里，例如：

```powershell
$env:DEEPSEEK_API_KEY="sk-..."
```

## 统一调用方式

T8 / T10 / T11 可以通过 `createLLMProvider` 获取 provider，再用同一套 `chat` 方法发起摘要或翻译。

```ts
import {
  callLLMWithUsage,
  createLLMProvider,
} from "../features/llm";

const provider = createLLMProvider(
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
  },
  { env: process.env },
);

const request = {
  purpose: "summary" as const,
  messages: [
    { role: "system" as const, content: "你是 Mercury 的摘要助手。" },
    { role: "user" as const, content: markdown },
  ],
};

const response = await callLLMWithUsage(provider, request, usageStore);
```

## Usage 统计范围

MVP 面板展示：

- 总调用次数；
- 成功 / 失败次数；
- 总 token，缺少 provider usage 时使用估算值；
- 按功能类型、provider、model 的基础统计；
- 最近调用明细：功能类型、provider、model、状态、token、调用时间。

T2 后续落库时，可以直接复用 `LLMUsageEvent` 字段。T8 Agent Runtime 只需要在每次调用结束后生成或转交 `LLMUsageEvent`。

## 多模型测试方案

| Provider | base URL | model | API key 配置 | 测试重点 |
| --- | --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | `DEEPSEEK_API_KEY` | 远程 OpenAI-compatible 调用、token 返回 |
| 学校模型 | `https://<school-llm-endpoint>/v1` | 课程提供 | `SCHOOL_LLM_API_KEY` | 课程环境连通、失败提示 |
| hymt2 | `https://<hymt2-endpoint>/v1` | 平台提供 | `HYMT2_API_KEY` | 第三方兼容端点参数差异 |
| Ollama 本地 | `http://localhost:11434/v1` | `qwen2.5:7b` 或本机模型 | 可填任意本地值 | 本地模型、离线演示 |
| Mock | `mock://local` | `mock-model` | 无需密钥 | 无网络联调、失败路径测试 |

## 验收对应

- 摘要和翻译复用 `LLMProvider.chat`。
- 用户可配置 provider name、base URL、API key、model。
- 预置 DeepSeek、学校模型、hymt2、本地 Ollama、mock 的测试计划。
- 调用失败会抛出 `LLMProviderError`，usage 可记录失败状态和错误信息。
- Provider usage 缺失时使用 token 估算。
- `LLMUsagePanel` 可展示调用汇总和最近明细。
- API key 示例只使用环境变量或本地 mock 值，仓库不提交真实密钥。
