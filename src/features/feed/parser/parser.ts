import Parser from "rss-parser";
import { FeedError, isFeedError } from "./errors.js";
import type {
  FeedFormat,
  FeedWarning,
  ParsedFeed,
  ParseFeedTextOptions,
  StandardArticle,
  StandardFeed,
} from "./types.js";
import {
  cleanText,
  maybeNormalizeUrl,
  normalizeFeedUrl,
  stableId,
  stripHtml,
  toIsoDate,
  toStringArray,
  trimToLength,
} from "./utils.js";

interface RssParserOutput {
  title?: string;
  link?: string;
  description?: string;
  language?: string;
  image?: {
    url?: string;
    link?: string;
  };
  feedUrl?: string;
  items?: RssParserItem[];
  [key: string]: unknown;
}

interface RssParserItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  categories?: string[];
  enclosure?: {
    url?: string;
  };
  [key: string]: unknown;
}

interface JsonFeed {
  title?: string;
  home_page_url?: string;
  feed_url?: string;
  description?: string;
  language?: string;
  icon?: string;
  favicon?: string;
  items?: JsonFeedItem[];
}

interface JsonFeedAuthor {
  name?: string;
}

interface JsonFeedItem {
  id?: string;
  url?: string;
  external_url?: string;
  title?: string;
  content_html?: string;
  content_text?: string;
  summary?: string;
  date_published?: string;
  date_modified?: string;
  author?: JsonFeedAuthor;
  authors?: JsonFeedAuthor[];
  tags?: string[];
  image?: string;
  banner_image?: string;
}

const xmlParser = new Parser({
  customFields: {
    feed: ["subtitle", "updated", "icon", "logo"],
    item: [
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "dcCreator"],
      ["itunes:author", "itunesAuthor"],
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      "summary",
      "updated",
    ],
  },
});

export async function parseFeedText(
  body: string,
  feedUrlInput: string,
  options: ParseFeedTextOptions = {},
): Promise<ParsedFeed> {
  const feedUrl = normalizeFeedUrl(feedUrlInput);
  const requestedUrl = options.requestedUrl
    ? normalizeFeedUrl(options.requestedUrl)
    : undefined;
  const text = body.trim();

  if (!text) {
    throw new FeedError("EMPTY_FEED", "Feed content was empty.", { feedUrl });
  }

  const fetchedAt = (options.fetchedAt ?? new Date()).toISOString();
  const format = detectFeedFormat(text);

  try {
    if (format === "json") {
      return parseJsonFeed(text, feedUrl, fetchedAt, requestedUrl);
    }

    return await parseXmlFeed(text, feedUrl, fetchedAt, requestedUrl, format);
  } catch (error) {
    if (isFeedError(error)) {
      throw error;
    }

    throw new FeedError("PARSE_FAILED", "Feed content could not be parsed.", {
      feedUrl,
      cause: error,
    });
  }
}

function detectFeedFormat(text: string): FeedFormat {
  const probe = text.slice(0, 512).toLowerCase();

  if (probe.startsWith("{") || probe.startsWith("[")) {
    return "json";
  }

  if (/<feed[\s>]/i.test(probe)) {
    return "atom";
  }

  return "rss";
}

async function parseXmlFeed(
  text: string,
  feedUrl: string,
  fetchedAt: string,
  requestedUrl: string | undefined,
  format: FeedFormat,
): Promise<ParsedFeed> {
  const parsed = (await xmlParser.parseString(text)) as unknown as RssParserOutput;
  const warnings: FeedWarning[] = [];
  const siteUrl = maybeNormalizeUrl(parsed.link, feedUrl);
  const feed = buildFeed({
    feedUrl,
    requestedUrl,
    title: parsed.title,
    format,
    fetchedAt,
    siteUrl,
    description: parsed.description ?? parsed.subtitle,
    language: parsed.language,
    imageUrl: parsed.image?.url ?? parsed.icon ?? parsed.logo,
  });
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

  if (rawItems.length === 0) {
    throw new FeedError("EMPTY_FEED", "Feed did not contain any articles.", { feedUrl });
  }

  const articles = rawItems.map((item, index) =>
    normalizeXmlItem(item, index, feed, warnings, siteUrl),
  );

  return withDeduplicatedArticles(feed, articles, warnings);
}

