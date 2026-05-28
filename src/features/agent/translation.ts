// T11 Translation Agent — Week 1 mock flow
//
// Design principle:
//   T11 does NOT write its own fetch / model-call logic.
//   All LLM calls go through T9's unified LLMProvider.chat() interface.
//   Usage recording goes through T9's LLMUsageEventStore.
//   Prompt rendering will go through T8's template engine (TBD).
//
// T9 alignment:
//   Field names match T9's src/features/llm/types.ts:
//     LLMChatRequest  { purpose, messages, model?, ... }
//     LLMChatResponse { content, providerId, providerName, model, usage, ... }
//     LLMUsageInfo    { promptTokens, completionTokens, totalTokens, estimated }
//   After merge, imports switch to src/features/llm/.

import type {
  LLMChatRequest,
  LLMChatResponse,
  LLMProvider,
  LLMUsageEventStore,
} from './index';
import {
  InMemoryUsageStore,
  recordFailedUsage,
  recordUsageFromResponse,
} from './index';
import type { ProviderCallStatus } from './index';

// ─── Translation-specific types ──────────────────────────────────────

export type TranslationCallInput = {
  articleId: string;
  articleTitle: string;
  canonicalMarkdown: string;   // from T6 Reader Pipeline
  targetLanguage: string;       // e.g. 'zh-CN'
  sourceLanguage?: string;      // default: 'auto'
  providerId: string;
  model: string;
};

export type TranslationCallState = {
  status: ProviderCallStatus;
  translatedText?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimated: boolean;
  };
  providerId?: string;
  model?: string;
  errorMessage?: string;
};

// ─── Translation Agent factory ───────────────────────────────────────
//   Accepts T9 Provider + optional UsageStore via dependency injection.
//   Summary Agent (T10) follows the same pattern.

export function createTranslationAgent(deps: {
  provider: LLMProvider;
  usageStore?: LLMUsageEventStore;
}) {
  const { provider, usageStore } = deps;

  // Build system + user messages from translation input.
  // ▸ T8 replacement: in Week 3-4, the system prompt is rendered from
  //   resources/prompts/translation.default.yaml by T8's template engine.
  function buildChatRequest(input: TranslationCallInput): LLMChatRequest {
    const sourceLang = input.sourceLanguage ?? 'auto';
    return {
      purpose: 'translation',
      messages: [
        {
          role: 'system',
          content: [
            `You are a professional translator.`,
            `Translate the following article from ${sourceLang} to ${input.targetLanguage}.`,
            `Preserve the original Markdown formatting (headings, lists, links, code blocks).`,
            `Keep technical terms accurate. Do not add commentary. Output ONLY the translated text.`,
          ].join(' '),
        },
        {
          role: 'user',
          content: input.canonicalMarkdown,
        },
      ],
      model: input.model,
      metadata: {
        articleId: input.articleId,
        articleTitle: input.articleTitle,
        targetLanguage: input.targetLanguage,
      },
    };
  }

  async function translate(
    input: TranslationCallInput,
  ): Promise<TranslationCallState> {
    const startedAt = new Date();
    const request = buildChatRequest(input);

    try {
      // ▸ T9: unified Provider call — NOT fetch directly
      const response: LLMChatResponse = await provider.chat(request);

      // ▸ T9: record usage event
      await recordUsageFromResponse(request, response, startedAt, usageStore);

      return {
        status: 'succeeded',
        translatedText: response.content,
        usage: response.usage,
        providerId: response.providerId,
        model: response.model,
      };
    } catch (error) {
      await recordFailedUsage(
        request,
        { id: input.providerId, name: provider.config.name, model: input.model },
        startedAt,
        error,
        usageStore,
      );

      return {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        providerId: input.providerId,
        model: input.model,
      };
    }
  }

  async function regenerate(input: TranslationCallInput): Promise<TranslationCallState> {
    return translate(input);
  }

  return { translate, regenerate };
}

// ─── Mock LLM Provider (compatible with T9's MockLLMProvider) ────────
//   In production, this is replaced by T9's createLLMProvider(config).
//   Kept here so T11 is self-contained for Week 1 demo.

export function createMockLLMProvider(config?: {
  id?: string;
  name?: string;
  model?: string;
}): LLMProvider {
  const resolved = {
    id: config?.id ?? 'mock-provider',
    name: config?.name ?? 'Mock Provider',
    model: config?.model ?? 'mock-model',
  };

  async function chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 1200));

    const prompt = request.messages.map((m) => m.content).join('\n');

    // Test hook: include [mock-fail] in prompt to trigger failure
    if (prompt.includes('[mock-fail]')) {
      throw new Error('Mock provider failure requested.');
    }

    // Generate mock translated content
    const clipped = prompt.replace(/\s+/g, ' ').slice(0, 120);
    const mockContent = request.purpose === 'translation'
      ? `[Mock Translation]\n\n${clipped}\n\n---\n*This is a mock translation for Week 1 demo. Real translation will use T9's OpenAI-compatible Provider.*`
      : `Mock response: ${clipped}`;

    // Rough token estimate
    const promptTokens = Math.ceil(prompt.length / 3);
    const completionTokens = Math.ceil(mockContent.length / 3);

    return {
      id: `mock-${Date.now()}`,
      providerId: resolved.id,
      providerName: resolved.name,
      model: request.model ?? resolved.model,
      content: mockContent,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimated: true, // T9: "estimated" not "isEstimated"
      },
      status: 'succeeded',
      latencyMs: 1200,
    };
  }

  return {
    config: { ...resolved, kind: 'mock', baseUrl: 'mock://local', apiKey: undefined },
    chat,
  };
}

// ─── Singleton for mock usage ─────────────────────────────────────────

const mockProvider = createMockLLMProvider();
const mockUsageStore = new InMemoryUsageStore();

export const translationAgent = createTranslationAgent({
  provider: mockProvider,
  usageStore: mockUsageStore,
});
