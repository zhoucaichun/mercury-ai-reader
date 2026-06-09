// T11 Translation smoke test - Week 3
//
// Usage: npx tsx scripts/smoke-translation.ts
// Uses MockLLMProvider, so no real API key is required.

import {
  createMockTranslationAgent,
  createTranslateArticle,
} from "../src/features/agent/translation/index";

async function main() {
  console.log("=== T11 Translation Smoke Test ===\n");

  const testArticle = {
    articleId: "article-test-001",
    contentId: "content-test-001",
    title: "Designing a Local-First Sync Loop",
    sourceUrl: "https://example.com/local-first/sync-loop",
    canonicalMarkdown: [
      "# Designing a Local-First Sync Loop",
      "",
      "Mercury keeps feed metadata, article records, cleaned content,",
      "and AI results on the user device first.",
      "",
      "Sync starts with a feed URL, normalizes article metadata,",
      "then stores records through the local persistence layer.",
      "",
      "The first mock keeps those boundaries visible so T2, T3, T5,",
      "and T7 can integrate gradually.",
    ].join("\n"),
    targetLanguage: "zh-CN",
  };

  console.log("--- Test 1: Direct Provider path ---");
  const mockAgent = createMockTranslationAgent();
  const result1 = await mockAgent.translate(testArticle);

  console.log(`status: ${result1.status}`);
  if (result1.result) {
    console.log(`provider: ${result1.result.providerId} / ${result1.result.model}`);
    console.log(
      `tokens: ${result1.result.promptTokens ?? "?"} prompt + ${
        result1.result.completionTokens ?? "?"
      } completion = ${result1.result.totalTokens ?? "?"} total`,
    );
    console.log(`estimated: ${result1.result.estimated}`);
    console.log("markdown (first 300 chars):");
    console.log(result1.result.markdown.slice(0, 300));
  } else {
    console.log(`error: ${result1.errorMessage}`);
  }

  console.log("");
  console.log("--- Test 2: translateArticle() fallback path ---");
  const { translateArticle } = createTranslateArticle();
  try {
    const result2 = await translateArticle(testArticle);
    console.log("status: succeeded");
    console.log(`provider: ${result2.providerId} / ${result2.model}`);
    console.log(
      `tokens: ${result2.promptTokens ?? "?"} prompt + ${
        result2.completionTokens ?? "?"
      } completion`,
    );
    console.log(`markdown length: ${result2.markdown.length} chars`);
    console.log("PASSED: translateArticle() fallback path works");
  } catch (error) {
    console.log(`FAILED: ${error}`);
  }

  console.log("");
  console.log("--- Test 3: Failure path ---");
  const failArticle = {
    ...testArticle,
    canonicalMarkdown: "[mock-fail] This triggers mock failure",
  };
  const failResult = await mockAgent.translate(failArticle);
  console.log(`status: ${failResult.status}`);
  console.log(`errorMessage: ${failResult.errorMessage}`);
  if (failResult.status === "failed") {
    console.log("PASSED: failure path works");
  } else {
    console.log("UNEXPECTED: should have failed");
  }

  console.log("\n=== Smoke test complete ===");
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
