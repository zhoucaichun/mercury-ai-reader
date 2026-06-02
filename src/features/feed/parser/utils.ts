import { createHash } from "node:crypto";
import { FeedError } from "./errors.js";
import type { FeedWarning } from "./types.js";

const URL_PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export function normalizeFeedUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new FeedError("INVALID_URL", "Feed URL cannot be empty.");
  }

  const withProtocol = URL_PROTOCOL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;

  try {
    parsed = new URL(withProtocol);
  } catch (error) {
    throw new FeedError("INVALID_URL", `Invalid Feed URL: ${input}`, { cause: error });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FeedError(
      "UNSUPPORTED_PROTOCOL",
      `Unsupported Feed URL protocol: ${parsed.protocol}`,
      { feedUrl: parsed.toString() },
    );
  }

  parsed.hash = "";
  return parsed.toString();
}

export function maybeNormalizeUrl(value: unknown, baseUrl?: string): string | undefined {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  try {
    return new URL(text, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export function stableId(...parts: Array<string | undefined>): string {
  return createHash("sha256")
    .update(parts.filter(Boolean).join("\u001f"))
    .digest("hex")
    .slice(0, 24);
}

export function cleanText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value)
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 0 ? text : undefined;
}

export function stripHtml(value: unknown): string | undefined {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  return cleanText(
    text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/g, "'"),
  );
}

export function trimToLength(value: string | undefined, maxLength: number): string | undefined {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

export function toIsoDate(
  value: unknown,
  warnings: FeedWarning[],
  itemIndex: number,
): string | undefined {
  const text = cleanText(value);

  if (!text) {
    return undefined;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    warnings.push({
      code: "ARTICLE_INVALID_DATE",
      message: `Article ${itemIndex + 1} has an invalid date and it was ignored.`,
      itemIndex,
      value: text,
    });
    return undefined;
  }

  return date.toISOString();
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => cleanText(item)).filter(Boolean) as string[])];
  }

  const text = cleanText(value);
  return text ? [text] : [];
}
