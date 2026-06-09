// ─── Agent feature barrel ────────────────────────────────────────────
// Re-exports from T8 (Runtime), T9 (Provider), T11 (Translation).
// Week 3 contracts per AGENTS.md 5B follow below.

export * from './providers';
export * from './translation';

export type ProviderCallStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export type {
  AgentStatus,
  PersistedAgentStatus,
  AgentType,
  AgentErrorCode,
  RuntimeUsage,
  RuntimeLLMResult,
  AgentRunInput,
  AgentRunResult,
  PromptTemplateMessage,
  PromptTemplate,
  LLMChatProvider,
  AgentRuntime,
} from "./runtime/types";
export * from "./runtime/runner";
export * from "./prompts";

// ══════════════════════════════════════════════════════════════════════
// Week 3 AI / Export / Usage Integration Contract (AGENTS.md 5B)
// Used by T7 (Reader UI), T10 (Summary), T11 (Translation/Export).
// Naming mirrors AGENTS.md 5B exactly; implementations may also use
// the shorter T8/T9 internal types above for internal wiring.
// ══════════════════════════════════════════════════════════════════════

// ─── Shared primitives ───────────────────────────────────────────────

export type Week3ISODateString = string;

export type Week3AgentType = 'summary' | 'translation';

export type Week3AgentStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type Week3PersistedAgentStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type Week3AgentErrorCode =
  | 'provider_error'
  | 'network_error'
  | 'prompt_error'
  | 'timeout'
  | 'cancelled'
  | 'unknown_error';

// ─── Article input (shared by Summary & Translation) ──────────────────

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

// ─── Agent Runtime (T8) ──────────────────────────────────────────────

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
  templateId: 'summary.default' | 'translation.default' | string;
  input: TInput;
  providerId: string;
  providerName?: string;
  model: string;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Week3AgentRunResult<TOutput = Week3RuntimeLLMResult> {
  taskId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  output?: TOutput;
  errorCode?: Week3AgentErrorCode;
  errorMessage?: string;
}

export interface Week3AgentRuntime {
  runAgent<TInput, TOutput = Week3RuntimeLLMResult>(
    input: Week3AgentRunInput<TInput>,
  ): Promise<Week3AgentRunResult<TOutput>>;
}

// ─── LLM Provider (T9) ───────────────────────────────────────────────

export type Week3LLMPurpose = 'summary' | 'translation' | 'connection-test' | 'other';
export type Week3LLMProviderKind = 'openai-compatible' | 'mock';

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

export interface Week3LLMChatRequest {
  purpose: Week3LLMPurpose;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
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
  status: 'succeeded';
  latencyMs: number;
  raw?: unknown;
}

export interface Week3LLMConnectionTestResult {
  providerId: string;
  providerName: string;
  model: string;
  status: 'succeeded' | 'failed';
  latencyMs?: number;
  errorMessage?: string;
}

export interface Week3LLMProvider {
  readonly config: Week3LLMProviderConfig;
  chat(request: Week3LLMChatRequest): Promise<Week3LLMChatResponse>;
  testConnection?(signal?: AbortSignal): Promise<Week3LLMConnectionTestResult>;
}

// ─── Usage event (T9) ────────────────────────────────────────────────

export interface Week3LLMUsageEvent {
  id: string;
  purpose: Week3LLMPurpose;
  providerId: string;
  providerName: string;
  model: string;
  status: 'succeeded' | 'failed';
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
  byProvider: Array<{ providerId: string; providerName: string; calls: number; totalTokens: number }>;
  byModel: Array<{ model: string; calls: number; totalTokens: number }>;
  recent: Week3LLMUsageEvent[];
}

// ─── Translation (T11) ───────────────────────────────────────────────

export interface Week3TranslationRequest extends Week3AgentArticleInput {
  targetLanguage: string;
  sourceLanguage?: string;
  regenerate?: boolean;
}

export interface Week3TranslationResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  sourceLanguage?: string;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: Week3ISODateString;
  updatedAt: Week3ISODateString;
}

// ─── Markdown Export (T11) ───────────────────────────────────────────

export interface Week3MarkdownExportData {
  title: string;
  url: string;
  author?: string;
  publishedAt?: Week3ISODateString;
  feedTitle?: string;
  canonicalMarkdown: string;
  summaryMarkdown?: string;
  translationMarkdown?: string;
  exportedAt?: Week3ISODateString;
}

export interface Week3MarkdownExportFile {
  fileName: string;
  markdown: string;
}

// ─── Reader UI integration port (T7 → T10/T11) ──────────────────────

export interface Week3AgentUiPort {
  generateSummary(request: unknown): Promise<unknown>;
  translateArticle(request: Week3TranslationRequest): Promise<Week3TranslationResult>;
  listUsageEvents?(): Promise<Week3LLMUsageEvent[]>;
  getUsageSummary?(): Promise<Week3LLMUsageSummary>;
  exportCurrentArticle(data: Week3MarkdownExportData): Promise<Week3MarkdownExportFile>;
}

// ─── Feature metadata ────────────────────────────────────────────────

export const agentFeature = {
  key: 'agent',
  ownerTasks: ['T8', 'T9', 'T10', 'T11'],
  status: 'week3-contract'
} as const;
