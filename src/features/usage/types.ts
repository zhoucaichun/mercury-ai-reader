import type { LLMPurpose } from "../agent/providers/types";

export type LLMCallStatus = "succeeded" | "failed";

export interface LLMUsageEvent {
  id: string;
  purpose: LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: LLMCallStatus;
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

export interface LLMUsageGroupStat {
  key: string;
  label: string;
  calls: number;
  succeeded: number;
  failed: number;
  totalTokens: number;
  estimatedTokens: number;
}

export interface LLMUsageSummary {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  estimatedTokens: number;
  byPurpose: LLMUsageGroupStat[];
  byProvider: LLMUsageGroupStat[];
  byModel: LLMUsageGroupStat[];
  recent: LLMUsageEvent[];
}
