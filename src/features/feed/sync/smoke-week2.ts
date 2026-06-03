/// <reference types="node" />

/**
 * T5 Sync - Week 2 Smoke Test
 *
 * 执行 syncAll() 并输出 feeds / articles / articleContent 数量和首篇文章信息。
 * 运行方式：npm run smoke:week2
 *
 * 测试流程：
 * 1. 创建 mock sync service（使用真实 Feed URL + 内存存储）
 * 2. 执行 syncAll()
 * 3. 读取存储结果
 * 4. 输出统计信息
 */

import { createSyncService } from './sync.service';
import {
  MockSubscriptionProvider,
  MockFeedParser,
  MockStoragePort,
} from './mock-adapters';

async function main() {
  console.log('='.repeat(60));
  console.log('Mercury AI Reader - Week 2 Smoke Test (T5 Sync)');
  console.log('='.repeat(60));
  console.log();

  // 创建 mock adapters
  const storage = new MockStoragePort();
  const subscriptionProvider = new MockSubscriptionProvider();
  const feedParser = new MockFeedParser();

  const syncService = createSyncService({
    subscriptionProvider,
    feedParser,
    storage,
  });

  // 执行 syncAll
  console.log('📡 Starting syncAll()...');
  console.log();

  const result = await syncService.syncAll();

  // 输出同步结果
  console.log('─'.repeat(60));
  console.log('📊 Sync Results:');
  console.log('─'.repeat(60));
  console.log(`  Overall Status: ${result.status}`);
  console.log(`  Total Subscriptions: ${result.totalSubscriptions}`);
  console.log(`  Succeeded: ${result.succeededCount}`);
  console.log(`  Failed: ${result.failedCount}`);
  console.log(`  Total Saved Articles: ${result.totalSavedArticles}`);
  console.log();

  // 输出每个订阅源的详情
  for (const feedResult of result.results) {
    console.log(`  📰 Subscription: ${feedResult.subscriptionId}`);
    console.log(`     Feed ID: ${feedResult.feedId}`);
    console.log(`     Status: ${feedResult.status}`);
    console.log(`     Parsed: ${feedResult.parsedCount} articles`);
    console.log(`     Saved: ${feedResult.savedCount} new`);
    console.log(`     Skipped: ${feedResult.skippedCount} (duplicates)`);
    if (feedResult.errorMessage) {
      console.log(`     Error: ${feedResult.errorMessage}`);
    }
    console.log();
  }

  // 读取存储数据
  console.log('─'.repeat(60));
  console.log('💾 Storage Verification:');
  console.log('─'.repeat(60));

  const feeds = await storage.listFeeds();
  const articles = await storage.listArticles();

  console.log(`  Feeds in storage: ${feeds.length}`);
  console.log(`  Articles in storage: ${articles.length}`);
  console.log();

  // 输出 Feed 列表
  for (const feed of feeds) {
    console.log(`  📋 Feed: "${feed.title}"`);
    console.log(`     ID: ${feed.id}`);
    console.log(`     URL: ${feed.feedUrl}`);
    console.log(`     Unread: ${feed.unreadCount}`);
    console.log(`     Status: ${feed.status}`);
    console.log(`     Last Synced: ${feed.lastSyncedAt ?? 'never'}`);
    console.log();
  }

  // 输出首篇文章详情
  if (articles.length > 0) {
    const firstArticle = articles[0];
    console.log('─'.repeat(60));
    console.log('📄 First Article:');
    console.log('─'.repeat(60));
    console.log(`  Title: ${firstArticle.title}`);
    console.log(`  URL: ${firstArticle.url}`);
    console.log(`  Author: ${firstArticle.author ?? 'unknown'}`);
    console.log(`  Published: ${firstArticle.publishedAt ?? 'unknown'}`);
    console.log(`  Read State: ${firstArticle.readState}`);
    console.log(`  Est. Reading: ${firstArticle.estimatedMinutes} min`);
    console.log(`  Tags: ${firstArticle.tags.join(', ') || 'none'}`);
    console.log(`  Excerpt: ${firstArticle.excerpt.substring(0, 100)}...`);
    console.log();

    // 验证 ArticleContent
    const content = await storage.getArticleContent(firstArticle.id);
    if (content) {
      console.log('─'.repeat(60));
      console.log('📝 Article Content (getArticleContent verification):');
      console.log('─'.repeat(60));
      console.log(`  Article ID: ${content.articleId}`);
      console.log(`  sourceHtml length: ${content.sourceHtml.length} chars`);
      console.log(`  cleanedHtml length: ${content.cleanedHtml.length} chars`);
      console.log(`  canonicalMarkdown length: ${content.canonicalMarkdown.length} chars`);
      console.log(`  ✅ getArticleContent(articleId) returned non-null content`);
      console.log();
      console.log(`  canonicalMarkdown preview (first 300 chars):`);
      console.log(`  ${content.canonicalMarkdown.substring(0, 300)}...`);
    } else {
      console.log('  ❌ getArticleContent(articleId) returned null!');
    }
  } else {
    console.log('  ⚠️ No articles found in storage.');
  }

  console.log();
  console.log('='.repeat(60));

  // 返回状态码
  const success = result.status !== 'failed' && articles.length > 0;
  if (success) {
    console.log('✅ Week 2 Smoke Test PASSED');
  } else {
    console.log('❌ Week 2 Smoke Test FAILED');
  }
  console.log('='.repeat(60));

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
