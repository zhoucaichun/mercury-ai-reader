import {
  loadPromptTemplate,
  resolvePromptTemplatePath,
} from "../prompts/loader";
import { renderPromptTemplate } from "../prompts/renderer";
import type {
  Week3AgentErrorCode,
  Week3AgentRunInput,
  Week3AgentRunResult,
  Week3AgentRuntime,
  Week3AgentStatus,
  Week3LLMChatRequest,
  Week3LLMChatResponse,
  Week3LLMProvider,
  Week3PromptLoadOptions,
  Week3PromptTemplate,
  Week3RuntimeLLMResult,
  Week3RuntimeTaskState,
  Week3RuntimeUsage,
} from "./types";

export interface CreateWeek3AgentRuntimeOptions {
  provider?: Week3LLMProvider;
  loadTemplate?: (
    templateId: string,
    options?: Week3PromptLoadOptions,
  ) => Promise<Week3PromptTemplate>;
  promptOptions?: Week3PromptLoadOptions;
  onStateChange?: (state: Week3RuntimeTaskState) => void;
}

export interface Week3AgentRuntimeHelpers {
  resolveTemplatePath(templateId: string): string;
}

export function createWeek3AgentRuntime(
  options: CreateWeek3AgentRuntimeOptions = {},
): Week3AgentRuntime & Week3AgentRuntimeHelpers {
  const provider = options.provider ?? createFallbackMockProvider();
  const loadTemplate = options.loadTemplate ?? loadPromptTemplate;
  const promptOptions = options.promptOptions;

  return {
    resolveTemplatePath(templateId: string): string {
      return resolvePromptTemplatePath(templateId, promptOptions);
    },

    async runAgent<TInput, TOutput = Week3RuntimeLLMResult>(
      input: Week3AgentRunInput<TInput>,
    ): Promise<Week3AgentRunResult<TOutput>> {
      if (input.signal?.aborted) {
        return cancelResult(input.taskId, "Agent task was cancelled before execution.");
      }

      emitState(options.onStateChange, {
        taskId: input.taskId,
        status: "queued",
      });
      emitState(options.onStateChange, {
        taskId: input.taskId,
        status: "running",
      });

      try {
        const template = await loadTemplate(input.templateId, promptOptions);
        const messages = renderPromptTemplate(template, toPromptInput(input.input));
        const request: Week3LLMChatRequest = {
          purpose: input.agentType,
          messages,
          model: input.model,
          metadata: toProviderMetadata({
            ...input.metadata,
            taskId: input.taskId,
            agentType: input.agentType,
          }),
          signal: input.signal,
        };

        const response = await provider.chat(request);
        const output = toRuntimeResult(response) as TOutput;

        emitState(options.onStateChange, {
          taskId: input.taskId,
          status: "succeeded",
        });

        return {
          taskId: input.taskId,
          status: "succeeded",
          output,
        };
      } catch (error) {
        if (input.signal?.aborted) {
          emitState(options.onStateChange, {
            taskId: input.taskId,
            status: "cancelled",
            errorCode: "cancelled",
            errorMessage: "Agent task was cancelled during execution.",
          });
          return cancelResult(input.taskId, "Agent task was cancelled during execution.");
        }

        const normalized = normalizeRuntimeError(error);
        emitState(options.onStateChange, {
          taskId: input.taskId,
          status: "failed",
          errorCode: normalized.errorCode,
          errorMessage: normalized.errorMessage,
        });

        return {
          taskId: input.taskId,
          status: "failed",
          errorCode: normalized.errorCode,
          errorMessage: normalized.errorMessage,
        };
      }
    },
  };
}

