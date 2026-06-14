import {
  chatCompletionsUrl,
  redactProviderConfig,
  resolveProviderConfig,
} from "./config";
import {
  LLMProviderError,
  type LLMChatRequest,
  type LLMChatResponse,
  type LLMConnectionTestResult,
  type LLMProvider,
  type LLMProviderConfig,
  type LLMUsageInfo,
  type RedactedLLMProviderConfig,
} from "./types";
import {
  estimateTokensFromMessages,
  estimateTokensFromText,
} from "./tokenEstimate";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface OpenAIChatCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly config: RedactedLLMProviderConfig;

  private readonly resolvedConfig: LLMProviderConfig;
  private readonly fetcher: FetchLike;

  constructor(
    config: LLMProviderConfig,
    options: {
      env?: Record<string, string | undefined>;
      fetcher?: FetchLike;
    } = {},
  ) {
    this.resolvedConfig = resolveProviderConfig(config, options.env);
    this.config = redactProviderConfig(this.resolvedConfig);
    if (options.fetcher) {
      this.fetcher = options.fetcher;
    } else if (typeof globalThis.fetch === "function") {
      this.fetcher = globalThis.fetch.bind(globalThis);
    } else {
      throw new LLMProviderError("Fetch API is not available in this runtime.", {
        code: "fetch_unavailable",
        retryable: false,
      });
    }
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const startedAt = Date.now();
    const timeoutState = createTimeoutSignal(
      request.signal,
      this.resolvedConfig.timeoutMs,
    );

    try {
      const response = await this.fetcher(
        chatCompletionsUrl(this.resolvedConfig.baseUrl),
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: request.model ?? this.resolvedConfig.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: false,
          }),
          signal: timeoutState.signal,
        },
      );

      const responseJson = (await response.json().catch(() => ({}))) as
        | OpenAIChatCompletionResponse
        | Record<string, unknown>;

      if (!response.ok) {
        throw toProviderError(response, responseJson);
      }

      const parsed = responseJson as OpenAIChatCompletionResponse;
      const content = parsed.choices?.[0]?.message?.content ?? "";
      if (!content) {
        throw new LLMProviderError("Provider returned an empty response.", {
          code: "empty_response",
          retryable: false,
          details: parsed,
        });
      }

      const usage = normalizeUsage(parsed.usage, request.messages, content);

      return {
        id: parsed.id ?? response.headers.get("x-request-id") ?? undefined,
        providerId: this.resolvedConfig.providerId,
        providerName: this.resolvedConfig.providerName,
        model: request.model ?? this.resolvedConfig.model,
        content,
        usage,
        status: "succeeded",
        latencyMs: Date.now() - startedAt,
        raw: parsed,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      if (timeoutState.didTimeout()) {
        throw new LLMProviderError("Provider request timed out.", {
          code: "timeout",
          retryable: true,
          details: error,
        });
      }

      throw new LLMProviderError(normalizeUnknownError(error), {
        code: "network_error",
        retryable: true,
        details: error,
      });
    } finally {
      timeoutState.cleanup();
    }
  }

  async testConnection(signal?: AbortSignal): Promise<LLMConnectionTestResult> {
    const startedAt = Date.now();

    try {
      await this.chat({
        purpose: "connection-test",
        messages: [
          {
            role: "user",
            content: "Reply with OK.",
          },
        ],
        maxTokens: 8,
        temperature: 0,
        signal,
      });

      return {
        providerId: this.resolvedConfig.providerId,
        providerName: this.resolvedConfig.providerName,
        model: this.resolvedConfig.model,
        status: "succeeded",
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        providerId: this.resolvedConfig.providerId,
        providerName: this.resolvedConfig.providerName,
        model: this.resolvedConfig.model,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        errorMessage: normalizeUnknownError(error),
      };
    }
  }

  async streamChat(
    request: LLMChatRequest,
    onDelta: (delta: string) => void | Promise<void>,
  ): Promise<LLMChatResponse> {
    const startedAt = Date.now();
    const timeoutState = createTimeoutSignal(
      request.signal,
      this.resolvedConfig.timeoutMs,
    );
    let content = "";

    try {
      const response = await this.fetcher(
        chatCompletionsUrl(this.resolvedConfig.baseUrl),
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            model: request.model ?? this.resolvedConfig.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: true,
          }),
          signal: timeoutState.signal,
        },
      );

      if (!response.ok) {
        const responseJson = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw toProviderError(response, responseJson);
      }

      if (!response.body) {
        return this.chat(request);
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              content += delta;
              await onDelta(delta);
            }
          } catch {
            continue;
          }
        }
      }

      if (!content.trim()) {
        throw new LLMProviderError("Provider returned an empty response.", {
          code: "empty_response",
          retryable: true,
        });
      }

      return {
        id: undefined,
        providerId: this.resolvedConfig.providerId,
        providerName: this.resolvedConfig.providerName,
        model: request.model ?? this.resolvedConfig.model,
        content,
        usage: normalizeUsage(undefined, request.messages, content),
        status: "succeeded",
        latencyMs: Date.now() - startedAt,
        raw: undefined,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      if (timeoutState.didTimeout()) {
        throw new LLMProviderError("Provider request timed out.", {
          code: "timeout",
          retryable: true,
        });
      }

      throw new LLMProviderError(normalizeUnknownError(error), {
        code: "provider_error",
        retryable: true,
        details: error,
      });
    } finally {
      timeoutState.cleanup();
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.resolvedConfig.apiKey) {
      headers.authorization = `Bearer ${this.resolvedConfig.apiKey}`;
    }

    return headers;
  }
}

