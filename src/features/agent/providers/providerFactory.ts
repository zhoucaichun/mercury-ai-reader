import { MockLLMProvider } from "./mockProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";
import type { Week3LLMProvider, Week3LLMProviderConfig } from "./types";
import { validateProviderConfig } from "./config";

export function createLLMProvider(
  config: Week3LLMProviderConfig,
  options: {
    env?: Record<string, string | undefined>;
    fetcher?: typeof fetch;
  } = {},
): Week3LLMProvider {
  const errors = validateProviderConfig(config);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  if (config.kind === "mock") {
    return new MockLLMProvider(config);
  }

  return new OpenAICompatibleProvider(config, options);
}

export const createWeek3LLMProvider = createLLMProvider;