export function createFallbackMockProvider(): Week3LLMProvider {
  return {
    config: {
      providerId: "mock-provider",
      providerName: "Mock Provider",
      kind: "mock",
      baseUrl: "mock://local",
      model: "mock-model",
      enabled: true,
      timeoutMs: 10_000,
    },
    async chat(request: Week3LLMChatRequest): Promise<Week3LLMChatResponse> {
      const startedAt = Date.now();

      if (request.signal?.aborted) {
        throw withErrorCode(new Error("Request aborted."), "cancelled");
      }

      const mergedPrompt = request.messages.map((message) => message.content).join("\n\n");
      const simulateFailure = /__FORCE_(PROVIDER|NETWORK|PROMPT|TIMEOUT)_ERROR__/i.test(
        mergedPrompt,
      );

      if (simulateFailure) {
        if (mergedPrompt.includes("__FORCE_TIMEOUT_ERROR__")) {
          throw withErrorCode(new Error("Mock timeout while generating response."), "timeout");
        }
        if (mergedPrompt.includes("__FORCE_NETWORK_ERROR__")) {
          throw withErrorCode(new Error("Mock network failure while calling provider."), "network_error");
        }
        if (mergedPrompt.includes("__FORCE_PROMPT_ERROR__")) {
          throw withErrorCode(new Error("Mock prompt rendering failure."), "prompt_error");
        }
        throw withErrorCode(new Error("Mock provider failure while generating response."), "provider_error");
      }

      const content = buildFallbackContent(request.purpose, mergedPrompt);
      const promptTokens = estimateTokens(mergedPrompt);
      const completionTokens = estimateTokens(content);

      return {
        id: `mock-${Date.now()}`,
        providerId: "mock-provider",
        providerName: "Mock Provider",
        model: request.model ?? "mock-model",
        content,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          estimated: true,
        },
        status: "succeeded",
        latencyMs: Date.now() - startedAt,
        raw: {
          fallback: true,
          purpose: request.purpose,
        },
      };
    },
  };
}

function emitState(
  onStateChange: CreateWeek3AgentRuntimeOptions["onStateChange"],
  state: Week3RuntimeTaskState,
): void {
  onStateChange?.(state);
}

function cancelResult(taskId: string, message: string): Week3AgentRunResult {
  return {
    taskId,
    status: "cancelled",
    errorCode: "cancelled",
    errorMessage: message,
  };
}

function toRuntimeResult(response: Week3LLMChatResponse): Week3RuntimeLLMResult {
  return {
    content: response.content,
    providerId: response.providerId,
    providerName: response.providerName,
    model: response.model,
    usage: response.usage,
    raw: response.raw,
  };
}

function toPromptInput<TInput>(input: TInput): Record<string, unknown> {
  return (input ?? {}) as Record<string, unknown>;
}

function toProviderMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildFallbackContent(
  purpose: Week3LLMChatRequest["purpose"],
  mergedPrompt: string,
): string {
  const excerpt = mergedPrompt.replace(/\s+/g, " ").trim().slice(0, 260);

  if (purpose === "translation") {
    return [
      "## Translation",
      "",
      excerpt || "No content provided.",
      "",
      "_Generated by the local fallback provider._",
    ].join("\n");
  }

  return [
    "## Summary",
    "",
    excerpt || "No content provided.",
    "",
    "- Generated by shared agent runtime",
    "- Uses provider.chat() and response.content",
  ].join("\n");
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeRuntimeError(error: unknown): {
  errorCode: Week3AgentErrorCode;
  errorMessage: string;
} {
  if (isAbortError(error)) {
    return {
      errorCode: "cancelled",
      errorMessage: "Agent task was cancelled.",
    };
  }

  if (error instanceof Error) {
    return {
      errorCode: inferErrorCode(error),
      errorMessage: error.message,
    };
  }

  return {
    errorCode: "unknown_error",
    errorMessage: String(error),
  };
}

function inferErrorCode(error: Error): Week3AgentErrorCode {
  const knownErrorCode = (error as Error & { code?: Week3AgentErrorCode }).code;
  if (knownErrorCode) {
    return knownErrorCode;
  }

  const message = error.message.toLowerCase();
  if (message.includes("timeout")) {
    return "timeout";
  }
  if (message.includes("network")) {
    return "network_error";
  }
  if (message.includes("prompt")) {
    return "prompt_error";
  }
  if (message.includes("cancel")) {
    return "cancelled";
  }

  return "provider_error";
}

function withErrorCode<T extends Error>(
  error: T,
  code: Week3AgentErrorCode,
): T & { code: Week3AgentErrorCode } {
  return Object.assign(error, { code });
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
}
