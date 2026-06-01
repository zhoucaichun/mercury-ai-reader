export type OpmlSubscriptionSource = 'manual' | 'opml' | 'mock';
export type OpmlSubscriptionStatus = 'active' | 'disabled' | 'error';

export type OpmlParsedSubscription = {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  groupName?: string;
  source: OpmlSubscriptionSource;
  status: OpmlSubscriptionStatus;
  createdAt: string;
  updatedAt: string;
};

export type OpmlParseIssue = {
  type: 'duplicate' | 'invalid-url' | 'missing-feed-url';
  message: string;
  title?: string;
  feedUrl?: string;
};

export type OpmlParseResult = {
  subscriptions: OpmlParsedSubscription[];
  issues: OpmlParseIssue[];
};

type RawOutline = {
  title?: string;
  text?: string;
  xmlUrl?: string;
  htmlUrl?: string;
  type?: string;
  groupName?: string;
};

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i;

export function normalizeFeedUrl(feedUrl: string): string | null {
  const trimmed = feedUrl.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = ABSOLUTE_HTTP_URL_PATTERN.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSiteUrl(siteUrl?: string): string | undefined {
  if (!siteUrl) {
    return undefined;
  }

  return normalizeFeedUrl(siteUrl) ?? undefined;
}

export function parseOpmlText(opmlText: string, now = new Date().toISOString()): OpmlParseResult {
  const outlines = extractOutlines(opmlText);
  const subscriptions: OpmlParsedSubscription[] = [];
  const issues: OpmlParseIssue[] = [];
  const seenFeedUrls = new Set<string>();

  for (const outline of outlines) {
    const title = cleanText(outline.title ?? outline.text ?? outline.xmlUrl ?? 'Untitled feed');

    if (!outline.xmlUrl) {
      issues.push({
        type: 'missing-feed-url',
        title,
        message: `Skipped "${title}" because it does not include an xmlUrl feed address.`
      });
      continue;
    }

    const feedUrl = normalizeFeedUrl(decodeXmlEntities(outline.xmlUrl));

    if (!feedUrl) {
      issues.push({
        type: 'invalid-url',
        title,
        feedUrl: outline.xmlUrl,
        message: `Skipped "${title}" because xmlUrl is not a valid HTTP(S) URL.`
      });
      continue;
    }

    const dedupeKey = feedUrl.toLowerCase();

    if (seenFeedUrls.has(dedupeKey)) {
      issues.push({
        type: 'duplicate',
        title,
        feedUrl,
        message: `Skipped duplicate subscription "${title}".`
      });
      continue;
    }

    seenFeedUrls.add(dedupeKey);
    subscriptions.push({
      id: createSubscriptionId(feedUrl),
      title,
      feedUrl,
      siteUrl: normalizeSiteUrl(decodeXmlEntities(outline.htmlUrl ?? '')),
      groupName: outline.groupName,
      source: 'opml',
      status: 'active',
      createdAt: now,
      updatedAt: now
    });
  }

  return { subscriptions, issues };
}

function extractOutlines(opmlText: string): RawOutline[] {
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(opmlText, 'application/xml');
    const parserError = parsed.querySelector('parsererror');

    if (!parserError) {
      const body = parsed.querySelector('body') ?? parsed.documentElement;
      return Array.from(body.children).flatMap((node) => walkOutlineNode(node));
    }
  }

  return extractOutlinesWithRegex(opmlText);
}

function walkOutlineNode(node: Element, parentGroupName?: string): RawOutline[] {
  if (node.tagName.toLowerCase() !== 'outline') {
    return Array.from(node.children).flatMap((child) => walkOutlineNode(child, parentGroupName));
  }

  const title = node.getAttribute('title') ?? node.getAttribute('text') ?? undefined;
  const xmlUrl = node.getAttribute('xmlUrl') ?? undefined;
  const htmlUrl = node.getAttribute('htmlUrl') ?? undefined;
  const type = node.getAttribute('type') ?? undefined;
  const groupName = xmlUrl ? parentGroupName : title;
  const current = xmlUrl
    ? [{ title, text: node.getAttribute('text') ?? undefined, xmlUrl, htmlUrl, type, groupName: parentGroupName }]
    : [];
  const children = Array.from(node.children).flatMap((child) => walkOutlineNode(child, groupName));

  return [...current, ...children];
}

function extractOutlinesWithRegex(opmlText: string): RawOutline[] {
  const outlines: RawOutline[] = [];
  const outlinePattern = /<outline\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = outlinePattern.exec(opmlText)) !== null) {
    const attrs = parseAttributes(match[1]);

    if (attrs.xmlUrl) {
      outlines.push({
        title: attrs.title,
        text: attrs.text,
        xmlUrl: attrs.xmlUrl,
        htmlUrl: attrs.htmlUrl,
        type: attrs.type
      });
    }
  }

  return outlines;
}

function parseAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(input)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? '');
  }

  return attrs;
}

function cleanText(input: string): string {
  return decodeXmlEntities(input).replace(/\s+/g, ' ').trim() || 'Untitled feed';
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function createSubscriptionId(feedUrl: string): string {
  const hash = Array.from(feedUrl).reduce((acc, char) => {
    return (acc * 31 + char.charCodeAt(0)) >>> 0;
  }, 0);

  return `sub-${hash.toString(36)}`;
}
