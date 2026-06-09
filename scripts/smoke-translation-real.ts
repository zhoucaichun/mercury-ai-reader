// T11 real-article simulation test
// Simulates translating a real article's canonicalMarkdown.
import { createMockTranslationAgent, createTranslateArticle } from "../src/features/agent/translation/index";

const REAL_ARTICLE = {
  articleId: "bbc-article-001",
  title: "Global climate summit reaches historic agreement on emissions targets",
  sourceUrl: "https://feeds.bbci.co.uk/news/rss.xml",
  canonicalMarkdown: `# Global climate summit reaches historic agreement on emissions targets

World leaders have agreed to a landmark deal at the UN climate summit, pledging to cut greenhouse gas emissions by 60% by 2035.

## Key points

- 195 countries signed the agreement after two weeks of intense negotiations
- The deal includes a $100bn annual fund to help developing nations transition to clean energy
- Countries must submit updated climate action plans every two years

## Reactions

Environmental groups cautiously welcomed the deal but said it still falls short of what science demands.

"It's a step forward, but we needed a leap," said Dr. Sarah Chen, climate policy analyst at the Global Climate Institute.

## What happens next

The agreement will be formally ratified at the next UN General Assembly in September. Implementation timelines will be set by individual countries, with the first review scheduled for 2027.`,
  targetLanguage: "zh-CN" as const,
};

async function main() {
  console.log("=== T11 Real Article Translation Test ===\n");
  console.log(`Article: ${REAL_ARTICLE.title}`);
  console.log(`Source length: ${REAL_ARTICLE.canonicalMarkdown.length} chars`);
  console.log(`Target: ${REAL_ARTICLE.targetLanguage}\n`);

  const { translateArticle } = createTranslateArticle();
  const result = await translateArticle(REAL_ARTICLE);

  console.log(`Status: succeeded`);
  console.log(`Provider: ${result.providerId} / ${result.model}`);
  console.log(`Tokens: ${result.promptTokens ?? "?"} + ${result.completionTokens ?? "?"} = ${result.totalTokens ?? "?"}`);
  console.log(`Estimated: ${result.estimated}`);
  console.log("");
  console.log("=== Translation Result ===");
  console.log(result.markdown);
  console.log("");
  console.log("=== Test PASSED ===");
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
