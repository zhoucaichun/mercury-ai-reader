import { createMockAgentRuntime } from "../runtime/runner";
import type {
  AgentRuntime,
  AgentRunResult,
  RuntimeLLMResult,
} from "../runtime/types";
import type { LLMUsageEvent } from "../../usage/types";
import {
  InMemoryLLMUsageEventStore,
  type LLMUsageEventStore,
} from "../../usage/usage";

export type SummaryDetailLevel = "brief" | "standard";

export interface SummaryArticleInput {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  canonicalMarkdown: string;
}

export interface SummaryRequest extends SummaryArticleInput {
  targetLanguage: "zh-CN" | "en-US" | string;
  detailLevel: SummaryDetailLevel;
  regenerate?: boolean;
  model?: string;
  providerId?: string;
  providerName?: string;
  metadata?: Record<string, unknown>;
}

export interface SummaryResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  taskRunId: string;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryAgentResult {
  status: "succeeded" | "failed" | "cancelled";
  result?: SummaryResult;
  runtimeResult?: AgentRunResult<RuntimeLLMResult>;
  usageEvent?: LLMUsageEvent;
  errorMessage?: string;
}

export interface SummaryAgent {
  generateSummary(request: SummaryRequest): Promise<SummaryAgentResult>;
  regenerateSummary(request: SummaryRequest): Promise<SummaryAgentResult>;
}

export interface CreateSummaryAgentOptions {
  runtime?: AgentRuntime;
  usageStore?: LLMUsageEventStore;
  templateId?: string;
  providerId?: string;
  providerName?: string;
  model?: string;
  now?: () => Date;
  idFactory?: () => string;
}

const DEFAULT_TEMPLATE_ID = "summary.default";
const DEFAULT_PROVIDER_ID = "mock-provider";
const DEFAULT_PROVIDER_NAME = "Mock Provider";
const DEFAULT_MODEL = "mock-summary-v1";

export function createSummaryAgent(
  options: CreateSummaryAgentOptions = {},
): SummaryAgent {
  const runtime = options.runtime ?? createMockAgentRuntime();
  const usageStore = options.usageStore;
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? createSummaryId;

  async function generateSummary(
    request: SummaryRequest,
  ): Promise<SummaryAgentResult> {
    const startedAt = now();
    const taskId = createTaskId(request);
    const providerId = request.providerId ?? options.providerId ?? DEFAULT_PROVIDER_ID;
    const providerName =
      request.providerName ?? options.providerName ?? DEFAULT_PROVIDER_NAME;
    const model = request.model ?? options.model ?? DEFAULT_MODEL;

    if (!request.canonicalMarkdown.trim()) {
      const errorMessage = "canonicalMarkdown is required to generate a summary.";
      const usageEvent = createFailedSummaryUsageEvent({
        request,
        taskId,
        providerId,
        providerName,
        model,
        startedAt,
        finishedAt: now(),
        errorMessage,
      });
      await usageStore?.append(usageEvent);

      return {
        status: "failed",
        usageEvent,
        errorMessage,
      };
    }

    const runtimeResult = await runtime.runAgent<SummaryRequest, RuntimeLLMResult>({
      taskId,
      agentType: "summary",
      templateId: options.templateId ?? DEFAULT_TEMPLATE_ID,
      input: request,
      providerId,
      providerName,
      model,
      metadata: {
        taskId,
        articleId: request.articleId,
        contentId: request.contentId,
        agentType: "summary",
        detailLevel: request.detailLevel,
        targetLanguage: request.targetLanguage,
        ...request.metadata,
      },
    });

    const finishedAt = now();

    if (runtimeResult.status !== "succeeded" || !runtimeResult.output) {
      const usageEvent = createFailedSummaryUsageEvent({
        request,
        taskId,
        providerId,
        providerName,
        model,
        startedAt,
        finishedAt,
        errorMessage:
          runtimeResult.errorMessage ?? `Summary task ${runtimeResult.status}.`,
      });
      await usageStore?.append(usageEvent);

      return {
        status: runtimeResult.status,
        runtimeResult,
        usageEvent,
        errorMessage: runtimeResult.errorMessage,
      };
    }

    const output = runtimeResult.output;
    const createdAt = finishedAt.toISOString();
    const result: SummaryResult = {
      id: idFactory(),
      articleId: request.articleId,
      contentId: request.contentId,
      taskId,
      taskRunId: taskId,
      targetLanguage: request.targetLanguage,
      detailLevel: request.detailLevel,
      markdown: output.text,
      providerId: output.providerId,
      providerName: output.providerName,
      model: output.model,
      createdAt,
      updatedAt: createdAt,
    };

    const usageEvent = createSucceededSummaryUsageEvent({
      request,
      taskId,
      output,
      startedAt,
      finishedAt,
    });
    await usageStore?.append(usageEvent);

    return {
      status: "succeeded",
      result,
      runtimeResult,
      usageEvent,
    };
  }

  return {
    generateSummary,
    regenerateSummary: generateSummary,
  };
}

