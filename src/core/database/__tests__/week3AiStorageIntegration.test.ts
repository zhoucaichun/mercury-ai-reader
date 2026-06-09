import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../init';
import { createFeedStore } from '../stores/feedStore';
import { createEntryStore } from '../stores/entryStore';
import { createContentStore } from '../stores/contentStore';
import { createSummaryResultStore } from '../stores/summaryResultStore';
import { createTranslationResultStore } from '../stores/translationResultStore';
import { createLLMUsageEventStore } from '../stores/llmUsageEventStore';

describe('Week 3 AI Storage Integration', () => {
  let db: Database.Database;
  let entryStore: ReturnType<typeof createEntryStore>;
  let contentStore: ReturnType<typeof createContentStore>;
  let summaryStore: ReturnType<typeof createSummaryResultStore>;
  let translationStore: ReturnType<typeof createTranslationResultStore>;
  let usageStore: ReturnType<typeof createLLMUsageEventStore>;
  let entry1Id: number;
  let entry2Id: number;

  beforeEach(() => {
    db = createInMemoryDatabase();
    const feedStore = createFeedStore(db);
    entryStore = createEntryStore(db);
    contentStore = createContentStore(db);
    summaryStore = createSummaryResultStore(db);
    translationStore = createTranslationResultStore(db);
    usageStore = createLLMUsageEventStore(db);

    const feed = feedStore.upsert({ feedUrl: 'https://example.com/rss' });

    const e1 = entryStore.upsert({
      feedId: feed.id,
      guid: 'article-1',
      url: 'https://example.com/1',
      title: 'Article One',
      author: 'Author A',
      publishedAt: '2026-06-09T10:00:00.000Z',
      summary: 'Summary of article one',
    });
    entry1Id = e1.id;

    const e2 = entryStore.upsert({
      feedId: feed.id,
      guid: 'article-2',
      url: 'https://example.com/2',
      title: 'Article Two',
      author: 'Author B',
      publishedAt: '2026-06-09T11:00:00.000Z',
      summary: 'Summary of article two',
    });
    entry2Id = e2.id;

    // Create content for both articles
    contentStore.upsert({
      entryId: entry1Id,
      html: '<html><body><h1>Article One</h1><p>Content of article one.</p></body></html>',
      cleanedHtml: '<h1>Article One</h1><p>Content of article one.</p>',
      readabilityTitle: 'Article One',
      readabilityByline: 'Author A',
      readabilityVersion: 1,
      markdown: '# Article One\n\nContent of article one.',
      markdownVersion: 1,
      displayMode: 'cleaned',
      documentBaseUrl: 'https://example.com/1',
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });

    contentStore.upsert({
      entryId: entry2Id,
      html: '<html><body><h1>Article Two</h1><p>Content of article two.</p></body></html>',
      cleanedHtml: '<h1>Article Two</h1><p>Content of article two.</p>',
      readabilityTitle: 'Article Two',
      readabilityByline: 'Author B',
      readabilityVersion: 1,
      markdown: '# Article Two\n\nContent of article two.',
      markdownVersion: 1,
      displayMode: 'cleaned',
      documentBaseUrl: 'https://example.com/2',
      pipelineType: 'default',
      resolvedIntermediateContent: null,
    });
  });

  // ── 1. Save/query Summary by articleId ──────────────────────
  it('saves and queries summary by articleId', () => {
    const { result } = summaryStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      detailLevel: 'standard',
      outputLanguage: 'zh-CN',
      markdown: '## 摘要\n\n文章一的核心要点。',
    });

    expect(result.entryId).toBe(entry1Id);
    expect(result.markdown).toContain('摘要');

    const latest = summaryStore.getLatestByEntryId(entry1Id);
    expect(latest).not.toBeNull();
    expect(latest!.entryId).toBe(entry1Id);
  });

  // ── 2. Save/query Translation by articleId ──────────────────
  it('saves and queries translation by articleId', () => {
    const { result } = translationStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'hash-article1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: '# 文章一\n\n文章一的翻译内容。',
    });

    expect(result.entryId).toBe(entry1Id);
    expect(result.markdown).toContain('翻译');

    const latest = translationStore.getLatestByEntryId(entry1Id);
    expect(latest).not.toBeNull();
    expect(latest!.markdown).toContain('翻译');
  });

  // ── 3. Save/query UsageEvent ────────────────────────────────
  it('saves and queries usage events', () => {
    const now = new Date().toISOString();
    usageStore.record({
      taskRunId: null,
      entryId: entry1Id,
      taskType: 'summary',
      purpose: 'summary',
      providerId: 'test-provider',
      providerName: 'Test',
      model: 'gpt-4o',
      providerProfileId: null,
      modelProfileId: null,
      providerBaseUrlSnapshot: 'https://api.example.com',
      providerResolvedUrlSnapshot: null,
      providerResolvedHostSnapshot: null,
      providerResolvedPathSnapshot: null,
      providerNameSnapshot: null,
      modelNameSnapshot: 'gpt-4o',
      requestPhase: 'normal',
      requestStatus: 'succeeded',
      promptTokens: 500,
      completionTokens: 200,
      estimated: false,
      latencyMs: 1500,
      startedAt: now,
      finishedAt: now,
    });

    const events = usageStore.getByEntryId(entry1Id);
    expect(events).toHaveLength(1);
    expect(events[0].promptTokens).toBe(500);

    const summary = usageStore.getUsageSummary();
    expect(summary.totalRequests).toBe(1);
    expect(summary.successCount).toBe(1);
  });

  // ── 4. isRead/isStarred independence ────────────────────────
  it('starred does not affect isRead', () => {
    expect(entryStore.getById(entry1Id)!.isRead).toBe(false);
    expect(entryStore.getById(entry1Id)!.isStarred).toBe(false);

    entryStore.markStarred(entry1Id, true);
    const afterStar = entryStore.getById(entry1Id)!;
    expect(afterStar.isStarred).toBe(true);
    expect(afterStar.isRead).toBe(false); // still unread
  });

  it('isRead does not affect isStarred', () => {
    entryStore.markStarred(entry1Id, true);
    expect(entryStore.getById(entry1Id)!.isStarred).toBe(true);

    entryStore.markRead(entry1Id, true);
    const afterRead = entryStore.getById(entry1Id)!;
    expect(afterRead.isRead).toBe(true);
    expect(afterRead.isStarred).toBe(true); // still starred
  });

  it('unstar does not affect isRead', () => {
    entryStore.markStarred(entry1Id, true);
    entryStore.markRead(entry1Id, true);
    expect(entryStore.getById(entry1Id)!.isRead).toBe(true);

    entryStore.markStarred(entry1Id, false);
    const after = entryStore.getById(entry1Id)!;
    expect(after.isStarred).toBe(false);
    expect(after.isRead).toBe(true); // still read
  });

  it('mark unread does not affect isStarred', () => {
    entryStore.markStarred(entry1Id, true);
    entryStore.markRead(entry1Id, true);
    expect(entryStore.getById(entry1Id)!.isStarred).toBe(true);

    entryStore.markRead(entry1Id, false);
    const after = entryStore.getById(entry1Id)!;
    expect(after.isRead).toBe(false);
    expect(after.isStarred).toBe(true); // still starred
  });

  // ── 5. unreadCount only counts isRead=false ─────────────────
  it('unreadCount ignores isStarred, only counts isRead=false', () => {
    // Both unread initially
    expect(entryStore.getUnreadCount()).toBe(2);

    // Star entry1 (still unread)
    entryStore.markStarred(entry1Id, true);
    expect(entryStore.getUnreadCount()).toBe(2); // still 2 unread

    // Read entry1
    entryStore.markRead(entry1Id, true);
    expect(entryStore.getUnreadCount()).toBe(1); // only entry2 unread

    // Star entry2 (still unread)
    entryStore.markStarred(entry2Id, true);
    expect(entryStore.getUnreadCount()).toBe(1); // still 1 unread
  });

  // ── 6. ArticleContent cache integrity ───────────────────────
  it('AI result saving does not corrupt ArticleContent cache', () => {
    // Save AI results for entry1
    summaryStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      detailLevel: 'brief',
      outputLanguage: 'zh-CN',
      markdown: 'Brief summary for article 1',
    });
    translationStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: '# 翻译\n\n翻译内容。',
    });

    // Verify content is still intact
    const content1 = contentStore.getByEntryId(entry1Id)!;
    expect(content1.markdown).toBe('# Article One\n\nContent of article one.');
    expect(content1.entryId).toBe(entry1Id);

    // Verify entry2 content is NOT affected
    const content2 = contentStore.getByEntryId(entry2Id)!;
    expect(content2.markdown).toBe('# Article Two\n\nContent of article two.');
    expect(content2.entryId).toBe(entry2Id);
  });

  it('switching articles does not cross-contaminate content', () => {
    // Save summary for entry1
    summaryStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      detailLevel: 'standard',
      outputLanguage: 'zh-CN',
      markdown: 'Summary for article 1',
    });

    // Save summary for entry2
    summaryStore.save({
      entryId: entry2Id,
      targetLanguage: 'zh-CN',
      detailLevel: 'standard',
      outputLanguage: 'zh-CN',
      markdown: 'Summary for article 2',
    });

    // Verify each article's summary matches
    const s1 = summaryStore.getLatestByEntryId(entry1Id)!;
    expect(s1.entryId).toBe(entry1Id);
    expect(s1.markdown).toContain('article 1');

    const s2 = summaryStore.getLatestByEntryId(entry2Id)!;
    expect(s2.entryId).toBe(entry2Id);
    expect(s2.markdown).toContain('article 2');

    // Verify content still correct
    expect(contentStore.getByEntryId(entry1Id)!.markdown).toContain('Article One');
    expect(contentStore.getByEntryId(entry2Id)!.markdown).toContain('Article Two');
  });

  // ── 7. Full flow: read state + AI + content all together ────
  it('full flow: state + AI results + content all coexist', () => {
    // Mark entry1 as read+starred
    entryStore.markRead(entry1Id, true);
    entryStore.markStarred(entry1Id, true);

    // Save AI results
    summaryStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      detailLevel: 'standard',
      outputLanguage: 'zh-CN',
      markdown: 'Summary',
    });
    translationStore.save({
      entryId: entry1Id,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: 'Translation',
    });

    // Verify all states are independent
    const entry = entryStore.getById(entry1Id)!;
    expect(entry.isRead).toBe(true);
    expect(entry.isStarred).toBe(true);

    expect(summaryStore.getLatestByEntryId(entry1Id)!.markdown).toBe('Summary');
    expect(translationStore.getLatestByEntryId(entry1Id)!.markdown).toBe('Translation');
    expect(contentStore.getByEntryId(entry1Id)!.markdown).toContain('Article One');

    // entry2 is untouched
    const entry2 = entryStore.getById(entry2Id)!;
    expect(entry2.isRead).toBe(false);
    expect(entry2.isStarred).toBe(false);
    expect(summaryStore.getLatestByEntryId(entry2Id)).toBeNull();
    expect(translationStore.getLatestByEntryId(entry2Id)).toBeNull();
    expect(contentStore.getByEntryId(entry2Id)!.markdown).toContain('Article Two');
  });
});