function normalizeUsage(
  usage:
    | OpenAIChatCompletionResponse["usage"]
    | undefined,
  messages: LLMChatRequest["messages"],
  content: string,
): LLMUsageInfo {
  if (
    typeof usage?.prompt_tokens === "number" ||
    typeof usage?.completion_tokens === "number" ||
    typeof usage?.total_tokens === "number"
  ) {
    const promptTokens = usage.prompt_tokens ?? estimateTokensFromMessages(messages);
    const completionTokens =
      usage.completion_tokens ?? estimateTokensFromText(content);
    const hasCompleteUsage =
      typeof usage.prompt_tokens === "number" &&
      typeof usage.completion_tokens === "number" &&
      typeof usage.total_tokens === "number";

    return {
      promptTokens,
      completionTokens,
      totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
      estimated: !hasCompleteUsage,
    };
  }

  const promptTokens = estimateTokensFromMessages(messages);
  const completionTokens = estimateTokensFromText(content);

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimated: true,
  };
}

function toProviderError(
  response: Response,
  body: OpenAIChatCompletionResponse | Record<string, unknown>,
): LLMProviderError {
  const errorBody = (body as OpenAIChatCompletionResponse).error;
  const message =
    errorBody?.message ??
    `Provider request failed with HTTP ${response.status}.`;

  return new LLMProviderError(message, {
    code: String(errorBody?.code ?? response.status),
    status: response.status,
    retryable: response.status === 429 || response.status >= 500,
    details: body,
  });
}

function normalizeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createTimeoutSignal(
  inputSignal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): { signal?: AbortSignal; cleanup: () => void; didTimeout: () => boolean } {
  if (!timeoutMs || typeof AbortController === "undefined") {
    return {
      signal: inputSignal,
      cleanup: () => undefined,
      didTimeout: () => false,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromInput = () => controller.abort();
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (inputSignal) {
    if (inputSignal.aborted) {
      controller.abort();
    } else {
      inputSignal.addEventListener("abort", abortFromInput, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      inputSignal?.removeEventListener("abort", abortFromInput);
    },
    didTimeout: () => timedOut,
  };
}
