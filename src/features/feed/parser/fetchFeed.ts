import { fetch as undiciFetch } from "undici";
import { FeedError } from "./errors.js";
import type { FeedFetchOptions } from "./types.js";
import { normalizeFeedUrl } from "./utils.js";

export interface FeedFetchResult {
  requestedUrl: string;
  finalUrl: string;
  contentType?: string;
  body: string;
  fetchedAt: Date;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_USER_AGENT = "MercuryAIReader/0.1 (+https://github.com/zhoukang/mercury-ai-reader)";

export async function fetchFeedText(
  inputUrl: string,
  options: FeedFetchOptions = {},
): Promise<FeedFetchResult> {
  const requestedUrl = normalizeFeedUrl(inputUrl);
  const fetcher = options.fetcher ?? undiciFetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(requestedUrl, {
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, */*;q=0.8",
        "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new FeedError(
        "HTTP_ERROR",
        `Feed request failed with HTTP ${response.status} ${response.statusText}`.trim(),
        {
          feedUrl: requestedUrl,
          status: response.status,
        },
      );
    }

    const body = await response.text();

    if (!body.trim()) {
      throw new FeedError("EMPTY_FEED", "Feed response was empty.", { feedUrl: requestedUrl });
    }

    return {
      requestedUrl,
      finalUrl: normalizeFeedUrl(response.url || requestedUrl),
      contentType: response.headers.get("content-type") ?? undefined,
      body,
      fetchedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof FeedError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new FeedError(
        "FETCH_TIMEOUT",
        `Feed request timed out after ${timeoutMs}ms.`,
        { feedUrl: requestedUrl, cause: error },
      );
    }

    throw new FeedError("FETCH_FAILED", "Feed request failed.", {
      feedUrl: requestedUrl,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
