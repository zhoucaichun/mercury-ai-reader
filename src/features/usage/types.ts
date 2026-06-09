import type { Week3LLMPurpose } from "../agent/providers/types";

export type LLMCallStatus = "succeeded" | "failed";

export type Week3ISODateString = string;

export interface Week3LLMUsageEvent {
  id: string;
  purpose: Week3LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: LLMCallStatus;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  startedAt?: Week3ISODateString;
  finishedAt?: Week3ISODateString;
  latencyMs?: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface Week3LLMUsageSummary {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  estimatedTokens: number;
  byPurpose: Array<{ purpose: Week3LLMPurpose; calls: number; totalTokens: number }>;
  byProvider: Array<{
    providerId: string;
    providerName: string;
    calls: number;
    totalTokens: number;
  }>;
  byModel: Array<{ model: string; calls: number; totalTokens: number }>;
  recent: Week3LLMUsageEvent[];
}

export type LLMUsageEvent = Week3LLMUsageEvent;
export type LLMUsageSummary = Week3LLMUsageSummary;
