import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import { createEntryStore } from '../entryStore';
import { createAgentTaskRunStore } from '../agentTaskRunStore';
import type { IAgentTaskRunStore } from '../agentTaskRunStore';

describe('AgentTaskRunStore', () => {
  let db: Database.Database;
  let store: IAgentTaskRunStore;
  let entryId: number;

  beforeEach(() => {
    db = createInMemoryDatabase();
    const feedStore = createFeedStore(db);
    const entryStore = createEntryStore(db);
    store = createAgentTaskRunStore(db);

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

  it('creates a task run with defaults', () => {
    const run = store.create({ entryId, taskType: 'summary', status: 'queued' });
    expect(run.id).toBeGreaterThan(0);
    expect(run.entryId).toBe(entryId);
    expect(run.taskType).toBe('summary');
    expect(run.status).toBe('queued');
    expect(run.errorMessage).toBeNull();
    expect(run.errorCode).toBeNull();
  });

  it('creates with all params', () => {
    const run = store.create({
      entryId,
      taskType: 'translation',
      status: 'running',
      targetLanguage: 'zh-CN',
      durationMs: 1500,
      errorCode: null,
    });
    expect(run.targetLanguage).toBe('zh-CN');
    expect(run.durationMs).toBe(1500);
  });

  it('gets by id', () => {
    const run = store.create({ entryId, taskType: 'summary', status: 'queued' });
    const found = store.getById(run.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(run.id);
  });

  it('getById returns null for missing', () => {
    expect(store.getById(999)).toBeNull();
  });

  it('gets by entryId', () => {
    store.create({ entryId, taskType: 'summary', status: 'succeeded' });
    store.create({ entryId, taskType: 'translation', status: 'running' });
    const runs = store.getByEntryId(entryId);
    expect(runs).toHaveLength(2);
  });

  it('gets by entryId and taskType', () => {
    store.create({ entryId, taskType: 'summary', status: 'succeeded' });
    store.create({ entryId, taskType: 'translation', status: 'running' });
    const runs = store.getByEntryIdAndTaskType(entryId, 'summary');
    expect(runs).toHaveLength(1);
    expect(runs[0].taskType).toBe('summary');
  });

  it('updates status', () => {
    const run = store.create({ entryId, taskType: 'summary', status: 'queued' });
    store.updateStatus(run.id, 'running');
    expect(store.getById(run.id)!.status).toBe('running');

    store.updateStatus(run.id, 'succeeded', { durationMs: 2000 });
    const updated = store.getById(run.id)!;
    expect(updated.status).toBe('succeeded');
    expect(updated.durationMs).toBe(2000);
  });

  it('updates status with error info', () => {
    const run = store.create({ entryId, taskType: 'summary', status: 'running' });
    store.updateStatus(run.id, 'failed', {
      durationMs: 500,
      errorMessage: 'timeout',
      errorCode: 'timeout',
    });
    const updated = store.getById(run.id)!;
    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toBe('timeout');
    expect(updated.errorCode).toBe('timeout');
  });

  it('deletes by id', () => {
    const run = store.create({ entryId, taskType: 'summary', status: 'queued' });
    store.delete(run.id);
    expect(store.getById(run.id)).toBeNull();
  });

  it('deletes by entryId', () => {
    store.create({ entryId, taskType: 'summary', status: 'queued' });
    store.create({ entryId, taskType: 'translation', status: 'queued' });
    store.deleteByEntryId(entryId);
    expect(store.getByEntryId(entryId)).toHaveLength(0);
  });
});
