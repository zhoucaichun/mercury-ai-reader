export type FeedFormat = "rss" | "atom" | "json";

export type FeedSource = "manual" | "opml" | "mock";

export type ISODateString = string;

export type FeedErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "HTTP_ERROR"
  | "PARSE_FAILED"
  | "EMPTY_FEED";

export type FeedWarningCode =
  | "ARTICLE_DUPLICATE"
  | "ARTICLE_MISSING_TITLE"
  | "ARTICLE_MISSING_LINK"
  | "ARTICLE_INVALID_DATE";

export interface FeedWarning {
  code: FeedWarningCode;
  message: string;
  itemIndex?: number;
  value?: string;
}

export interface StandardFeed {
  id: string;
  url: string;
  title: string;
  format: FeedFormat;
  fetchedAt: string;
  requestedUrl?: string;
  siteUrl?: string;
  description?: string;
  language?: string;
  imageUrl?: string;
}

export interface StandardArticle {
  id: string;
  feedId: string;
  feedUrl: string;
  title: string;
  url: string;
  guid?: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  contentText?: string;
  publishedAt?: string;
  updatedAt?: string;
  categories: string[];
  imageUrl?: string;
}

export type ParsedArticle = StandardArticle;

export interface ParsedFeed {
  feed: StandardFeed;
  articles: ParsedArticle[];
  duplicateArticleCount: number;
  warnings: FeedWarning[];
}

export interface Week2ParsedArticle {
  id?: string;
  feedId?: string;
  guid?: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  contentText?: string;
  publishedAt?: ISODateString;
  updatedAt?: ISODateString;
  tags?: string[];
}

export interface Week2ParsedFeed {
  feed: {
    title: string;
    feedUrl: string;
    siteUrl?: string;
    fetchedAt: ISODateString;
  };
  articles: Week2ParsedArticle[];
  warnings: string[];
}

export interface Week2FeedParser {
  parseFeedUrl(feedUrl: string): Promise<Week2ParsedFeed>;
  parseFeedText(feedText: string, sourceUrl?: string): Promise<Week2ParsedFeed>;
}

export interface AddFeedResult extends ParsedFeed {
  source: FeedSource;
}

export interface FeedFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url?: string;
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}

export type FeedFetcher = (
  url: string,
  init: RequestInit,
) => Promise<FeedFetchResponse>;

export interface FeedFetchOptions {
  fetcher?: FeedFetcher;
  timeoutMs?: number;
  userAgent?: string;
}

export interface ParseFeedTextOptions {
  fetchedAt?: Date;
  requestedUrl?: string;
}

export interface ParseFeedUrlOptions extends FeedFetchOptions {
  source?: FeedSource;
}