function parseJsonFeed(
  text: string,
  feedUrl: string,
  fetchedAt: string,
  requestedUrl: string | undefined,
): ParsedFeed {
  let parsed: JsonFeed;

  try {
    parsed = JSON.parse(text) as JsonFeed;
  } catch (error) {
    throw new FeedError("PARSE_FAILED", "JSON Feed content was invalid JSON.", {
      feedUrl,
      cause: error,
    });
  }

  const warnings: FeedWarning[] = [];
  const siteUrl = maybeNormalizeUrl(parsed.home_page_url, feedUrl);
  const feed = buildFeed({
    feedUrl,
    requestedUrl,
    title: parsed.title,
    format: "json",
    fetchedAt,
    siteUrl,
    description: parsed.description,
    language: parsed.language,
    imageUrl: parsed.icon ?? parsed.favicon,
  });
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

  if (rawItems.length === 0) {
    throw new FeedError("EMPTY_FEED", "Feed did not contain any articles.", { feedUrl });
  }

  const articles = rawItems.map((item, index) =>
    normalizeJsonItem(item, index, feed, warnings, siteUrl),
  );

  return withDeduplicatedArticles(feed, articles, warnings);
}

function buildFeed(input: {
  feedUrl: string;
  requestedUrl?: string;
  title?: unknown;
  format: FeedFormat;
  fetchedAt: string;
  siteUrl?: string;
  description?: unknown;
  language?: unknown;
  imageUrl?: unknown;
}): StandardFeed {
  const title = cleanText(input.title) ?? new URL(input.feedUrl).hostname;
  const imageUrl = maybeNormalizeUrl(input.imageUrl, input.siteUrl ?? input.feedUrl);

  return {
    id: stableId("feed", input.feedUrl),
    url: input.feedUrl,
    requestedUrl: input.requestedUrl !== input.feedUrl ? input.requestedUrl : undefined,
    title,
    format: input.format,
    fetchedAt: input.fetchedAt,
    siteUrl: input.siteUrl,
    description: cleanText(input.description),
    language: cleanText(input.language),
    imageUrl,
  };
}

function normalizeXmlItem(
  item: RssParserItem,
  index: number,
  feed: StandardFeed,
  warnings: FeedWarning[],
  siteUrl: string | undefined,
): StandardArticle {
  const rawContentHtml = cleanText(item.contentEncoded ?? item.content ?? item.description);
  const rawContentText =
    cleanText(item.contentSnippet) ??
    stripHtml(item.summary) ??
    stripHtml(item.description) ??
    stripHtml(rawContentHtml);
  const rawSummary = trimToLength(
    stripHtml(item.summary) ?? stripHtml(item.description) ?? rawContentText,
    800,
  );
  const guid = cleanText(item.guid);
  const title = buildArticleTitle(item.title, rawSummary, index, warnings);
  const { contentHtml, contentText } = buildArticleContent({
    rawHtml: rawContentHtml,
    rawText: rawContentText,
    summary: rawSummary,
    title,
    index,
    warnings,
  });
  const summary = rawSummary ?? trimToLength(contentText, 800);
  const rawUrl = item.link ?? (looksLikeUrl(guid) ? guid : undefined);
  const url = buildArticleUrl(rawUrl, feed, index, title, guid, warnings, siteUrl);
  const publishedAt = toIsoDate(item.isoDate ?? item.pubDate, warnings, index);
  const updatedAt = toIsoDate(item.updated, warnings, index);

  return {
    id: stableId("article", feed.url, guid ?? url, title, publishedAt),
    feedId: feed.id,
    feedUrl: feed.url,
    title,
    url,
    guid,
    author: cleanText(item.creator ?? item.author ?? item.dcCreator ?? item.itunesAuthor),
    summary,
    contentHtml,
    contentText,
    publishedAt,
    updatedAt,
    categories: toStringArray(item.categories),
    imageUrl: extractImageUrl(item, feed.siteUrl ?? feed.url),
  };
}

function normalizeJsonItem(
  item: JsonFeedItem,
  index: number,
  feed: StandardFeed,
  warnings: FeedWarning[],
  siteUrl: string | undefined,
): StandardArticle {
  const rawContentHtml = cleanText(item.content_html);
  const rawContentText = cleanText(item.content_text) ?? stripHtml(rawContentHtml);
  const rawSummary = trimToLength(cleanText(item.summary) ?? rawContentText, 800);
  const guid = cleanText(item.id);
  const title = buildArticleTitle(item.title, rawSummary, index, warnings);
  const { contentHtml, contentText } = buildArticleContent({
    rawHtml: rawContentHtml,
    rawText: rawContentText,
    summary: rawSummary,
    title,
    index,
    warnings,
  });
  const summary = rawSummary ?? trimToLength(contentText, 800);
  const rawUrl = item.url ?? item.external_url ?? (looksLikeUrl(guid) ? guid : undefined);
  const url = buildArticleUrl(rawUrl, feed, index, title, guid, warnings, siteUrl);
  const publishedAt = toIsoDate(item.date_published, warnings, index);
  const updatedAt = toIsoDate(item.date_modified, warnings, index);

  return {
    id: stableId("article", feed.url, guid ?? url, title, publishedAt),
    feedId: feed.id,
    feedUrl: feed.url,
    title,
    url,
    guid,
    author: extractJsonAuthor(item),
    summary,
    contentHtml,
    contentText,
    publishedAt,
    updatedAt,
    categories: toStringArray(item.tags),
    imageUrl: maybeNormalizeUrl(item.image ?? item.banner_image, siteUrl ?? feed.url),
  };
}

