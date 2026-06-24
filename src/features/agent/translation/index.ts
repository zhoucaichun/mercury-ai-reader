import { MockLLMProvider } from "../providers/mockProvider";
import type {
  LLMChatRequest,
  LLMChatResponse,
  LLMProvider,
} from "../providers/types";
import {
  callLLMWithUsage,
  InMemoryLLMUsageEventStore,
  type LLMUsageEventStore,
} from "../../usage/usage";
import type {
  AgentRuntime,
  AgentRunInput,
  AgentRunResult,
  RuntimeLLMResult,
} from "../runtime/types";

export type TranslationTargetLanguage = "zh-CN" | "en-US" | string;

export interface TranslationRequest {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl?: string;
  canonicalMarkdown: string;
  targetLanguage: TranslationTargetLanguage;
  sourceLanguage?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface TranslationResult {
  id: string;
  articleId: string;
  contentId?: string;
  targetLanguage: TranslationTargetLanguage;
  sourceLanguage?: string;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationAgentResult {
  status: "succeeded" | "failed";
  result?: TranslationResult;
  response?: LLMChatResponse;
  errorMessage?: string;
}

export interface TranslationAgent {
  translate(request: TranslationRequest): Promise<TranslationAgentResult>;
  regenerate(request: TranslationRequest): Promise<TranslationAgentResult>;
}

export interface CreateTranslationAgentOptions {
  provider: LLMProvider;
  usageStore?: LLMUsageEventStore;
}

export function createTranslationAgent(
  options: CreateTranslationAgentOptions,
): TranslationAgent {
  const { provider, usageStore } = options;

  async function translate(
    input: TranslationRequest,
  ): Promise<TranslationAgentResult> {
    const request = buildTranslationChatRequest(input, provider.config.model);

    try {
      const response = await callLLMWithUsage(provider, request, usageStore);
      const now = new Date().toISOString();
      const usage = response.usage ?? {};

      return {
        status: "succeeded",
        response,
        result: {
          id: createTranslationResultId(),
          articleId: input.articleId,
          contentId: input.contentId,
          targetLanguage: input.targetLanguage,
          sourceLanguage: input.sourceLanguage,
          markdown: response.content,
          providerId: response.providerId,
          providerName: response.providerName,
          model: response.model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          estimated: usage.estimated,
          createdAt: now,
          updatedAt: now,
        },
      };
    } catch (error) {
      return {
        status: "failed",
        errorMessage: normalizeTranslationError(error),
      };
    }
  }

  return {
    translate,
    regenerate: translate,
  };
}

export function buildTranslationChatRequest(
  input: TranslationRequest,
  defaultModel?: string,
): LLMChatRequest {
  const sourceLanguage = input.sourceLanguage ?? "auto";

  return {
    purpose: "translation",
    model: input.model ?? defaultModel,
    messages: [
      {
        role: "system",
        content: [
          "You are Prism Reader's article translation assistant.",
          "Translate only from the provided article content.",
          "Preserve Markdown structure, headings, lists, links, and code blocks.",
          "Do not add commentary outside the translated Markdown.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Title: ${input.title}`,
          `Source language: ${sourceLanguage}`,
          `Target language: ${input.targetLanguage}`,
          input.sourceUrl ? `Source URL: ${input.sourceUrl}` : "",
          "",
          "Article canonical Markdown:",
          input.canonicalMarkdown,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    metadata: {
      articleId: input.articleId,
      contentId: input.contentId,
      title: input.title,
      sourceUrl: input.sourceUrl,
      sourceLanguage,
      targetLanguage: input.targetLanguage,
      ...input.metadata,
    },
  };
}

export function createMockTranslationAgent(): TranslationAgent {
  return createTranslationAgent({
    provider: new MockLLMProvider({
      providerId: "mock-provider",
      providerName: "Mock Provider",
      kind: "mock",
      baseUrl: "mock://local",
      model: "mock-translation-v1",
    }),
    usageStore: new InMemoryLLMUsageEventStore(),
  });
}

export interface TranslateArticleDeps {
  runtime?: AgentRuntime;
  provider?: LLMProvider;
  usageStore?: LLMUsageEventStore;
}

export function createTranslateArticle(deps: TranslateArticleDeps = {}) {
  const directAgent = createTranslationAgent({
    provider:
      deps.provider ??
      new MockLLMProvider({
        providerId: "mock-provider",
        providerName: "Mock Provider",
        kind: "mock",
        baseUrl: "mock://local",
        model: "mock-translation-v1",
      }),
    usageStore: deps.usageStore,
  });

  async function translateArticle(
    request: TranslationRequest,
  ): Promise<TranslationResult> {
    if (deps.runtime) {
      const taskId = `translation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const runInput: AgentRunInput<TranslationRequest> = {
        taskId,
        agentType: "translation",
        templateId: "translation.default",
        input: request,
        providerId: deps.provider?.config.providerId ?? "mock-provider",
        providerName: deps.provider?.config.providerName,
        model: request.model ?? deps.provider?.config.model ?? "mock-model",
        metadata: {
          articleId: request.articleId,
          contentId: request.contentId,
          targetLanguage: request.targetLanguage,
        },
      };

      const runResult: AgentRunResult<RuntimeLLMResult> =
        await deps.runtime.runAgent(runInput);

      if (runResult.status === "succeeded" && runResult.output) {
        const output = runResult.output;
        const now = new Date().toISOString();
        return {
          id: taskId,
          articleId: request.articleId,
          contentId: request.contentId,
          targetLanguage: request.targetLanguage,
          sourceLanguage: request.sourceLanguage,
          markdown: output.content,
          providerId: output.providerId,
          providerName: output.providerName,
          model: output.model,
          promptTokens: output.usage?.promptTokens,
          completionTokens: output.usage?.completionTokens,
          totalTokens: output.usage?.totalTokens,
          estimated: output.usage?.estimated,
          createdAt: now,
          updatedAt: now,
        };
      }

      throw new Error(
        runResult.errorMessage ?? "Translation failed via Agent Runtime.",
      );
    }

    const agentResult = await directAgent.translate(request);

    if (agentResult.status === "failed" || !agentResult.result) {
      throw new Error(agentResult.errorMessage ?? "Translation failed.");
    }

    return agentResult.result;
  }

  return { translateArticle };
}

const defaultTranslateArticle = createTranslateArticle();
export const translateArticle = defaultTranslateArticle.translateArticle;

function createTranslationResultId(): string {
  return `translation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTranslationError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export const translationFeature = {
  key: "translation",
  ownerTasks: ["T11"],
  status: "week3-runtime-provider-dual-path",
} as const;
