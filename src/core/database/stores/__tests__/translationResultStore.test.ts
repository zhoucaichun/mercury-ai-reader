import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import { createEntryStore } from '../entryStore';
import { createTranslationResultStore } from '../translationResultStore';
import type { ITranslationResultStore } from '../translationResultStore';

describe('TranslationResultStore', () => {
  let db: Database.Database;
  let store: ITranslationResultStore;
  let entryId: number;

  beforeEach(() => {
    db = createInMemoryDatabase();
    const feedStore = createFeedStore(db);
    const entryStore = createEntryStore(db);
    store = createTranslationResultStore(db);

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

  it('saves a translation result', () => {
    const { run, result } = store.save({
      entryId,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'abc123',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: '# 翻译\n\n这是翻译后的内容。',
    });

    expect(run.id).toBeGreaterThan(0);
    expect(run.taskType).toBe('translation');
    expect(run.status).toBe('succeeded');
    expect(result.taskRunId).toBe(run.id);
    expect(result.entryId).toBe(entryId);
    expect(result.markdown).toBe('# 翻译\n\n这是翻译后的内容。');
    expect(result.targetLanguage).toBe('zh-CN');
  });

  it('queries by entryId', () => {
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: 'Chinese translation',
    });
    store.save({
      entryId,
      targetLanguage: 'ja',
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'ja',
      markdown: 'Japanese translation',
    });

    const results = store.getByEntryId(entryId);
    expect(results).toHaveLength(2);
  });

  it('gets latest by entryId', () => {
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: 'First',
    });

    const latest = store.getLatestByEntryId(entryId);
    expect(latest).not.toBeNull();
    expect(latest!.markdown).toBe('First');
  });

  it('deduplicates by slot (entryId, targetLanguage)', () => {
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: 'First version',
    });
    store.save({
      entryId,
      targetLanguage: 'zh-CN',
      sourceContentHash: 'h2',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: 'Updated version',
    });

    const results = store.getByEntryId(entryId);
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
      sourceContentHash: 'h1',
      segmenterVersion: '1.0',
      outputLanguage: 'zh-CN',
      markdown: 'To delete',
    });
    store.deleteByTaskRunId(result.taskRunId);
    expect(store.getByEntryId(entryId)).toHaveLength(0);
  });
});