export function generateSummary(
  request: SummaryRequest,
  options: CreateSummaryAgentOptions = {},
): Promise<SummaryAgentResult> {
  return createSummaryAgent(options).generateSummary(request);
}

export function createMockSummaryAgent(): SummaryAgent {
  return createSummaryAgent({
    runtime: createMockAgentRuntime(),
    usageStore: new InMemoryLLMUsageEventStore(),
  });
}

export function buildSummaryPromptInput(request: SummaryRequest): Record<string, unknown> {
  return {
    title: request.title,
    sourceUrl: request.sourceUrl,
    feedTitle: request.feedTitle,
    author: request.author,
    publishedAt: request.publishedAt,
    canonicalMarkdown: request.canonicalMarkdown,
    targetLanguage: request.targetLanguage,
    detailLevel: request.detailLevel,
    maxKeyPoints: request.detailLevel === "brief" ? 3 : 5,
  };
}

function createSucceededSummaryUsageEvent(input: {
  request: SummaryRequest;
  taskId: string;
  output: RuntimeLLMResult;
  startedAt: Date;
  finishedAt: Date;
}): LLMUsageEvent {
  return {
    id: createUsageEventId(),
    purpose: "summary",
    providerId: input.output.providerId,
    providerName: input.output.providerName,
    model: input.output.model,
    status: "succeeded",
    promptTokens: input.output.usage?.promptTokens,
    completionTokens: input.output.usage?.completionTokens,
    totalTokens: input.output.usage?.totalTokens,
    estimated: input.output.usage?.estimated,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    latencyMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    metadata: createSummaryUsageMetadata(input.request, input.taskId),
  };
}

function createFailedSummaryUsageEvent(input: {
  request: SummaryRequest;
  taskId: string;
  providerId: string;
  providerName: string;
  model: string;
  startedAt: Date;
  finishedAt: Date;
  errorMessage: string;
}): LLMUsageEvent {
  return {
    id: createUsageEventId(),
    purpose: "summary",
    providerId: input.providerId,
    providerName: input.providerName,
    model: input.model,
    status: "failed",
    estimated: true,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    latencyMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    errorMessage: input.errorMessage,
    metadata: createSummaryUsageMetadata(input.request, input.taskId),
  };
}

function createSummaryUsageMetadata(
  request: SummaryRequest,
  taskId: string,
): Record<string, unknown> {
  return {
    taskId,
    articleId: request.articleId,
    contentId: request.contentId,
    agentType: "summary",
    detailLevel: request.detailLevel,
    targetLanguage: request.targetLanguage,
  };
}

function createTaskId(request: SummaryRequest): string {
  const suffix = request.regenerate ? "regenerate" : "generate";
  return `summary-${request.articleId}-${suffix}-${Date.now()}`;
}

function createSummaryId(): string {
  return `summary-result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createUsageEventId(): string {
  return `summary-usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const summaryFeature = {
  key: "summary",
  ownerTasks: ["T10"],
  status: "week3-runtime-aligned",
} as const;
