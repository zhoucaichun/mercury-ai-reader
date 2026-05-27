import { redactProviderConfig } from "./config";
import {
  LLMProviderError,
  type LLMChatRequest,
  type LLMChatResponse,
  type LLMConnectionTestResult,
  type LLMProvider,
  type LLMProviderConfig,
  type RedactedLLMProviderConfig,
} from "./types";
import {
  estimateTokensFromMessages,
  estimateTokensFromText,
} from "./tokenEstimate";

export class MockLLMProvider implements LLMProvider {
  readonly config: RedactedLLMProviderConfig;

  private readonly resolvedConfig: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.resolvedConfig = {
      ...config,
      kind: "mock",
      baseUrl: config.baseUrl || "mock://local",
      model: config.model || "mock-model",
    };
    this.config = redactProviderConfig(this.resolvedConfig);
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const startedAt = Date.now();
    await sleep(120);

    const prompt = request.messages.map((message) => message.content).join("\n");
    if (prompt.includes("[mock-fail]")) {
      throw new LLMProviderError("Mock provider failure requested.", {
        code: "mock_failure",
        retryable: false,
      });
    }

    const content = createMockContent(request.purpose, prompt);
    const promptTokens = estimateTokensFromMessages(request.messages);
    const completionTokens = estimateTokensFromText(content);

    return {
      id: `mock-${Date.now()}`,
      providerId: this.resolvedConfig.id,
      providerName: this.resolvedConfig.name,
      model: request.model ?? this.resolvedConfig.model,
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimated: true,
      },
      status: "succeeded",
      latencyMs: Date.now() - startedAt,
    };
  }

  async testConnection(): Promise<LLMConnectionTestResult> {
    const startedAt = Date.now();
    await sleep(60);

    return {
      providerId: this.resolvedConfig.id,
      providerName: this.resolvedConfig.name,
      model: this.resolvedConfig.model,
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  }
}

function createMockContent(purpose: LLMChatRequest["purpose"], prompt: string): string {
  const clippedPrompt = prompt.replace(/\s+/g, " ").slice(0, 120);

  if (purpose === "summary") {
    return `Mock summary: ${clippedPrompt}`;
  }

  if (purpose === "translation") {
    return `Mock translation: ${clippedPrompt}`;
  }

  if (purpose === "connection-test") {
    return "OK";
  }

  return `Mock response: ${clippedPrompt}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
