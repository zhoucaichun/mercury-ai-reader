import type {
  LLMProviderConfig,
  RedactedLLMProviderConfig,
} from "./types";

export interface LLMProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyEnv?: string;
  note: string;
}

export const LLM_PROVIDER_PRESETS: LLMProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    note: "OpenAI-compatible remote provider.",
  },
  {
    id: "school-compatible",
    name: "School model endpoint",
    baseUrl: "https://<school-llm-endpoint>/v1",
    model: "<model-name>",
    apiKeyEnv: "SCHOOL_LLM_API_KEY",
    note: "Replace endpoint and model with the course-provided values.",
  },
  {
    id: "hymt2",
    name: "hymt2 compatible endpoint",
    baseUrl: "https://<hymt2-endpoint>/v1",
    model: "<hymt2-model>",
    apiKeyEnv: "HYMT2_API_KEY",
    note: "Keep this as a connection-test template until endpoint details are confirmed.",
  },
  {
    id: "ollama-local",
    name: "Ollama local",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    note: "Local OpenAI-compatible endpoint; API key can be any non-empty local value.",
  },
];

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function chatCompletionsUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

export function resolveProviderConfig(
  config: LLMProviderConfig,
  env: Record<string, string | undefined> = {},
): LLMProviderConfig {
  const apiKeyFromEnv = config.apiKeyEnv ? env[config.apiKeyEnv] : undefined;

  return {
    ...config,
    baseUrl: normalizeBaseUrl(config.baseUrl),
    apiKey: config.apiKey ?? apiKeyFromEnv,
    timeoutMs: config.timeoutMs ?? 30_000,
  };
}

export function redactApiKey(apiKey?: string): string | undefined {
  if (!apiKey) {
    return undefined;
  }

  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

export function redactProviderConfig(
  config: LLMProviderConfig,
): RedactedLLMProviderConfig {
  return {
    ...config,
    apiKey: redactApiKey(config.apiKey),
  };
}

export function validateProviderConfig(config: LLMProviderConfig): string[] {
  const errors: string[] = [];

  if (!config.id.trim()) {
    errors.push("Provider id is required.");
  }

  if (!config.name.trim()) {
    errors.push("Provider name is required.");
  }

  if (!config.baseUrl.trim()) {
    errors.push("Base URL is required.");
  }

  if (!config.model.trim()) {
    errors.push("Model is required.");
  }

  return errors;
}
