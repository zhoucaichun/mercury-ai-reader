// ─── Shared Agent / Provider contract ─────────────────────────────────
// Used by T8 (Agent Runtime), T9 (LLM Provider),
// T10 (Summary Agent), and T11 (Translation Agent).
//
// IMPORTANT — T9 alignment:
//   The LLMProvider / LLMChatRequest / LLMChatResponse / LLMUsageInfo /
//   LLMUsageEvent / LLMUsageEventStore interfaces below are compatible
//   with T9's src/features/llm/types.ts and src/features/llm/usage.ts.
//   After both branches merge, these can be replaced by direct imports
//   from T9's module.  Field names MUST stay in sync with T9.

// ─── T8: Agent status (shared by Summary & Translation) ──────────────

export type ProviderCallStatus = 'idle' | 'running' | 'succeeded' | 'failed';

// ─── T9-compatible: minimal LLM Provider interface ───────────────────
//   Mirrors src/features/llm/types.ts — do NOT rename fields.

export type LLMPurpose = 'summary' | 'translation' | 'connection-test' | 'other';

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatRequest {
  purpose: LLMPurpose;
  messages: LLMChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string | number | boolean | null>;
  signal?: AbortSignal;
}

export interface LLMUsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean; // T9 field name — NOT "isEstimated"
}

export interface LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string; // T9 field name — NOT "text"
  usage: LLMUsageInfo;
  status: 'succeeded';
  latencyMs: number;
  raw?: unknown;
}

export interface LLMProvider {
  readonly config: {
    id: string;
    name: string;
    kind: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
  };
  chat(request: LLMChatRequest): Promise<LLMChatResponse>; // T9 method — NOT "complete"
}

// ─── T9-compatible: usage event store ────────────────────────────────
//   Mirrors src/features/llm/usage.ts

export interface LLMUsageEvent {
  id: string;
  purpose: LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: 'succeeded' | 'failed';
  usage: LLMUsageInfo;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface LLMUsageEventStore {
  list(): Promise<LLMUsageEvent[]>;
  append(event: LLMUsageEvent): Promise<void>;
}

// ─── Usage recording helper (mirrors T9's callLLMWithUsage pattern) ──

export async function recordUsageFromResponse(
  request: LLMChatRequest,
  response: LLMChatResponse,
  startedAt: Date,
  store?: LLMUsageEventStore,
): Promise<void> {
  if (!store) return;
  await store.append({
    id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    purpose: request.purpose,
    providerId: response.providerId,
    providerName: response.providerName,
    model: response.model,
    status: 'succeeded',
    usage: response.usage,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    latencyMs: response.latencyMs,
    requestId: response.id,
    metadata: request.metadata,
  });
}

export async function recordFailedUsage(
  request: LLMChatRequest,
  providerConfig: { id: string; name: string; model: string },
  startedAt: Date,
  error: unknown,
  store?: LLMUsageEventStore,
): Promise<void> {
  if (!store) return;
  const errorMessage = error instanceof Error ? error.message : String(error);
  await store.append({
    id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    purpose: request.purpose,
    providerId: providerConfig.id,
    providerName: providerConfig.name,
    model: request.model ?? providerConfig.model,
    status: 'failed',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimated: true },
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt.getTime(),
    errorMessage,
    metadata: request.metadata,
  });
}

// ─── In-memory usage store (for mock / Week 1) ───────────────────────

export class InMemoryUsageStore implements LLMUsageEventStore {
  private events: LLMUsageEvent[] = [];
  async list() { return [...this.events]; }
  async append(event: LLMUsageEvent) { this.events.push(event); }
}

// ─── Feature metadata ────────────────────────────────────────────────

export const agentFeature = {
  key: 'agent',
  ownerTasks: ['T8', 'T9', 'T10', 'T11'],
  status: 'week1-contract-draft'
} as const;

// ─── T11 Translation Agent ───────────────────────────────────────────

export type { TranslationCallInput, TranslationCallState } from './translation';
export { translationAgent, createTranslationAgent, createMockLLMProvider } from './translation';