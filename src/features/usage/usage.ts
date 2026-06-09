import type {
  LLMChatRequest,
  LLMChatResponse,
  LLMProvider,
  LLMProviderConfig,
  LLMUsageInfo,
  Week3LLMChatRequest,
  Week3LLMChatResponse,
  Week3LLMProvider,
  Week3RuntimeUsage,
} from "../agent/providers/types";
import {
  estimateTokensFromMessages,
  estimateTokensFromText,
} from "../agent/providers/tokenEstimate";
import type {
  LLMCallStatus,
  LLMUsageEvent,
  LLMUsageSummary,
  Week3LLMUsageEvent,
} from "./types";

export interface LLMUsageEventStore {
  list(): Promise<LLMUsageEvent[]>;
  append(event: LLMUsageEvent): Promise<void>;
  clear?(): Promise<void>;
}

export class InMemoryLLMUsageEventStore implements LLMUsageEventStore {
  private readonly events: LLMUsageEvent[] = [];

  async list(): Promise<LLMUsageEvent[]> {
    return [...this.events];
  }

  async append(event: LLMUsageEvent): Promise<void> {
    this.events.push(event);
  }

  async clear(): Promise<void> {
    this.events.length = 0;
  }
}

export class BrowserLocalStorageLLMUsageEventStore implements LLMUsageEventStore {
  private readonly storageKey: string;

  constructor(storageKey = "mercury.llmUsageEvents") {
    this.storageKey = storageKey;
  }

  async list(): Promise<LLMUsageEvent[]> {
    const raw = globalThis.localStorage?.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async append(event: LLMUsageEvent): Promise<void> {
    const events = await this.list();
    events.push(event);
    globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(events));
  }

  async clear(): Promise<void> {
    globalThis.localStorage?.removeItem(this.storageKey);
  }
}

export async function callLLMWithUsage(
  provider: Week3LLMProvider,
  request: Week3LLMChatRequest,
  usageStore?: LLMUsageEventStore,
): Promise<Week3LLMChatResponse> {
  const startedAt = new Date();

  try {
    const response = await provider.chat(request);
    await usageStore?.append(
      createUsageEventFromResponse(request, response, startedAt),
    );
    return response;
  } catch (error) {
    await usageStore?.append(
      createFailedUsageEvent({
        request,
        providerConfig: provider.config,
        startedAt,
        error,
        estimatedPromptTokens: estimateTokensFromMessages(request.messages),
      }),
    );
    throw error;
  }
}

export async function testLLMConnectionWithUsage(
  provider: Week3LLMProvider,
  usageStore?: LLMUsageEventStore,
  signal?: AbortSignal,
) {
  return callLLMWithUsage(
    provider,
    {
      purpose: "connection-test",
      messages: [{ role: "user", content: "Reply with OK." }],
      maxTokens: 8,
      temperature: 0,
      metadata: {
        agentType: "connection-test",
        providerId: provider.config.providerId,
      },
      signal,
    },
    usageStore,
  );
}

export function createUsageEventFromResponse(
  request: LLMChatRequest,
  response: LLMChatResponse,
  startedAt: Date,
): Week3LLMUsageEvent {
  const finishedAt = new Date();
  const usage = normalizeResponseUsage(request, response);

  return {
    id: createUsageEventId(),
    purpose: request.purpose,
    providerId: response.providerId,
    providerName: response.providerName,
    model: response.model,
    status: "succeeded",
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    estimated: usage.estimated,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    latencyMs: response.latencyMs,
    requestId: response.id,
    metadata: request.metadata,
  };
}

export function createFailedUsageEvent(input: {
  request: LLMChatRequest;
  providerConfig: Pick<LLMProviderConfig, "providerId" | "providerName" | "model">;
  startedAt: Date;
  error: unknown;
  estimatedPromptTokens?: number;
}): Week3LLMUsageEvent {
  const finishedAt = new Date();

  return {
    id: createUsageEventId(),
    purpose: input.request.purpose,
    providerId: input.providerConfig.providerId,
    providerName: input.providerConfig.providerName,
    model: input.request.model ?? input.providerConfig.model,
    status: "failed",
    promptTokens: input.estimatedPromptTokens ?? 0,
    completionTokens: 0,
    totalTokens: input.estimatedPromptTokens ?? 0,
    estimated: true,
    startedAt: input.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    latencyMs: finishedAt.getTime() - input.startedAt.getTime(),
    errorMessage: normalizeUsageError(input.error),
    metadata: input.request.metadata,
  };
}

