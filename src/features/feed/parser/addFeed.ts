import { fetchFeedText } from "./fetchFeed.js";
import { parseFeedText } from "./parser.js";
import type { AddFeedResult, ParsedFeed, ParseFeedUrlOptions } from "./types.js";

export async function parseFeedUrl(
  inputUrl: string,
  options: ParseFeedUrlOptions = {},
): Promise<ParsedFeed> {
  const fetched = await fetchFeedText(inputUrl, options);

  return parseFeedText(fetched.body, fetched.finalUrl, {
    fetchedAt: fetched.fetchedAt,
    requestedUrl: fetched.requestedUrl,
  });
}

export async function addFeedUrl(
  inputUrl: string,
  options: ParseFeedUrlOptions = {},
): Promise<AddFeedResult> {
  const parsed = await parseFeedUrl(inputUrl, options);

  return {
    ...parsed,
    source: options.source ?? "manual",
  };
}
