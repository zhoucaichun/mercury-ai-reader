import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import { createEntryStore } from '../entryStore';
import { createSummaryResultStore } from '../summaryResultStore';
import type { ISummaryResultStore } from '../summaryResultStore';

describe('SummaryResultStore', () => {
  let db: Database.Database;
  let store: ISummaryResultStore;
  let entryId: number;

  beforeEach(() => {
    db = createInMemoryDatabase();
    const feedStore = createFeedStore(db);
    const entryStore = createEntryStore(db);
    store = createSummaryResultStore(db);

    const feed = feedStore.upsert({ feedUrl: 'https://example.com/rss' });
    const entry = entryStore.upsert({
      feedId: feed.id,
      guid: 'test-1',
      url: 'https://example.com/1',
      title: 'Test',
      author: null,
      publishedAt: null,
      summary: null,
    });
    entryId = entry.id;
  });

  it('saves a summary result', () => {
    const { run, result } = store.save({
      entryId,
      targetLanguage: 'zh-CN',
      detailLevel: 'standard',
      outputLanguage: 'zh-CN',
      markdown: '# Summary\n\nThis is a summary.',
    });

    expect(run.id).toBeGreaterThan(0);
    expect(run.taskType).toBe('summary');
    expect(run.status).toBe('succeeded');
    expect(result.taskRunId).toBe(run.id);
    expect(result.entryId).toBe(entryId);
    expect(result.markdown).toBe('# Summary\n\nThis is a summary.');
    expect(result.detailLevel).toBe('standard');
  });

  it('queries by entryId', () => {
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      detailLevel: 'brief',
      outputLanguage: 'zh-CN',
      markdown: 'Brief summary',
    });
    store.save({
      entryId,
      targetLanguage: 'en-US',
      detailLevel: 'standard',
      outputLanguage: 'en-US',
      markdown: 'Standard summary',
    });

    const results = store.getByEntryId(entryId);
    expect(results).toHaveLength(2);
  });

  it('gets latest by entryId', () => {
    store.save({
      entryId,
      targetLanguage: 'en-US',
      detailLevel: 'brief',
      outputLanguage: 'en-US',
      markdown: 'English brief',
    });
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      detailLevel: 'brief',
      outputLanguage: 'zh-CN',
      markdown: 'Chinese brief',
    });

    const results = store.getByEntryId(entryId);
    expect(results).toHaveLength(2);

    // Latest by updatedAt — both exist as different slots (different targetLanguage)
    const latest = store.getLatestByEntryId(entryId);
    expect(latest).not.toBeNull();
    expect(latest!.entryId).toBe(entryId);
  });

  it('deduplicates by slot (entryId, targetLanguage, detailLevel)', () => {
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      detailLevel: 'brief',
      outputLanguage: 'zh-CN',
      markdown: 'First version',
    });
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      detailLevel: 'brief',
      outputLanguage: 'zh-CN',
      markdown: 'Updated version',
    });

    const results = store.getByEntryId(entryId);
    // Should be deduplicated by slot: only 1 record for (entryId, zh-CN, brief)
    expect(results).toHaveLength(1);
    expect(results[0].markdown).toBe('Updated version');
  });

  it('returns null for non-existent entryId', () => {
    expect(store.getLatestByEntryId(999)).toBeNull();
  });

  it('deletes by taskRunId', () => {
    const { result } = store.save({
      entryId,
      targetLanguage: 'zh-CN',
      detailLevel: 'brief',
      outputLanguage: 'zh-CN',
      markdown: 'To delete',
    });
    store.deleteByTaskRunId(result.taskRunId);
    expect(store.getByEntryId(entryId)).toHaveLength(0);
  });
});