export function summarizeUsage(
  events: LLMUsageEvent[],
  options: { recentLimit?: number } = {},
): LLMUsageSummary {
  const recentLimit = options.recentLimit ?? 20;

  return {
    totalCalls: events.length,
    succeededCalls: countByStatus(events, "succeeded"),
    failedCalls: countByStatus(events, "failed"),
    totalTokens: sumTokens(events),
    estimatedTokens: sumEstimatedTokens(events),
    byPurpose: groupByPurpose(events),
    byProvider: groupByProvider(events),
    byModel: groupByModel(events),
    recent: getRecentUsageEvents(events, recentLimit),
  };
}

export function getRecentUsageEvents(
  events: LLMUsageEvent[],
  limit = 20,
): LLMUsageEvent[] {
  return [...events]
    .sort((left, right) => {
      return Date.parse(right.startedAt ?? "") - Date.parse(left.startedAt ?? "");
    })
    .slice(0, limit);
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function groupByPurpose(events: LLMUsageEvent[]): LLMUsageSummary["byPurpose"] {
  const groups = new Map<string, { purpose: LLMUsageEvent["purpose"]; calls: number; totalTokens: number }>();

  for (const event of events) {
    const key = event.purpose;
    const existing = groups.get(key);
    const next = existing ?? {
      purpose: event.purpose,
      calls: 0,
      totalTokens: 0,
    };

    next.calls += 1;
    next.totalTokens += event.totalTokens ?? 0;

    groups.set(key, next);
  }

  return [...groups.values()].sort((left, right) => {
    return right.calls - left.calls || right.totalTokens - left.totalTokens;
  });
}

function groupByProvider(events: LLMUsageEvent[]): LLMUsageSummary["byProvider"] {
  const groups = new Map<
    string,
    { providerId: string; providerName: string; calls: number; totalTokens: number }
  >();

  for (const event of events) {
    const existing = groups.get(event.providerId);
    const next = existing ?? {
      providerId: event.providerId,
      providerName: event.providerName,
      calls: 0,
      totalTokens: 0,
    };

    next.calls += 1;
    next.totalTokens += event.totalTokens ?? 0;

    groups.set(event.providerId, next);
  }

  return [...groups.values()].sort((left, right) => {
    return right.calls - left.calls || right.totalTokens - left.totalTokens;
  });
}

function groupByModel(events: LLMUsageEvent[]): LLMUsageSummary["byModel"] {
  const groups = new Map<string, { model: string; calls: number; totalTokens: number }>();

  for (const event of events) {
    const existing = groups.get(event.model);
    const next = existing ?? {
      model: event.model,
      calls: 0,
      totalTokens: 0,
    };

    next.calls += 1;
    next.totalTokens += event.totalTokens ?? 0;

    groups.set(event.model, next);
  }

  return [...groups.values()].sort((left, right) => {
    return right.calls - left.calls || right.totalTokens - left.totalTokens;
  });
}

function countByStatus(events: LLMUsageEvent[], status: LLMCallStatus): number {
  return events.filter((event) => event.status === status).length;
}

function sumTokens(events: LLMUsageEvent[]): number {
  return events.reduce((sum, event) => sum + (event.totalTokens ?? 0), 0);
}

function sumEstimatedTokens(events: LLMUsageEvent[]): number {
  return events.reduce((sum, event) => {
    return sum + (event.estimated ? event.totalTokens ?? 0 : 0);
  }, 0);
}

function createUsageEventId(): string {
  return `llm-usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUsageError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function emptyUsage(): LLMUsageInfo {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimated: true,
  };
}

function normalizeResponseUsage(
  request: LLMChatRequest,
  response: LLMChatResponse,
): Required<Week3RuntimeUsage> {
  if (response.usage) {
    return {
      promptTokens: response.usage.promptTokens ?? 0,
      completionTokens: response.usage.completionTokens ?? 0,
      totalTokens: response.usage.totalTokens ?? 0,
      estimated: response.usage.estimated ?? false,
    };
  }

  const promptTokens = estimateTokensFromMessages(request.messages);
  const completionTokens = estimateTokensFromText(response.content);

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimated: true,
  };
}