function buildArticleTitle(
  rawTitle: unknown,
  summary: string | undefined,
  index: number,
  warnings: FeedWarning[],
): string {
  const title = cleanText(rawTitle);

  if (title) {
    return title;
  }

  warnings.push({
    code: "ARTICLE_MISSING_TITLE",
    message: `Article ${index + 1} did not include a title; a fallback title was generated.`,
    itemIndex: index,
  });

  return trimToLength(summary, 80) ?? `Untitled article ${index + 1}`;
}

function buildArticleContent(input: {
  rawHtml?: string;
  rawText?: string;
  summary?: string;
  title: string;
  index: number;
  warnings: FeedWarning[];
}): { contentHtml: string; contentText: string } {
  const rawHtml = cleanText(input.rawHtml);
  const contentText =
    cleanText(input.rawText) ??
    stripHtml(rawHtml) ??
    cleanText(input.summary) ??
    input.title;
  const contentHtml = rawHtml ?? `<p>${escapeHtml(contentText)}</p>`;

  if (!rawHtml || !cleanText(input.rawText)) {
    input.warnings.push({
      code: "ARTICLE_CONTENT_FALLBACK",
      message: `Article ${input.index + 1} did not include complete content fields; fallback content was generated.`,
      itemIndex: input.index,
    });
  }

  return {
    contentHtml,
    contentText,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildArticleUrl(
  rawUrl: unknown,
  feed: StandardFeed,
  index: number,
  title: string,
  guid: string | undefined,
  warnings: FeedWarning[],
  siteUrl: string | undefined,
): string {
  const url = maybeNormalizeUrl(rawUrl, siteUrl ?? feed.url);

  if (url) {
    return url;
  }

  warnings.push({
    code: "ARTICLE_MISSING_LINK",
    message: `Article ${index + 1} did not include a usable link; a stable local URL was generated.`,
    itemIndex: index,
  });

  return `${feed.url}#article-${stableId(guid, title, String(index))}`;
}

function withDeduplicatedArticles(
  feed: StandardFeed,
  articles: StandardArticle[],
  warnings: FeedWarning[],
): ParsedFeed {
  const seen = new Map<string, StandardArticle>();
  const deduped: StandardArticle[] = [];
  let duplicateArticleCount = 0;

  for (let index = 0; index < articles.length; index += 1) {
    const article = articles[index];

    if (!article) {
      continue;
    }

    const key = article.guid
      ? `guid:${article.guid.toLowerCase()}`
      : `url:${article.url.toLowerCase()}`;

    if (seen.has(key)) {
      duplicateArticleCount += 1;
      warnings.push({
        code: "ARTICLE_DUPLICATE",
        message: `Article ${index + 1} duplicates an earlier article and was skipped.`,
        itemIndex: index,
        value: article.url,
      });
      continue;
    }

    seen.set(key, article);
    deduped.push(article);
  }

  return {
    feed,
    articles: deduped,
    duplicateArticleCount,
    warnings,
  };
}

function extractJsonAuthor(item: JsonFeedItem): string | undefined {
  const authors = Array.isArray(item.authors)
    ? item.authors.map((author) => cleanText(author.name)).filter(Boolean)
    : [];

  if (authors.length > 0) {
    return authors.join(", ");
  }

  return cleanText(item.author?.name);
}

function extractImageUrl(item: RssParserItem, baseUrl: string): string | undefined {
  return (
    maybeNormalizeUrl(item.enclosure?.url, baseUrl) ??
    maybeNormalizeUrl(readMediaUrl(item.mediaContent), baseUrl) ??
    maybeNormalizeUrl(readMediaUrl(item.mediaThumbnail), baseUrl)
  );
}

function readMediaUrl(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = readMediaUrl(item);

      if (url) {
        return url;
      }
    }
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      cleanText(record.url) ??
      cleanText((record.$ as Record<string, unknown> | undefined)?.url)
    );
  }

  return cleanText(value);
}

function looksLikeUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
