/**
 * T5 Sync - Mock Adapters
 *
 * 用于不依赖 T2/T3/T4 时也能测试完整同步链路。
 * 包含真实的 RSS Feed URL，能实际拉取文章数据。
 *
 * 使用方式：
 *   import { createMockSyncService } from './mock-adapters';
 *   const syncService = createMockSyncService();
 *   const result = await syncService.syncAll();
 */

import type {
  ISODateString,
  Week2Subscription,
  Week2ParsedFeed,
  Week2ParsedArticle,
  Week2Feed,
  Week2Article,
  Week2ArticleContent,
  Week2SubscriptionProvider,
  Week2FeedParser,
  Week2StoragePort,
} from './types';

// ─── 辅助函数 ────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function toISODate(date?: Date): ISODateString {
  return (date ?? new Date()).toISOString();
}

/**
 * 简单的 HTML 文本提取：去除标签，保留纯文本
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从 HTML 提取摘要（取前 200 字符）
 */
function extractExcerpt(html: string, maxLength = 200): string {
  const text = stripHtmlTags(html);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '…';
}

/**
 * 估算阅读时间（中文约 400 字/分钟，英文约 200 词/分钟）
 */
function estimateReadingMinutes(text: string): number {
  const charCount = text.length;
  return Math.max(1, Math.round(charCount / 400));
}

// ─── Mock 订阅源数据 ─────────────────────────────

/**
 * 包含真实可访问的 Feed URL
 */
const MOCK_SUBSCRIPTIONS: Week2Subscription[] = [
  {
    id: 'sub-ruanyifeng',
    title: '阮一峰的网络日志',
    feedUrl: 'https://www.ruanyifeng.com/blog/atom.xml',
    siteUrl: 'https://www.ruanyifeng.com/blog/',
    source: 'mock',
    status: 'active',
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  },
  {
    id: 'sub-css-tricks',
    title: 'CSS-Tricks',
    feedUrl: 'https://css-tricks.com/feed/',
    siteUrl: 'https://css-tricks.com',
    source: 'mock',
    status: 'active',
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  },
];

// ─── Mock SubscriptionProvider ────────────────────

export class MockSubscriptionProvider implements Week2SubscriptionProvider {
  async listActiveSubscriptions(): Promise<Week2Subscription[]> {
    return MOCK_SUBSCRIPTIONS.filter((s) => s.status === 'active');
  }
}

// ─── XML 正则提取工具（Node.js 兼容，不依赖 DOMParser） ──

/**
 * 从 XML 片段中提取第一个匹配标签的文本内容
 */
function xmlTag(xml: string, tag: string): string | undefined {
  // 处理命名空间前缀，如 content:encoded -> content\\:encoded 或 content:encoded
  const patterns = [
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag.replace(/:/g, '[^>]*?')}>`, 'i'),
    new RegExp(`<${tag}[^>]*?>([\\s\\S]*?)<\\/${tag.replace(/:/g, '.*?:')}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  ];
  for (const pat of patterns) {
    const m = xml.match(pat);
    if (m) return decodeXmlEntities(m[1].trim());
  }
  return undefined;
}

/**
 * 提取带属性的标签值，如 <link href="..." />
 */
function xmlAttr(xml: string, tag: string, attr: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*?${attr}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : undefined;
}

/**
 * 提取所有匹配标签的文本内容
 */
function xmlTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const pat = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag.replace(/:/g, '.*?')}>`, 'gi');
  let m;
  while ((m = pat.exec(xml)) !== null) {
    results.push(decodeXmlEntities(m[1].trim()));
  }
  // 也试简单版本
  if (results.length === 0) {
    const pat2 = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    while ((m = pat2.exec(xml)) !== null) {
      results.push(decodeXmlEntities(m[1].trim()));
    }
  }
  return results;
}

/**
 * 提取所有匹配标签的片段（含内部结构）
 */
function xmlElements(xml: string, tag: string): string[] {
  const results: string[] = [];
  const pat = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m;
  while ((m = pat.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

// ─── Mock FeedParser（使用真实网络请求 + 正则 XML 解析） ──

export class MockFeedParser implements Week2FeedParser {
  /**
   * 从 URL 拉取 Feed 并解析
   */
  async parseFeedUrl(feedUrl: string): Promise<Week2ParsedFeed> {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mercury-AI-Reader/0.1.0',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const feedText = await response.text();
      return this.parseFeedText(feedText, feedUrl);
    } catch (error: any) {
      throw new Error(`Failed to fetch feed from ${feedUrl}: ${error.message}`);
    }
  }

  /**
   * 解析 Feed XML 文本（使用正则，兼容 Node.js）
   */
  async parseFeedText(feedText: string, sourceUrl?: string): Promise<Week2ParsedFeed> {
    const warnings: string[] = [];

    try {
      // 判断是 RSS 还是 Atom
      const isAtom = /<feed[\s>]/i.test(feedText) && !/<rss[\s>]/i.test(feedText);

      if (isAtom) {
        return this.parseAtom(feedText, sourceUrl, warnings);
      } else {
        return this.parseRss(feedText, sourceUrl, warnings);
      }
    } catch (error: any) {
      throw new Error(`Feed parse error: ${error.message}`);
    }
  }

  private parseRss(
    xml: string,
    sourceUrl?: string,
    warnings: string[] = []
  ): Week2ParsedFeed {
    // 提取 channel
    const channelMatch = xml.match(/<channel[\s>]([\s\S]*?)<\/channel>/i);
    if (!channelMatch) throw new Error('No channel element found in RSS');

    const channel = channelMatch[0];
    const feedTitle = xmlTag(channel, 'title') ?? '';
    const feedLink = xmlTag(channel, 'link') ?? sourceUrl ?? '';

    const items = xmlElements(xml, 'item');
    const articles: Week2ParsedArticle[] = [];

    for (const item of items) {
      try {
        const title = xmlTag(item, 'title');
        const link = xmlTag(item, 'link');
        const guid = xmlTag(item, 'guid');
        const author = xmlTag(item, 'author') ?? xmlTag(item, 'dc:creator');
        const summary = xmlTag(item, 'description');
        const contentHtml = xmlTag(item, 'content:encoded') ?? summary;
        const pubDate = xmlTag(item, 'pubDate');
        const tags = xmlTags(item, 'category').filter(Boolean);

        if (!title) {
          warnings.push(`Skipping item without title: ${link}`);
          continue;
        }

        articles.push({
          guid: guid ?? undefined,
          title,
          url: link ?? '',
          author: author ?? undefined,
          summary: summary ? stripHtmlTags(summary) : undefined,
          contentHtml: contentHtml ?? undefined,
          contentText: contentHtml ? stripHtmlTags(contentHtml) : undefined,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
          tags,
        });
      } catch (e: any) {
        warnings.push(`Failed to parse RSS item: ${e.message}`);
      }
    }

    return {
      feed: {
        title: feedTitle,
        feedUrl: sourceUrl ?? '',
        siteUrl: feedLink,
        fetchedAt: toISODate(),
      },
      articles,
      warnings,
    };
  }

  private parseAtom(
    xml: string,
    sourceUrl?: string,
    warnings: string[] = []
  ): Week2ParsedFeed {
    // 提取 feed 元素
    const feedMatch = xml.match(/<feed[\s>]([\s\S]*?)<\/feed>/i);
    if (!feedMatch) throw new Error('No feed element found in Atom');

    const feed = feedMatch[0];
    const feedTitle = xmlTag(feed, 'title') ?? '';
    const feedLink = xmlAttr(feed, 'link', 'href') ?? sourceUrl ?? '';

    const entries = xmlElements(xml, 'entry');
    const articles: Week2ParsedArticle[] = [];

    for (const entry of entries) {
      try {
        const title = xmlTag(entry, 'title');
        const link = xmlAttr(entry, 'link', 'href');
        const id = xmlTag(entry, 'id');
        const author = xmlTag(entry, 'name'); // <author><name>...</name></author>
        const summary = xmlTag(entry, 'summary');
        const contentHtml = xmlTag(entry, 'content');
        const updated = xmlTag(entry, 'updated');
        const published = xmlTag(entry, 'published');

        // 提取 category term
        const catPattern = /<category[^>]*?term=["']([^"']*)["']/gi;
        const tags: string[] = [];
        let catMatch;
        while ((catMatch = catPattern.exec(entry)) !== null) {
          if (catMatch[1]) tags.push(catMatch[1]);
        }

        if (!title) {
          warnings.push(`Skipping entry without title: ${link}`);
          continue;
        }

        articles.push({
          guid: id ?? undefined,
          title,
          url: link ?? '',
          author: author ?? undefined,
          summary: summary ? stripHtmlTags(summary) : undefined,
          contentHtml: contentHtml ?? undefined,
          contentText: contentHtml ? stripHtmlTags(contentHtml) : undefined,
          publishedAt: published
            ? new Date(published).toISOString()
            : updated
              ? new Date(updated).toISOString()
              : undefined,
          updatedAt: updated ? new Date(updated).toISOString() : undefined,
          tags,
        });
      } catch (e: any) {
        warnings.push(`Failed to parse Atom entry: ${e.message}`);
      }
    }

    return {
      feed: {
        title: feedTitle,
        feedUrl: sourceUrl ?? '',
        siteUrl: feedLink,
        fetchedAt: toISODate(),
      },
      articles,
      warnings,
    };
  }
}

// ─── Mock StoragePort（内存实现） ─────────────────

export class MockStoragePort implements Week2StoragePort {
  private feeds: Map<string, Week2Feed> = new Map();
  private articles: Map<string, Week2Article> = new Map();
  private contents: Map<string, Week2ArticleContent> = new Map();
  private existingArticleUrls: Map<string, Set<string>> = new Map(); // feedId -> Set<url>

  async saveFeeds(feeds: Week2Feed[]): Promise<Week2Feed[]> {
    for (const feed of feeds) {
      this.feeds.set(feed.id, feed);
    }
    return feeds;
  }

  async listFeeds(): Promise<Week2Feed[]> {
    return Array.from(this.feeds.values());
  }

  async saveArticles(input: {
    feedId: string;
    articles: Week2ParsedArticle[];
  }): Promise<Week2Article[]> {
    const { feedId, articles } = input;

    // 初始化该 feed 的 URL 集合（用于去重）
    if (!this.existingArticleUrls.has(feedId)) {
      this.existingArticleUrls.set(feedId, new Set());
    }
    const existingUrls = this.existingArticleUrls.get(feedId)!;

    // 同时用 guid 去重
    const existingGuids = new Set(
      Array.from(this.articles.values())
        .filter((a) => a.feedId === feedId)
        .map((a) => {
          // 找对应的 content 来获取 guid 信息
          return a.url;
        })
    );

    const saved: Week2Article[] = [];

    for (const parsed of articles) {
      // 去重：优先用 guid，其次 url
      const dedupKey = parsed.guid ?? parsed.url;
      if (existingUrls.has(dedupKey)) {
        continue; // 跳过重复文章
      }

      const articleId = generateId();
      const now = toISODate();

      // 创建 Week2Article
      const article: Week2Article = {
        id: articleId,
        feedId,
        title: parsed.title,
        url: parsed.url,
        author: parsed.author,
        excerpt: parsed.summary ?? (parsed.contentHtml ? extractExcerpt(parsed.contentHtml) : ''),
        publishedAt: parsed.publishedAt,
        readState: 'unread',
        estimatedMinutes: parsed.contentText
          ? estimateReadingMinutes(parsed.contentText)
          : 1,
        tags: parsed.tags ?? [],
      };

      this.articles.set(articleId, article);

      // 同时保存最小 ArticleContent
      const rawHtml = parsed.contentHtml ?? parsed.summary ?? parsed.contentText ?? '';
      const plainText = parsed.contentText ?? stripHtmlTags(rawHtml);
      const content: Week2ArticleContent = {
        articleId,
        sourceHtml: rawHtml,
        cleanedHtml: rawHtml, // mock 阶段：cleanedHtml = sourceHtml
        canonicalMarkdown: plainText, // mock 阶段：canonicalMarkdown = 纯文本
        createdAt: now,
        updatedAt: now,
      };
      this.contents.set(articleId, content);

      // 记录去重 key
      existingUrls.add(dedupKey);

      saved.push(article);
    }

    return saved;
  }

  async listArticles(query?: {
    feedId?: string;
    searchText?: string;
  }): Promise<Week2Article[]> {
    let result = Array.from(this.articles.values());

    if (query?.feedId) {
      result = result.filter((a) => a.feedId === query.feedId);
    }

    if (query?.searchText) {
      const search = query.searchText.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(search) ||
          a.excerpt.toLowerCase().includes(search)
      );
    }

    return result;
  }

  async saveArticleContent(content: Week2ArticleContent): Promise<Week2ArticleContent> {
    this.contents.set(content.articleId, content);
    return content;
  }

  async getArticleContent(articleId: string): Promise<Week2ArticleContent | null> {
    return this.contents.get(articleId) ?? null;
  }

  async updateFeedSyncStatus(input: {
    feedId: string;
    status: Week2FeedStatus;
    lastSyncedAt?: string;
    errorMessage?: string;
  }): Promise<void> {
    const feed = this.feeds.get(input.feedId);
    if (feed) {
      feed.status = input.status;
      if (input.lastSyncedAt) {
        feed.lastSyncedAt = input.lastSyncedAt;
      }
      this.feeds.set(input.feedId, feed);
    }
  }
}
