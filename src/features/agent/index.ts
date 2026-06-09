export * from './translation';
export {
  LLM_PROVIDER_PRESETS,
  chatCompletionsUrl,
  normalizeBaseUrl,
  redactApiKey,
  redactProviderConfig,
  resolveProviderConfig,
  validateProviderConfig,
  MockLLMProvider,
  OpenAICompatibleProvider,
  createLLMProvider,
  createWeek3LLMProvider,
  estimateTokensFromMessages,
  estimateTokensFromText
} from './providers';
export type {
  LLMChatMessage,
  LLMChatRequest,
  LLMChatResponse,
  LLMConnectionTestResult,
  LLMPurpose,
  LLMProvider,
  LLMProviderConfig,
  LLMProviderKind,
  LLMProviderPreset,
  LLMUsageInfo,
  RedactedLLMProviderConfig
} from './providers';

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

export * from "./runtime/types";
export * from "./runtime/runner";
export * from "./prompts";
