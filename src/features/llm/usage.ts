import type {
  LLMCallStatus,
  LLMChatRequest,
  LLMChatResponse,
  LLMProvider,
  LLMProviderConfig,
  LLMUsageEvent,
  LLMUsageGroupStat,
  LLMUsageInfo,
  LLMUsageSummary,
  LLMPurpose,
} from "./types";
import { estimateTokensFromMessages } from "./tokenEstimate";

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
  provider: LLMProvider,
  request: LLMChatRequest,
  usageStore?: LLMUsageEventStore,
): Promise<LLMChatResponse> {
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

export function createUsageEventFromResponse(
  request: LLMChatRequest,
  response: LLMChatResponse,
  startedAt: Date,
): LLMUsageEvent {
  const finishedAt = new Date();

  return {
    id: createUsageEventId(),
    purpose: request.purpose,
    providerId: response.providerId,
    providerName: response.providerName,
    model: response.model,
    status: "succeeded",
    usage: response.usage,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    latencyMs: response.latencyMs,
    requestId: response.id,
    metadata: request.metadata,
  };
}

export function createFailedUsageEvent(input: {
  request: LLMChatRequest;
  providerConfig: Pick<LLMProviderConfig, "id" | "name" | "model">;
  startedAt: Date;
  error: unknown;
  estimatedPromptTokens?: number;
}): LLMUsageEvent {
  const finishedAt = new Date();

  return {
    id: createUsageEventId(),
    purpose: input.request.purpose,
    providerId: input.providerConfig.id,
    providerName: input.providerConfig.name,
    model: input.request.model ?? input.providerConfig.model,
    status: "failed",
    usage: {
      promptTokens: input.estimatedPromptTokens ?? 0,
      completionTokens: 0,
      totalTokens: input.estimatedPromptTokens ?? 0,
      estimated: true,
    },
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
    byPurpose: groupUsage(events, (event) => event.purpose, formatPurpose),
    byProvider: groupUsage(events, (event) => event.providerId, (event) => event.providerName),
    byModel: groupUsage(events, (event) => event.model, (event) => event.model),
    recent: getRecentUsageEvents(events, recentLimit),
  };
}

export function getRecentUsageEvents(
  events: LLMUsageEvent[],
  limit = 20,
): LLMUsageEvent[] {
  return [...events]
    .sort((left, right) => {
      return Date.parse(right.startedAt) - Date.parse(left.startedAt);
    })
    .slice(0, limit);
}

export function formatTokenCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function groupUsage(
  events: LLMUsageEvent[],
  keySelector: (event: LLMUsageEvent) => string,
  labelSelector: (event: LLMUsageEvent) => string,
): LLMUsageGroupStat[] {
  const groups = new Map<string, LLMUsageGroupStat>();

  for (const event of events) {
    const key = keySelector(event);
    const existing = groups.get(key);
    const next = existing ?? {
      key,
      label: labelSelector(event),
      calls: 0,
      succeeded: 0,
      failed: 0,
      totalTokens: 0,
      estimatedTokens: 0,
    };

    next.calls += 1;
    next.succeeded += event.status === "succeeded" ? 1 : 0;
    next.failed += event.status === "failed" ? 1 : 0;
    next.totalTokens += event.usage.totalTokens;
    next.estimatedTokens += event.usage.estimated ? event.usage.totalTokens : 0;

    groups.set(key, next);
  }

  return [...groups.values()].sort((left, right) => {
    return right.calls - left.calls || right.totalTokens - left.totalTokens;
  });
}

function countByStatus(events: LLMUsageEvent[], status: LLMCallStatus): number {
  return events.filter((event) => event.status === status).length;
}

function sumTokens(events: LLMUsageEvent[]): number {
  return events.reduce((sum, event) => sum + event.usage.totalTokens, 0);
}

function sumEstimatedTokens(events: LLMUsageEvent[]): number {
  return events.reduce((sum, event) => {
    return sum + (event.usage.estimated ? event.usage.totalTokens : 0);
  }, 0);
}

function formatPurpose(event: LLMUsageEvent): string {
  const labels: Record<LLMPurpose, string> = {
    summary: "Summary",
    translation: "Translation",
    "connection-test": "Connection test",
    other: "Other",
  };

  return labels[event.purpose];
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
