export type LLMProviderKind = "openai-compatible" | "mock";

export type LLMPurpose =
  | "summary"
  | "translation"
  | "connection-test"
  | "other";

export type LLMCallStatus = "succeeded" | "failed";

export interface LLMProviderConfig {
  id: string;
  name: string;
  kind: LLMProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  defaultHeaders?: Record<string, string>;
  enabled?: boolean;
  timeoutMs?: number;
}

export type RedactedLLMProviderConfig = Omit<LLMProviderConfig, "apiKey"> & {
  apiKey?: string;
};

export interface LLMChatMessage {
  role: "system" | "user" | "assistant";
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
  estimated: boolean;
}

export interface LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage: LLMUsageInfo;
  status: "succeeded";
  latencyMs: number;
  raw?: unknown;
}

export interface LLMConnectionTestResult {
  providerId: string;
  providerName: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  errorMessage?: string;
}

export interface LLMProvider {
  readonly config: RedactedLLMProviderConfig;
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;
  testConnection(signal?: AbortSignal): Promise<LLMConnectionTestResult>;
}

export interface LLMUsageEvent {
  id: string;
  purpose: LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: LLMCallStatus;
  usage: LLMUsageInfo;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  errorMessage?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
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

export class LLMProviderError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      retryable?: boolean;
      details?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "LLMProviderError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}
