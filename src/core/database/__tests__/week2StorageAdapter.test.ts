import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../init';
import { createWeek2StoragePort } from '../week2StorageAdapter';
import type { Week2StoragePort, Week2Feed, Week2Article, Week2ArticleContent } from '../types';

describe('Week2StorageAdapter', () => {
  let db: Database.Database;
  let port: Week2StoragePort;

  beforeEach(() => {
    db = createInMemoryDatabase();
    port = createWeek2StoragePort(db);
  });

  // ─── saveFeeds / listFeeds ────────────────────────────────
  describe('saveFeeds / listFeeds', () => {
    it('saveFeeds 保存 Feed 并 listFeeds 读回', async () => {
      const saved = await port.saveFeeds([
        {
          id: 'auto',
          title: 'Test Feed',
          feedUrl: 'https://example.com/rss',
          siteUrl: 'https://example.com',
          unreadCount: 0,
          status: 'ready',
          lastSyncedAt: '2026-06-01T10:00:00.000Z',
        },
      ]);

      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('1'); // string ID
      expect(saved[0].title).toBe('Test Feed');
      expect(saved[0].feedUrl).toBe('https://example.com/rss');

      const listed = await port.listFeeds();
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe('1');
      expect(listed[0].feedUrl).toBe('https://example.com/rss');
    });

    it('saveFeeds 相同 feedUrl 做 upsert 不产生重复', async () => {
      await port.saveFeeds([
        { id: 'auto', title: 'Original', feedUrl: 'https://example.com/rss', unreadCount: 0, status: 'ready' },
      ]);
      await port.saveFeeds([
        { id: 'auto', title: 'Updated', feedUrl: 'https://example.com/rss', unreadCount: 0, status: 'ready' },
      ]);

      const feeds = await port.listFeeds();
      expect(feeds).toHaveLength(1);
      expect(feeds[0].title).toBe('Updated');
    });

    it('listFeeds 空数据库返回空数组', async () => {
      const feeds = await port.listFeeds();
      expect(feeds).toEqual([]);
    });
  });

  // ─── saveArticles / listArticles ──────────────────────────
  describe('saveArticles / listArticles', () => {
    let feedId: string;

    beforeEach(async () => {
      const feeds = await port.saveFeeds([
        { id: 'auto', title: 'Test Feed', feedUrl: 'https://example.com/rss', unreadCount: 0, status: 'ready' },
      ]);
      feedId = feeds[0].id;
    });

    it('saveArticles 保存文章并 listArticles 读回', async () => {
      const articles = await port.saveArticles({
        feedId,
        articles: [
          {
            title: 'Test Article',
            url: 'https://example.com/article-1',
            guid: 'article-1',
            author: 'Author',
            summary: 'A test article summary',
            publishedAt: '2026-05-28T10:00:00.000Z',
          },
        ],
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Test Article');
      expect(articles[0].id).toBeTruthy(); // string ID
      expect(articles[0].feedId).toBe(feedId);
    });

    it('saveArticles 的 articles 带 string 类型的 id 和 feedId', async () => {
      const articles = await port.saveArticles({
        feedId,
        articles: [
          { title: 'Article', url: 'https://example.com/a', guid: 'a' },
        ],
      });

      expect(typeof articles[0].id).toBe('string');
      expect(typeof articles[0].feedId).toBe('string');
    });

    it('listArticles 按 feedId 过滤', async () => {
      // Create a second feed
      const feeds2 = await port.saveFeeds([
        { id: 'auto', title: 'Feed 2', feedUrl: 'https://other.com/rss', unreadCount: 0, status: 'ready' },
      ]);
      const feedId2 = feeds2[0].id;

      await port.saveArticles({
        feedId,
        articles: [
          { title: 'Feed1 Article', url: 'https://example.com/a1', guid: 'a1' },
        ],
      });
      await port.saveArticles({
        feedId: feedId2,
        articles: [
          { title: 'Feed2 Article', url: 'https://other.com/a2', guid: 'a2' },
        ],
      });

      const feed1Articles = await port.listArticles({ feedId });
      expect(feed1Articles).toHaveLength(1);
      expect(feed1Articles[0].title).toBe('Feed1 Article');

      const feed2Articles = await port.listArticles({ feedId: feedId2 });
      expect(feed2Articles).toHaveLength(1);
      expect(feed2Articles[0].title).toBe('Feed2 Article');
    });

    it('listArticles 支持 searchText 搜索', async () => {
      await port.saveArticles({
        feedId,
        articles: [
          { title: 'Rust Programming', url: 'https://example.com/rust', guid: 'rust', summary: 'About Rust language' },
          { title: 'Python Guide', url: 'https://example.com/python', guid: 'python', summary: 'About Python' },
        ],
      });

      const results = await port.listArticles({ searchText: 'Rust' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Rust Programming');
    });
  });

  // ─── saveArticleContent / getArticleContent ───────────────
  describe('saveArticleContent / getArticleContent', () => {
    let articleId: string;

    beforeEach(async () => {
      const feeds = await port.saveFeeds([
        { id: 'auto', title: 'Test Feed', feedUrl: 'https://example.com/rss', unreadCount: 0, status: 'ready' },
      ]);
      const articles = await port.saveArticles({
        feedId: feeds[0].id,
        articles: [
          { title: 'Test Article', url: 'https://example.com/article', guid: 'test-article' },
        ],
      });
      articleId = articles[0].id;
    });

    it('saveArticleContent 保存三层内容', async () => {
      const content: Week2ArticleContent = {
        articleId,
        sourceHtml: '<html><body><h1>Title</h1><p>Raw HTML content</p></body></html>',
        cleanedHtml: '<h1>Title</h1><p>Raw HTML content</p>',
        canonicalMarkdown: '# Title\n\nRaw HTML content',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      };

      const saved = await port.saveArticleContent(content);
      expect(saved.articleId).toBe(articleId);
      expect(saved.sourceHtml).toBe(content.sourceHtml);
    });

    it('getArticleContent 返回含 sourceHtml / cleanedHtml / canonicalMarkdown 的非空结果', async () => {
      await port.saveArticleContent({
        articleId,
        sourceHtml: '<html><body>Source</body></html>',
        cleanedHtml: '<div>Cleaned</div>',
        canonicalMarkdown: 'Cleaned',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      });

      const content = await port.getArticleContent(articleId);
      expect(content).not.toBeNull();
      expect(content!.articleId).toBe(articleId);
      expect(content!.sourceHtml).toBe('<html><body>Source</body></html>');
      expect(content!.cleanedHtml).toBe('<div>Cleaned</div>');
      expect(content!.canonicalMarkdown).toBe('Cleaned');
    });

    it('getArticleContent 对不存在的 articleId 返回 null', async () => {
      const content = await port.getArticleContent('99999');
      expect(content).toBeNull();
    });
  });

  // ─── updateFeedSyncStatus ─────────────────────────────────
  describe('updateFeedSyncStatus', () => {
    it('updateFeedSyncStatus 更新同步状态和最后同步时间', async () => {
      const feeds = await port.saveFeeds([
        { id: 'auto', title: 'Test Feed', feedUrl: 'https://example.com/rss', unreadCount: 0, status: 'ready' },
      ]);
      const feedId = feeds[0].id;

      await port.updateFeedSyncStatus({
        feedId,
        status: 'syncing',
        lastSyncedAt: '2026-06-01T12:00:00.000Z',
      });

      // Verify lastFetchedAt was updated via listFeeds
      const listed = await port.listFeeds();
      expect(listed[0].lastSyncedAt).toBe('2026-06-01T12:00:00.000Z');
    });
  });

  // ─── 端到端主链路 ────────────────────────────────────────
  describe('端到端主链路', () => {
    it('保存 1 个 Feed → 保存 1 篇 Article → 保存 ArticleContent → 读回全部非空', async () => {
      // 1. Save a feed
      const feeds = await port.saveFeeds([
        {
          id: 'auto',
          title: 'Paul Graham – Essays',
          feedUrl: 'https://www.paulgraham.com/rss.html',
          siteUrl: 'https://www.paulgraham.com',
          unreadCount: 0,
          status: 'ready',
        },
      ]);
      expect(feeds).toHaveLength(1);
      const feedId = feeds[0].id;
      expect(typeof feedId).toBe('string');

      // 2. Save articles
      const articles = await port.saveArticles({
        feedId,
        articles: [
          {
            title: 'How to Do Great Work',
            url: 'https://www.paulgraham.com/greatwork.html',
            guid: 'pg-how-to-do-great-work',
            author: 'Paul Graham',
            summary: 'A guide to doing great work in any field.',
            publishedAt: '2026-05-20T08:00:00.000Z',
            contentHtml: '<html><body><article><h1>How to Do Great Work</h1><p>You need curiosity, effort, and...</p></article></body></html>',
            contentText: 'How to Do Great Work\n\nYou need curiosity, effort, and...',
          },
        ],
      });
      expect(articles).toHaveLength(1);
      const articleId = articles[0].id;
      expect(typeof articleId).toBe('string');
      expect(articles[0].title).toBe('How to Do Great Work');
      expect(articles[0].feedId).toBe(feedId);

      // 3. Save article content
      await port.saveArticleContent({
        articleId,
        sourceHtml: '<html><body><article><h1>How to Do Great Work</h1><p>Full article text...</p></article></body></html>',
        cleanedHtml: '<h1>How to Do Great Work</h1><p>Full article text...</p>',
        canonicalMarkdown: '# How to Do Great Work\n\nFull article text...',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      });

      // 4. Verify getArticleContent returns non-null with all three layers
      const content = await port.getArticleContent(articleId);
      expect(content).not.toBeNull();
      expect(content!.sourceHtml).toBeTruthy();
      expect(content!.cleanedHtml).toBeTruthy();
      expect(content!.canonicalMarkdown).toBeTruthy();

      // 5. Verify listFeeds and listArticles
      const allFeeds = await port.listFeeds();
      expect(allFeeds).toHaveLength(1);
      expect(allFeeds[0].feedUrl).toBe('https://www.paulgraham.com/rss.html');

      const allArticles = await port.listArticles();
      expect(allArticles).toHaveLength(1);
      expect(allArticles[0].title).toBe('How to Do Great Work');
    });
  });
});
