# T3 Feed Parser

T3 owns Feed URL adding and RSS/Atom parsing. The module lives in `src/features/feed/parser` and exports a stable TypeScript contract for T4 OPML import and T5 Sync.

## Scope

- Add a user-provided Feed URL through `addFeedUrl`.
- Fetch Feed text with timeout, redirect, HTTP status, empty body, and network error handling.
- Parse RSS and Atom feeds through `rss-parser`.
- Optionally parse JSON Feed 1.x when the response body is JSON.
- Normalize Feed and article data into `StandardFeed` and `StandardArticle`.
- Deduplicate repeated articles by GUID first, then URL.
- Fill `summary`, `contentHtml`, and `contentText` fallbacks when real feeds omit body fields.
- Keep non-fatal issues as `FeedWarning` records, including missing titles, missing links, invalid dates, duplicate articles, and content fallback.

## Public API

```ts
import {
  addFeedUrl,
  parseFeedText,
  parseFeedUrl,
  week2FeedParser,
} from "./src/features/feed/parser/index.js";
```

- `addFeedUrl(url, options)` is the main entry for a manual Add Feed workflow.
- `parseFeedUrl(url, options)` fetches and parses a URL, returning `ParsedFeed`.
- `parseFeedText(body, feedUrl, options)` parses already-fetched text. T5 can use this in tests or when another module owns the fetch step.
- `week2FeedParser` implements the Week 2 `Week2FeedParser` contract required by `AGENTS.md`.

## Standard Output

`StandardFeed` includes:

- `id`
- `url`
- `title`
- `format`
- `fetchedAt`
- optional `requestedUrl`, `siteUrl`, `description`, `language`, `imageUrl`

`ParsedArticle` is currently an alias of `StandardArticle`. `StandardArticle` includes:

- `id`
- `feedId`
- `feedUrl`
- `title`
- `url`
- optional `guid`, `author`, `summary`, `contentHtml`, `contentText`, `publishedAt`, `updatedAt`, `imageUrl`
- `categories`

This is intentionally storage-neutral. T2 can map these fields to SQLite rows, and T5 can use `id`, `guid`, and `url` for sync deduplication.

For Week 3 regression, the parser attempts to keep `summary`, `contentHtml`, and `contentText` non-empty:

- RSS / Atom: `content:encoded` / `content` / `description` are preferred for HTML, then generated from plain text.
- JSON Feed: `content_html` is preferred for HTML, then generated from `content_text`, `summary`, or title.
- `summary` falls back to normalized `contentText` when a real feed only provides HTML content.
- A non-fatal `ARTICLE_CONTENT_FALLBACK` warning is recorded when fallback content is generated.

## Week 2 Contract

`src/features/feed/parser/index.ts` exports `week2FeedParser`:

```ts
type Week2FeedParser = {
  parseFeedUrl(inputUrl: string): Promise<Week2ParsedFeed>;
  parseFeedText(feedText: string, sourceUrl?: string): Promise<Week2ParsedFeed>;
};
```

`Week2ParsedFeed` follows the `AGENTS.md` Week 2 contract:

- `feed.title`
- `feed.feedUrl`
- `feed.siteUrl`
- `feed.fetchedAt`
- `articles`
- `warnings: string[]`

Article categories are exposed as `tags` in `Week2ParsedArticle` for T5/T7 alignment.

## Errors

Thrown errors are `FeedError` with stable `code` values:

- `INVALID_URL`
- `UNSUPPORTED_PROTOCOL`
- `FETCH_FAILED`
- `FETCH_TIMEOUT`
- `HTTP_ERROR`
- `PARSE_FAILED`
- `EMPTY_FEED`

UI code should show `error.message`; sync code can branch on `error.code`.

## Test Feeds

Local fixtures cover RSS, Atom, JSON Feed, duplicate articles, missing title and missing link fallback, relative links, invalid dates, parse failures, HTTP errors, and empty feeds.

The smoke script checks real feeds:

```bash
npm run smoke:feed
```

Default real Feed list:

- `https://www.ruanyifeng.com/blog/atom.xml`
- `https://css-tricks.com/feed/`
- `https://xkcd.com/atom.xml`

Custom Feed URLs can be passed after `--`:

```bash
npm run smoke:feed -- https://example.com/rss.xml
```

The smoke script verifies each default feed has at least one article with non-empty `title`, `url`, `summary`, `contentHtml`, `contentText`, and `publishedAt`.
