export { addFeedUrl, parseFeedUrl } from "./addFeed.js";
export { FeedError, isFeedError } from "./errors.js";
export { fetchFeedText } from "./fetchFeed.js";
import { parseFeedUrl as parseStandardFeedUrl } from "./addFeed.js";
import { parseFeedText as parseStandardFeedText } from "./parser.js";
export { parseFeedText } from "./parser.js";
export { normalizeFeedUrl } from "./utils.js";
import type { ParsedFeed, Week2FeedParser, Week2ParsedFeed } from "./types.js";

const FALLBACK_SOURCE_URL = "https://example.invalid/feed.xml";

export const week2FeedParser: Week2FeedParser = {
  async parseFeedUrl(feedUrl) {
    return toWeek2ParsedFeed(await parseStandardFeedUrl(feedUrl));
  },
  async parseFeedText(feedText, sourceUrl = FALLBACK_SOURCE_URL) {
    return toWeek2ParsedFeed(await parseStandardFeedText(feedText, sourceUrl));
  },
};

function toWeek2ParsedFeed(parsed: ParsedFeed): Week2ParsedFeed {
  return {
    feed: {
      title: parsed.feed.title,
      feedUrl: parsed.feed.url,
      siteUrl: parsed.feed.siteUrl,
      fetchedAt: parsed.feed.fetchedAt,
    },
    articles: parsed.articles.map((article) => ({
      id: article.id,
      feedId: article.feedId,
      guid: article.guid,
      title: article.title,
      url: article.url,
      author: article.author,
      summary: article.summary,
      contentHtml: article.contentHtml,
      contentText: article.contentText,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      tags: article.categories,
    })),
    warnings: parsed.warnings.map((warning) => `${warning.code}: ${warning.message}`),
  };
}

export type {
  AddFeedResult,
  FeedErrorCode,
  FeedFetchOptions,
  FeedFetcher,
  FeedFormat,
  FeedSource,
  FeedWarning,
  FeedWarningCode,
  ParsedFeed,
  ParsedArticle,
  ParseFeedTextOptions,
  ParseFeedUrlOptions,
  StandardArticle,
  StandardFeed,
  Week2FeedParser,
  Week2ParsedArticle,
  Week2ParsedFeed,
} from "./types.js";
