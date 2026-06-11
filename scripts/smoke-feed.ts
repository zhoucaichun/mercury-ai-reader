import { addFeedUrl, isFeedError } from "../src/features/feed/parser/index.js";

const defaultFeeds = [
  "https://hnrss.org/frontpage",
  "https://xkcd.com/atom.xml",
  "https://www.theverge.com/rss/index.xml",
];

const feeds = process.argv.slice(2);
const targets = feeds.length > 0 ? feeds : defaultFeeds;

let failed = false;

async function main() {
  for (const feedUrl of targets) {
    try {
      const parsed = await addFeedUrl(feedUrl, {
        timeoutMs: 20_000,
      });
      const firstArticle = parsed.articles[0];

      console.log(
        [
          "OK",
          parsed.feed.format.toUpperCase(),
          parsed.feed.title,
          `${parsed.articles.length} articles`,
          firstArticle ? `first="${firstArticle.title}"` : "no first article",
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

void main();
