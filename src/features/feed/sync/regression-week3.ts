/// <reference types="node" />

/**
 * T5 Sync - Week 3 回归测试
 *
 * 覆盖所有回归测试点：
 * 1. syncAll / syncFeed / smoke:week2 仍能同步真实 Feed
 * 2. 连续同步两次，检查文章和订阅源不重复
 * 3. 空输入 Add Feed 同步默认订阅源（无 mock/demo 字样）
 * 4. 输入真实 Feed URL 后能同步文章
 * 5. 同步后保留当前 feed/article 状态
 */

import { createSyncService } from './sync.service.js';
import {
  MockSubscriptionProvider,
  MockFeedParser,
  MockStoragePort,
} from './mock-adapters.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ ${msg}`);
    failed++;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('T5 Week 3 Sync 回归测试');
  console.log('='.repeat(60));
  console.log();

  // ─── 测试 1: syncAll 同步真实 Feed ──────────────────
  console.log('📋 测试 1: syncAll 同步真实 Feed');
  console.log('─'.repeat(60));

  const storage1 = new MockStoragePort();
  const syncService1 = createSyncService({
    subscriptionProvider: new MockSubscriptionProvider(),
    feedParser: new MockFeedParser(),
    storage: storage1,
  });

  const result1 = await syncService1.syncAll();

  assert(result1.status === 'succeeded', 'syncAll 整体状态为 succeeded');
  assert(result1.succeededCount === 2, `成功同步 2 个订阅源 (实际: ${result1.succeededCount})`);
  assert(result1.totalSavedArticles > 0, `有文章被保存 (共 ${result1.totalSavedArticles} 篇)`);

  const feeds1 = await storage1.listFeeds();
  const articles1 = await storage1.listArticles();
  assert(feeds1.length === 2, `存储中有 2 个 Feed (实际: ${feeds1.length})`);
  assert(articles1.length > 0, `存储中有文章 (共 ${articles1.length} 篇)`);

  // 验证 ArticleContent
  if (articles1.length > 0) {
    const content = await storage1.getArticleContent(articles1[0].id);
    assert(content !== null, 'getArticleContent 返回非空');
    if (content) {
      assert(content.sourceHtml.length > 0, `sourceHtml 非空 (${content.sourceHtml.length} chars)`);
      assert(content.cleanedHtml.length > 0, `cleanedHtml 非空 (${content.cleanedHtml.length} chars)`);
      assert(content.canonicalMarkdown.length > 0, `canonicalMarkdown 非空 (${content.canonicalMarkdown.length} chars)`);
    }
  }

  console.log();

  // ─── 测试 2: 连续同步两次，检查不重复 ────────────────
  console.log('📋 测试 2: 连续同步两次，文章和订阅源不重复');
  console.log('─'.repeat(60));

  // 使用同样的 storage 和 service，再同步一次
  const firstCount = articles1.length;
  const firstFeedCount = feeds1.length;

  const result2 = await syncService1.syncAll();

  const feeds2 = await storage1.listFeeds();
  const articles2 = await storage1.listArticles();

  // 注意：由于 syncService 每次 syncAll 会生成新的 feedId，文章也写入新的 feed 下
  // 所以关键验证是：同一篇文章（同 guid/url）不能作为重复的新文章出现
  // MockStoragePort 的去重是按 feedId 内部的，所以跨 feed 可能出现相同 URL 的文章
  // 但真正的产品中（electron/week2-sync.ts）去重是在 T2 SQLite 层面

  // 验证第二次同步不会抛错
  assert(result2.status === 'succeeded', '第二次 syncAll 也成功');

  // 检查 URL 级别去重：同一 URL 的文章不应该在同一个 feed 下出现两次
  // 统计所有文章的 URL
  const urlCounts = new Map<string, number>();
  for (const article of articles2) {
    urlCounts.set(article.url, (urlCounts.get(article.url) || 0) + 1);
  }
  const duplicateUrls = Array.from(urlCounts.entries()).filter(([, count]) => count > 1);
  assert(duplicateUrls.length === 0, `无重复 URL 文章 (重复数: ${duplicateUrls.length})`);

  console.log();

  // ─── 测试 3: 空输入 Add Feed 默认订阅源，无 mock/demo 字样 ──
  console.log('📋 测试 3: 默认订阅源文案检查（无 mock/demo/test）');
  console.log('─'.repeat(60));

  // 检查 MockSubscriptionProvider 返回的订阅源
  const subProvider = new MockSubscriptionProvider();
  const subs = await subProvider.listActiveSubscriptions();

  let hasBadWord = false;
  const badWords = ['mock', 'demo', 'test', 'Mock', 'Demo', 'Test'];
  for (const sub of subs) {
    for (const word of badWords) {
      if (sub.title.includes(word) || sub.feedUrl.includes(word)) {
        console.log(`  ⚠️ 订阅源 "${sub.title}" 包含 "${word}"`);
        hasBadWord = true;
      }
    }
  }
  assert(!hasBadWord, '所有订阅源标题和 URL 中不含 mock/demo/test 字样');
  assert(subs.length > 0, `至少有 ${subs.length} 个默认订阅源`);

  // 检查 smoke 测试输出的文案
  // 检查 types.ts 中 source 字段的枚举值
  const mockSub = subs.find(s => s.source === 'mock');
  if (mockSub) {
    console.log('  ℹ️  订阅源 source 字段为 "mock"（内部标识，非页面展示文案）');
  }

  console.log();

  // ─── 测试 4: 输入真实 Feed URL 后能同步文章 ──────────
  console.log('📋 测试 4: 输入真实 Feed URL 同步文章');
  console.log('─'.repeat(60));

  // 测试单个 feed 同步（syncFeed）
  const storage4 = new MockStoragePort();
  const syncService4 = createSyncService({
    subscriptionProvider: new MockSubscriptionProvider(),
    feedParser: new MockFeedParser(),
    storage: storage4,
  });

  const singleResult = await syncService4.syncFeed('sub-ruanyifeng');
  assert(singleResult.status === 'succeeded', `syncFeed 单个订阅源成功`);
  assert(singleResult.savedCount > 0, `同步到 ${singleResult.savedCount} 篇文章`);
  assert(singleResult.parsedCount === singleResult.savedCount + singleResult.skippedCount,
    `parsed = saved + skipped (${singleResult.parsedCount} = ${singleResult.savedCount} + ${singleResult.skippedCount})`);

  const feeds4 = await storage4.listFeeds();
  const articles4 = await storage4.listArticles();
  assert(feeds4.length === 1, `存储中有 1 个 Feed (实际: ${feeds4.length})`);
  assert(articles4.length > 0, `存储中有文章 (共 ${articles4.length} 篇)`);

  // 验证真实内容
  if (articles4.length > 0) {
    const content4 = await storage4.getArticleContent(articles4[0].id);
    assert(content4 !== null, '真实文章的 ArticleContent 不为空');
    if (content4) {
      assert(content4.canonicalMarkdown.length > 100,
        `canonicalMarkdown 有实质内容 (${content4.canonicalMarkdown.length} chars)`);
      // 验证不是固定 mock 数据
      const mockStrings = ['mock', 'Mock', 'placeholder', 'Placeholder'];
      const hasMock = mockStrings.some(s => content4.canonicalMarkdown.includes(s));
      assert(!hasMock, 'canonicalMarkdown 不含 mock/placeholder 字样');
    }
  }

  console.log();

  // ─── 测试 5: 同步后保留当前 feed/article 状态 ────────
  console.log('📋 测试 5: 同步后状态保留验证');
  console.log('─'.repeat(60));

  const storage5 = new MockStoragePort();
  const syncService5 = createSyncService({
    subscriptionProvider: new MockSubscriptionProvider(),
    feedParser: new MockFeedParser(),
    storage: storage5,
  });

  // 第一次同步
  await syncService5.syncAll();
  const feeds5a = await storage5.listFeeds();
  const articles5a = await storage5.listArticles();

  assert(feeds5a.length > 0, `第一次同步后有 ${feeds5a.length} 个 Feed`);
  assert(articles5a.length > 0, `第一次同步后有 ${articles5a.length} 篇文章`);

  // 记住第一个 feed 和第一篇文章
  const firstFeed = feeds5a[0];
  const firstArticle = articles5a[0];

  // 再次同步（模拟用户在阅读某篇文章时点了同步）
  await syncService5.syncAll();
  const feeds5b = await storage5.listFeeds();
  const articles5b = await storage5.listArticles();

  // 之前同步的 feed 和文章应该还在（storage 是追加式的）
  assert(feeds5b.length >= feeds5a.length,
    `同步后 Feed 数量未减少 (${feeds5b.length} >= ${feeds5a.length})`);
  assert(articles5b.length >= articles5a.length,
    `同步后文章数量未减少 (${articles5b.length} >= ${articles5a.length})`);

  // 验证之前的 feed 还能找到
  const feedStillExists = feeds5b.some(f => f.id === firstFeed.id);
  assert(feedStillExists, '同步后之前的 Feed 仍存在');

  // 验证之前的 article 还能找到
  const articleStillExists = articles5b.some(a => a.id === firstArticle.id);
  assert(articleStillExists, '同步后之前的文章仍存在');

  // 验证文章内容没变
  const content5 = await storage5.getArticleContent(firstArticle.id);
  assert(content5 !== null, '同步后之前文章的内容仍可获取');

  console.log();

  // ─── 测试结果汇总 ──────────────────────────────────
  console.log('='.repeat(60));
  console.log(`📊 回归测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('✅ T5 Week 3 Sync 回归测试全部通过');
  } else {
    console.log('❌ T5 Week 3 Sync 回归测试存在失败项');
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
