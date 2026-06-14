export type Week3LLMProviderKind = "openai-compatible" | "mock";

export type Week3LLMPurpose =
  | "summary"
  | "translation"
  | "connection-test"
  | "other";

export interface Week3RuntimeUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
}

export interface Week3LLMProviderConfig {
  providerId: string;
  providerName: string;
  kind: Week3LLMProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  enabled?: boolean;
  timeoutMs?: number;
}

export type RedactedWeek3LLMProviderConfig = Omit<Week3LLMProviderConfig, "apiKey"> & {
  apiKey?: string;
};

export interface Week3LLMChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Week3LLMChatRequest {
  purpose: Week3LLMPurpose;
  messages: Week3LLMChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Week3LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage?: Week3RuntimeUsage;
  status: "succeeded";
  latencyMs: number;
  raw?: unknown;
}

export interface Week3LLMConnectionTestResult {
  providerId: string;
  providerName: string;
  model: string;
  status: "succeeded" | "failed";
  latencyMs?: number;
  errorMessage?: string;
}

export interface Week3LLMProvider {
  readonly config: RedactedWeek3LLMProviderConfig;
  chat(request: Week3LLMChatRequest): Promise<Week3LLMChatResponse>;
  streamChat?(
    request: Week3LLMChatRequest,
    onDelta: (delta: string) => void | Promise<void>
  ): Promise<Week3LLMChatResponse>;
  testConnection?(signal?: AbortSignal): Promise<Week3LLMConnectionTestResult>;
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

export type LLMProviderKind = Week3LLMProviderKind;
export type LLMPurpose = Week3LLMPurpose;
export type LLMProviderConfig = Week3LLMProviderConfig;
export type RedactedLLMProviderConfig = RedactedWeek3LLMProviderConfig;
export type LLMChatMessage = Week3LLMChatMessage;
export type LLMChatRequest = Week3LLMChatRequest;
export type LLMUsageInfo = Required<Week3RuntimeUsage>;
export type LLMChatResponse = Week3LLMChatResponse;
export type LLMConnectionTestResult = Week3LLMConnectionTestResult;
export type LLMProvider = Week3LLMProvider;
