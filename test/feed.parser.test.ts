import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addFeedUrl,
  FeedError,
  normalizeFeedUrl,
  parseFeedText,
  parseFeedUrl,
  week2FeedParser,
} from "../src/features/feed/parser/index.js";
import type { FeedFetchResponse } from "../src/features/feed/parser/types.js";

const fixtureDir = join(import.meta.dirname, "fixtures");

async function readFixture(name: string): Promise<string> {
  return readFile(join(fixtureDir, name), "utf8");
}

function response(body: string, init: Partial<FeedFetchResponse> = {}): FeedFetchResponse {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    url: init.url,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? "application/xml" : null;
      },
    },
    text: async () => body,
  };
}

describe("feed parser", () => {
  it("normalizes manual feed URLs safely", () => {
    expect(normalizeFeedUrl("example.com/feed.xml#fragment")).toBe(
      "https://example.com/feed.xml",
    );
    expect(() => normalizeFeedUrl("file:///tmp/feed.xml")).toThrow(FeedError);
    expect(() => normalizeFeedUrl("")).toThrow(FeedError);
  });

  it("parses RSS feeds into the standard T3/T5 contract", async () => {
    const parsed = await parseFeedText(
      await readFixture("rss-feed.xml"),
      "https://example.com/rss.xml",
      {
        fetchedAt: new Date("2024-05-24T00:00:00Z"),
      },
    );

    expect(parsed.feed).toMatchObject({
      title: "Mercury Test RSS",
      format: "rss",
      url: "https://example.com/rss.xml",
      siteUrl: "https://example.com/",
      fetchedAt: "2024-05-24T00:00:00.000Z",
    });
    expect(parsed.articles).toHaveLength(3);
    expect(parsed.duplicateArticleCount).toBe(1);
    expect(parsed.articles[0]).toMatchObject({
      title: "First RSS article",
      url: "https://example.com/articles/first",
      guid: "first-guid",
      author: "Ada Lovelace",
      publishedAt: "2024-05-20T10:00:00.000Z",
      categories: ["AI"],
      feedId: parsed.feed.id,
    });
    expect(parsed.articles[0]?.summary).toContain("Short summary");
    expect(parsed.articles[0]?.contentHtml).toContain("Full content body.");
    expect(parsed.articles[0]?.contentText).toContain("Short summary");
    expect(parsed.articles[1]?.title).toContain("Item without a title");
    expect(parsed.articles[1]?.url).toBe("https://example.com/articles/missing-title");
    expect(parsed.articles[2]?.title).toBe("RSS item without link");
    expect(parsed.articles[2]?.url).toMatch(
      /^https:\/\/example\.com\/rss\.xml#article-[a-f0-9]+$/,
    );
    expect(parsed.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "ARTICLE_DUPLICATE",
        "ARTICLE_MISSING_TITLE",
        "ARTICLE_MISSING_LINK",
        "ARTICLE_INVALID_DATE",
      ]),
    );
  });

  it("parses Atom feeds and resolves relative article links", async () => {
    const parsed = await parseFeedText(
      await readFixture("atom-feed.xml"),
      "https://example.org/feed.atom",
    );

    expect(parsed.feed).toMatchObject({
      title: "Mercury Test Atom",
      format: "atom",
      siteUrl: "https://example.org/",
    });
    expect(parsed.articles).toHaveLength(2);
    expect(parsed.articles[0]).toMatchObject({
      title: "First Atom article",
      url: "https://example.org/posts/first",
      author: "Grace Hopper",
      publishedAt: "2024-05-21T10:30:00.000Z",
    });
    expect(parsed.articles[1]?.url).toBe("https://example.org/posts/relative");
  });

  it("parses optional JSON Feed and keeps the same standard output", async () => {
    const parsed = await parseFeedText(
      await readFixture("json-feed.json"),
      "https://json.example.com/feed.json",
    );

    expect(parsed.feed).toMatchObject({
      title: "Mercury Test JSON Feed",
      format: "json",
      siteUrl: "https://json.example.com/",
    });
    expect(parsed.articles).toHaveLength(2);
    expect(parsed.articles[0]).toMatchObject({
      title: "First JSON article",
      author: "Katherine Johnson",
      categories: ["json", "feed"],
      publishedAt: "2024-05-22T09:00:00.000Z",
    });
    expect(parsed.articles[1]).toMatchObject({
      title: "JSON item without title.",
      url: "https://external.example.com/posts/two",
      updatedAt: "2024-05-23T09:00:00.000Z",
    });
    expect(parsed.articles[0]?.contentHtml).toBe("<p>Full JSON content.</p>");
    expect(parsed.articles[0]?.contentText).toBe("Full JSON content.");
    expect(parsed.articles[1]?.contentText).toBe("JSON item without title.");
    expect(parsed.articles[1]?.contentHtml).toBe("<p>JSON item without title.</p>");
    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "ARTICLE_CONTENT_FALLBACK",
    );
  });

  it("fills contentHtml and contentText fallbacks for sparse real-world items", async () => {
    const parsed = await parseFeedText(
      JSON.stringify({
        version: "https://jsonfeed.org/version/1.1",
        title: "Sparse Feed",
        items: [
          {
            id: "sparse-1",
            url: "https://example.com/sparse-1",
            title: "Sparse article",
            date_published: "2026-06-10T08:00:00Z",
          },
        ],
      }),
      "https://example.com/feed.json",
    );

    expect(parsed.articles[0]).toMatchObject({
      title: "Sparse article",
      summary: "Sparse article",
      contentHtml: "<p>Sparse article</p>",
      contentText: "Sparse article",
      publishedAt: "2026-06-10T08:00:00.000Z",
    });
    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "ARTICLE_CONTENT_FALLBACK",
    );
  });

  it("supports Feed URL adding through an injectable fetcher", async () => {
    const fixture = await readFixture("rss-feed.xml");
    const parsed = await addFeedUrl("example.com/rss.xml", {
      source: "manual",
      fetcher: async (url) =>
        response(fixture, {
          url,
        }),
    });

    expect(parsed.source).toBe("manual");
    expect(parsed.feed.url).toBe("https://example.com/rss.xml");
    expect(parsed.articles.length).toBeGreaterThan(0);
  });

  it("exports the AGENTS Week2FeedParser contract", async () => {
    const parsed = await week2FeedParser.parseFeedText(
      await readFixture("rss-feed.xml"),
      "https://example.com/rss.xml",
    );

    expect(parsed.feed).toMatchObject({
      title: "Mercury Test RSS",
      feedUrl: "https://example.com/rss.xml",
      siteUrl: "https://example.com/",
    });
    expect(parsed.articles[0]).toMatchObject({
      title: "First RSS article",
      tags: ["AI"],
    });
    expect(parsed.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ARTICLE_DUPLICATE"),
        expect.stringContaining("ARTICLE_MISSING_TITLE"),
      ]),
    );
  });

  it("reports HTTP and empty feed failures with stable error codes", async () => {
    await expect(
      parseFeedUrl("https://example.com/missing.xml", {
        fetcher: async () =>
          response("not found", {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
      }),
    ).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 404,
    });

    await expect(parseFeedText("", "https://example.com/empty.xml")).rejects.toMatchObject({
      code: "EMPTY_FEED",
    });

    await expect(
      parseFeedText("{ invalid json", "https://example.com/feed.json"),
    ).rejects.toMatchObject({
      code: "PARSE_FAILED",
    });
  });
});
