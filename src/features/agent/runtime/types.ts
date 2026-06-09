export type Week3ISODateString = string;

export interface Week3AgentArticleInput {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: Week3ISODateString;
  canonicalMarkdown: string;
}

export type Week3AgentType = "summary" | "translation";

export type Week3AgentStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type Week3PersistedAgentStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type Week3AgentErrorCode =
  | "provider_error"
  | "network_error"
  | "prompt_error"
  | "timeout"
  | "cancelled"
  | "unknown_error";

export interface Week3RuntimeUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
}

export interface Week3RuntimeLLMResult {
  content: string;
  providerId: string;
  providerName: string;
  model: string;
  usage?: Week3RuntimeUsage;
  raw?: unknown;
}

export interface Week3AgentRunInput<TInput = Record<string, unknown>> {
  taskId: string;
  agentType: Week3AgentType;
  templateId: "summary.default" | "translation.default" | string;
  input: TInput;
  providerId: string;
  providerName?: string;
  model: string;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Week3AgentRunResult<TOutput = Week3RuntimeLLMResult> {
  taskId: string;
  status: "succeeded" | "failed" | "cancelled";
  output?: TOutput;
  errorCode?: Week3AgentErrorCode;
  errorMessage?: string;
}

export interface Week3AgentRuntime {
  runAgent<TInput, TOutput = Week3RuntimeLLMResult>(
    input: Week3AgentRunInput<TInput>,
  ): Promise<Week3AgentRunResult<TOutput>>;
}

export type Week3LLMPurpose =
  | "summary"
  | "translation"
  | "connection-test"
  | "other";

export type Week3LLMProviderKind = "openai-compatible" | "mock";

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

export interface Week3PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Week3LLMChatRequest {
  purpose: Week3LLMPurpose;
  messages: Week3PromptMessage[];
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
  readonly config: Week3LLMProviderConfig;
  chat(request: Week3LLMChatRequest): Promise<Week3LLMChatResponse>;
  testConnection?(signal?: AbortSignal): Promise<Week3LLMConnectionTestResult>;
}

export interface Week3PromptTemplate {
  id: string;
  agentType: Week3AgentType;
  version?: number;
  description?: string;
  input: string[];
  system: string;
  user: string;
}

export interface Week3PromptLoadOptions {
  baseDir?: string;
}

export interface Week3RuntimeTaskState {
  taskId: string;
  status: Week3AgentStatus;
  errorCode?: Week3AgentErrorCode;
  errorMessage?: string;
}

export type AgentStatus = Week3AgentStatus;
export type PersistedAgentStatus = Week3PersistedAgentStatus;
export type AgentType = Week3AgentType;
export type AgentErrorCode = Week3AgentErrorCode;
export type RuntimeUsage = Week3RuntimeUsage;
export type RuntimeLLMResult = Week3RuntimeLLMResult;
export type AgentRunInput<TInput = Record<string, unknown>> =
  Week3AgentRunInput<TInput>;
export type AgentRunResult<TOutput = RuntimeLLMResult> =
  Week3AgentRunResult<TOutput>;
export type PromptTemplateMessage = Week3PromptMessage;
export type PromptTemplate = Week3PromptTemplate;
export type LLMChatProvider = Week3LLMProvider;
export type AgentRuntime = Week3AgentRuntime;
