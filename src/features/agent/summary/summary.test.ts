import { describe, expect, it } from "vitest";
import { createSummaryAgent, type SummaryRequest } from ".";
import type {
  AgentRunInput,
  AgentRunResult,
  AgentRuntime,
  RuntimeLLMResult,
} from "../runtime/types";
import { InMemoryLLMUsageEventStore } from "../../usage/usage";

const baseRequest: SummaryRequest = {
  articleId: "article-2",
  contentId: "content-2",
  title: "A real synced article",
  sourceUrl: "https://example.com/article-2",
  canonicalMarkdown: "# A real synced article\n\nThis is canonicalMarkdown from the selected article.",
  targetLanguage: "zh-CN",
  detailLevel: "standard",
};

describe("Summary Agent", () => {
  it("generates a Week3SummaryResult from the selected article canonicalMarkdown", async () => {
    const usageStore = new InMemoryLLMUsageEventStore();
    const agent = createSummaryAgent({
      runtime: createRuntimeReturning((input) => {
        return `## Summary for ${input.articleId}\n\n${input.canonicalMarkdown}`;
      }),
      usageStore,
      now: fixedNow(),
      idFactory: () => "summary-result-fixed",
    });

    const output = await agent.generateSummary(baseRequest);
    const usageEvents = await usageStore.list();

    expect(output.status).toBe("succeeded");
    expect(output.result).toMatchObject({
      id: "summary-result-fixed",
      articleId: "article-2",
      contentId: "content-2",
      taskRunId: expect.stringContaining("summary-article-2-generate"),
      detailLevel: "standard",
      targetLanguage: "zh-CN",
      markdown: expect.stringContaining("article-2"),
      providerId: "runtime-provider",
      providerName: "Runtime Provider",
      model: "mock-summary-v1",
    });
    expect(output.result?.markdown).toContain(baseRequest.canonicalMarkdown);
    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0]).toMatchObject({
      purpose: "summary",
      status: "succeeded",
      providerId: "runtime-provider",
      providerName: "Runtime Provider",
      model: "mock-summary-v1",
      estimated: true,
      metadata: {
        articleId: "article-2",
        contentId: "content-2",
        agentType: "summary",
        detailLevel: "standard",
      },
    });
  });

  it("keeps summaries tied to the selected article when switching articles", async () => {
    const agent = createSummaryAgent({
      runtime: createRuntimeReturning((input) => {
        return `## ${input.title}\n\narticleId=${input.articleId}`;
      }),
      now: fixedNow(),
    });

    const first = await agent.generateSummary({
      ...baseRequest,
      articleId: "article-2",
      title: "Second article",
    });
    const second = await agent.generateSummary({
      ...baseRequest,
      articleId: "article-3",
      contentId: "content-3",
      title: "Third article",
      canonicalMarkdown: "# Third article\n\nDifferent selected content.",
    });

    expect(first.result?.articleId).toBe("article-2");
    expect(first.result?.markdown).toContain("articleId=article-2");
    expect(second.result?.articleId).toBe("article-3");
    expect(second.result?.contentId).toBe("content-3");
    expect(second.result?.markdown).toContain("articleId=article-3");
    expect(second.result?.markdown).not.toContain("articleId=article-2");
  });

  it("supports brief and standard detail levels", async () => {
    const agent = createSummaryAgent({
      runtime: createRuntimeReturning((input) => {
        return `## ${input.detailLevel} summary\n\n${input.title}`;
      }),
      now: fixedNow(),
    });

    const brief = await agent.generateSummary({
      ...baseRequest,
      detailLevel: "brief",
    });
    const standard = await agent.generateSummary({
      ...baseRequest,
      detailLevel: "standard",
    });

    expect(brief.result?.detailLevel).toBe("brief");
    expect(brief.result?.markdown).toContain("brief summary");
    expect(standard.result?.detailLevel).toBe("standard");
    expect(standard.result?.markdown).toContain("standard summary");
  });

  it("returns failed status and usage event when canonicalMarkdown is empty", async () => {
    const usageStore = new InMemoryLLMUsageEventStore();
    const agent = createSummaryAgent({
      runtime: createRuntimeReturning(() => "should not be used"),
      usageStore,
      now: fixedNow(),
    });

    const output = await agent.generateSummary({
      ...baseRequest,
      canonicalMarkdown: " ",
    });
    const usageEvents = await usageStore.list();

    expect(output.status).toBe("failed");
    expect(output.errorMessage).toContain("canonicalMarkdown");
    expect(output.result).toBeUndefined();
    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0]).toMatchObject({
      purpose: "summary",
      status: "failed",
      errorMessage: expect.stringContaining("canonicalMarkdown"),
    });
  });
});

function createRuntimeReturning(
  render: (input: SummaryRequest) => string,
): AgentRuntime {
  return {
    async runAgent<TInput, TOutput = RuntimeLLMResult>(
      input: AgentRunInput<TInput>,
    ): Promise<AgentRunResult<TOutput>> {
      const summaryInput = input.input as SummaryRequest;
      const output: RuntimeLLMResult = {
        text: render(summaryInput),
        providerId: "runtime-provider",
        providerName: "Runtime Provider",
        model: input.model,
        usage: {
          promptTokens: 10,
          completionTokens: 12,
          totalTokens: 22,
          estimated: true,
        },
      };

      return {
        taskId: input.taskId,
        status: "succeeded",
        output: output as TOutput,
      };
    },
  };
}

function fixedNow(): () => Date {
  return () => new Date("2026-06-08T12:00:00.000Z");
}
