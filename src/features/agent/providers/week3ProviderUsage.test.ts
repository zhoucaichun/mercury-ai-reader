import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "./mockProvider";
import { OpenAICompatibleProvider } from "./openAICompatibleProvider";
import {
  LLMProviderError,
  type Week3LLMProviderConfig,
} from "./types";
import { redactProviderConfig, resolveProviderConfig } from "./config";
import {
  callLLMWithUsage,
  InMemoryLLMUsageEventStore,
  summarizeUsage,
  testLLMConnectionWithUsage,
} from "../../usage/usage";

function mockConfig(
  overrides: Partial<Week3LLMProviderConfig> = {},
): Week3LLMProviderConfig {
  return {
    providerId: "mock-provider",
    providerName: "Mock Provider",
    kind: "mock",
    baseUrl: "mock://local",
    model: "mock-model",
    ...overrides,
  };
}

describe("Week3 LLM provider and usage contract", () => {
  it("records a complete usage event for successful mock provider calls", async () => {
    const provider = new MockLLMProvider(mockConfig());
    const usageStore = new InMemoryLLMUsageEventStore();

    const response = await callLLMWithUsage(
      provider,
      {
        purpose: "summary",
        messages: [{ role: "user", content: "Summarize this article." }],
        metadata: {
          taskId: "task-1",
          articleId: "article-1",
          contentId: "content-1",
          agentType: "summary",
        },
      },
      usageStore,
    );

    const events = await usageStore.list();

    expect(response.content).toContain("Mock summary");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      purpose: "summary",
      providerId: "mock-provider",
      providerName: "Mock Provider",
      model: "mock-model",
      status: "succeeded",
      estimated: true,
      metadata: {
        taskId: "task-1",
        articleId: "article-1",
        contentId: "content-1",
        agentType: "summary",
      },
    });
    expect(events[0]?.promptTokens).toBeGreaterThan(0);
    expect(events[0]?.completionTokens).toBeGreaterThan(0);
    expect(events[0]?.totalTokens).toBeGreaterThan(0);
    expect(events[0]?.startedAt).toBeTruthy();
    expect(events[0]?.finishedAt).toBeTruthy();
    expect(events[0]?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failed usage event for mock provider failures", async () => {
    const provider = new MockLLMProvider(mockConfig());
    const usageStore = new InMemoryLLMUsageEventStore();

    await expect(
      callLLMWithUsage(
        provider,
        {
          purpose: "translation",
          messages: [{ role: "user", content: "[mock-fail]" }],
          metadata: {
            taskId: "task-2",
            articleId: "article-2",
            agentType: "translation",
          },
        },
        usageStore,
      ),
    ).rejects.toThrow(LLMProviderError);

    const events = await usageStore.list();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      purpose: "translation",
      providerId: "mock-provider",
      providerName: "Mock Provider",
      model: "mock-model",
      status: "failed",
      completionTokens: 0,
      estimated: true,
      metadata: {
        taskId: "task-2",
        articleId: "article-2",
        agentType: "translation",
      },
    });
    expect(events[0]?.promptTokens).toBeGreaterThan(0);
    expect(events[0]?.errorMessage).toContain("Mock provider failure");
  });

  it("records connection-test usage through the Week3 helper", async () => {
    const provider = new MockLLMProvider(mockConfig());
    const usageStore = new InMemoryLLMUsageEventStore();

    const response = await testLLMConnectionWithUsage(provider, usageStore);
    const events = await usageStore.list();

    expect(response.content).toBe("OK");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      purpose: "connection-test",
      providerId: "mock-provider",
      providerName: "Mock Provider",
      model: "mock-model",
      status: "succeeded",
    });
  });

  it("summarizes only provided usage events", async () => {
    const provider = new MockLLMProvider(mockConfig());
    const usageStore = new InMemoryLLMUsageEventStore();

    await callLLMWithUsage(
      provider,
      {
        purpose: "summary",
        messages: [{ role: "user", content: "Article A" }],
      },
      usageStore,
    );
    await callLLMWithUsage(
      provider,
      {
        purpose: "translation",
        messages: [{ role: "user", content: "Article B" }],
      },
      usageStore,
    );

    const summary = summarizeUsage(await usageStore.list());

    expect(summary.totalCalls).toBe(2);
    expect(summary.succeededCalls).toBe(2);
    expect(summary.failedCalls).toBe(0);
    expect(summary.totalTokens).toBeGreaterThan(0);
    expect(summary.byPurpose.map((row) => row.purpose)).toEqual(
      expect.arrayContaining(["summary", "translation"]),
    );
    expect(summary.byProvider[0]).toMatchObject({
      providerId: "mock-provider",
      providerName: "Mock Provider",
      calls: 2,
    });
  });

  it("resolves API key from env and redacts config before exposure", () => {
    const resolved = resolveProviderConfig(
      mockConfig({
        kind: "openai-compatible",
        baseUrl: "https://api.example.com/v1/",
        apiKeyEnv: "MERCURY_TEST_API_KEY",
      }),
      {
        MERCURY_TEST_API_KEY: "<your-api-key>",
      },
    );
    const redacted = redactProviderConfig(resolved);

    expect(resolved.baseUrl).toBe("https://api.example.com/v1");
    expect(resolved.apiKey).toBe("<your-api-key>");
    expect(redacted.apiKey).not.toBe(resolved.apiKey);
    expect(redacted.apiKey).toBe("<redacted>");
  });

  it("maps OpenAI-compatible request timeout to timeout error code", async () => {
    const provider = new OpenAICompatibleProvider(
      mockConfig({
        kind: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        apiKey: "<your-api-key>",
        timeoutMs: 1,
      }),
      {
        fetcher: (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      },
    );

    await expect(
      provider.chat({
        purpose: "summary",
        messages: [{ role: "user", content: "Article" }],
      }),
    ).rejects.toMatchObject({
      code: "timeout",
      retryable: true,
    });
  });
});
