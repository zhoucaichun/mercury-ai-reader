import {
  addFeedUrl,
  isFeedError,
  type ParsedFeed,
  type StandardArticle,
} from "../src/features/feed/parser/index.js";

const defaultFeeds = [
  "https://www.ruanyifeng.com/blog/atom.xml",
  "https://hnrss.org/frontpage",
  "https://xkcd.com/atom.xml",
];

const feeds = process.argv.slice(2);
const targets = feeds.length > 0 ? feeds : defaultFeeds;
const requiredArticleFields = [
  "title",
  "url",
  "summary",
  "contentHtml",
  "contentText",
  "publishedAt",
] as const;

let failed = false;

async function main(): Promise<void> {
  for (const feedUrl of targets) {
    try {
      const parsed = await addFeedUrl(feedUrl, {
        timeoutMs: 20_000,
      });
      const completeArticle = findArticleWithRequiredFields(parsed);

      if (!completeArticle) {
        failed = true;
        console.error(
          [
            "FAIL",
            feedUrl,
            "no article had all required fields",
            formatFieldCoverage(parsed),
          ].join(" | "),
        );
        continue;
      }

      console.log(
        [
          "OK",
          parsed.feed.format.toUpperCase(),
          parsed.feed.title,
          `${parsed.articles.length} articles`,
          `fields=${requiredArticleFields.join(",")}`,
          `checked="${completeArticle.title}"`,
          `warnings=${parsed.warnings.length}`,
        ].join(" | "),
      );
    } catch (error) {
      failed = true;

      if (isFeedError(error)) {
        console.error(`FAIL | ${feedUrl} | ${error.code} | ${error.message}`);
      } else {
        console.error(`FAIL | ${feedUrl} | ${String(error)}`);
      }
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

function findArticleWithRequiredFields(parsed: ParsedFeed): StandardArticle | undefined {
  return parsed.articles.find((article) =>
    requiredArticleFields.every((field) => hasText(article[field])),
  );
}

function formatFieldCoverage(parsed: ParsedFeed): string {
  return requiredArticleFields
    .map((field) => {
      const count = parsed.articles.filter((article) => hasText(article[field])).length;
      return `${field}=${count}/${parsed.articles.length}`;
    })
    .join(" ");
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

main().catch((error) => {
  console.error(`FAIL | smoke-feed | ${String(error)}`);
  process.exitCode = 1;
});
