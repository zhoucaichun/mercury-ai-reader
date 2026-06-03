export * from './providers';

export type ProviderCallStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export type ProviderCallResult = {
  status: ProviderCallStatus;
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
};

export const agentFeature = {
  key: 'agent',
  ownerTasks: ['T8', 'T9', 'T10', 'T11'],
  status: 'provider-contract-placeholder'
} as const;

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
