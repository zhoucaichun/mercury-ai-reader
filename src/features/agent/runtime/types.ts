export type AgentStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type PersistedAgentStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentType = "summary" | "translation";

export type AgentErrorCode =
  | "provider_error"
  | "network_error"
  | "prompt_error"
  | "timeout"
  | "cancelled"
  | "unknown_error";

export interface RuntimeUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
}

export interface RuntimeLLMResult {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  usage?: RuntimeUsage;
  raw?: unknown;
}

export interface AgentRunInput<TInput = Record<string, unknown>> {
  taskId: string;
  agentType: AgentType;
  templateId: string;
  input: TInput;
  providerId: string;
  providerName?: string;
  model: string;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AgentRunResult<TOutput = RuntimeLLMResult> {
  taskId: string;
  status: Extract<AgentStatus, "succeeded" | "failed" | "cancelled">;
  output?: TOutput;
  errorCode?: AgentErrorCode;
  errorMessage?: string;
}

export interface PromptTemplateMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptTemplate {
  id: string;
  agentType: AgentType;
  system: string;
  user: string;
}

export interface LLMChatRequest {
  purpose: AgentType | "connection-test" | "other";
  messages: PromptTemplateMessage[];
  model?: string;
  metadata?: Record<string, string | number | boolean | null>;
  signal?: AbortSignal;
}

export interface LLMChatResponse {
  id?: string;
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage?: RuntimeUsage;
  status: "succeeded";
  latencyMs: number;
  raw?: unknown;
}

export interface LLMChatProvider {
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;
}

export interface AgentRuntime {
  runAgent<TInput, TOutput = RuntimeLLMResult>(
    input: AgentRunInput<TInput>,
  ): Promise<AgentRunResult<TOutput>>;
}
