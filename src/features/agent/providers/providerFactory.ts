import { MockLLMProvider } from "./mockProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";
import type { LLMProvider, LLMProviderConfig } from "./types";
import { validateProviderConfig } from "./config";

export function createLLMProvider(
  config: LLMProviderConfig,
  options: {
    env?: Record<string, string | undefined>;
    fetcher?: typeof fetch;
  } = {},
): LLMProvider {
  const errors = validateProviderConfig(config);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  if (config.kind === "mock") {
    return new MockLLMProvider(config);
  }

  return new OpenAICompatibleProvider(config, options);
}
