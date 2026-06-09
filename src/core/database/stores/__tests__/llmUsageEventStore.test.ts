import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../init';
import { createFeedStore } from '../feedStore';
import { createEntryStore } from '../entryStore';
import { createLLMUsageEventStore } from '../llmUsageEventStore';
import { createAgentTaskRunStore } from '../agentTaskRunStore';
import type { ILLMUsageEventStore } from '../llmUsageEventStore';

describe('LLMUsageEventStore', () => {
  let db: Database.Database;
  let store: ILLMUsageEventStore;
  let entryId: number;

  const baseContext = {
    taskRunId: null as number | null,
    entryId: null as number | null,
    taskType: 'summary' as const,
    purpose: 'summary' as const,
    providerId: 'provider-1',
    providerName: 'Test Provider',
    model: 'gpt-4o',
    providerProfileId: null as number | null,
    modelProfileId: null as number | null,
    providerBaseUrlSnapshot: 'https://api.example.com/v1',
    providerResolvedUrlSnapshot: null as string | null,
    providerResolvedHostSnapshot: null as string | null,
    providerResolvedPathSnapshot: null as string | null,
    providerNameSnapshot: null as string | null,
    modelNameSnapshot: 'gpt-4o',
    requestPhase: 'normal' as const,
    requestStatus: 'succeeded' as const,
    promptTokens: null as number | null,
    completionTokens: null as number | null,
    estimated: false,
    latencyMs: null as number | null,
    startedAt: null as string | null,
    finishedAt: null as string | null,
  };

  beforeEach(() => {
    db = createInMemoryDatabase();
    const feedStore = createFeedStore(db);
    const entryStore = createEntryStore(db);
    store = createLLMUsageEventStore(db);

    const feed = feedStore.upsert({
      feedUrl: 'https://example.com/rss',
      siteUrl: null,
      description: null,
      feedParserVersion: null,
      lastFetchedAt: null,
    });
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

  it('records a usage event', () => {
    const event = store.record({
      ...baseContext,
      entryId,
      promptTokens: 100,
      completionTokens: 50,
      latencyMs: 1200,
      startedAt: '2026-06-09T10:00:00.000Z',
      finishedAt: '2026-06-09T10:00:01.200Z',
    });

    expect(event.id).toBeGreaterThan(0);
    expect(event.entryId).toBe(entryId);
    expect(event.purpose).toBe('summary');
    expect(event.providerId).toBe('provider-1');
    expect(event.requestStatus).toBe('succeeded');
    expect(event.promptTokens).toBe(100);
  });

  it('gets by entryId', () => {
    store.record({ ...baseContext, entryId, purpose: 'summary' });
    store.record({ ...baseContext, entryId, purpose: 'translation', taskType: 'translation' });

    const events = store.getByEntryId(entryId);
    expect(events).toHaveLength(2);
  });

  it('gets recent events with filters', () => {
    store.record({ ...baseContext, entryId, purpose: 'summary' });
    store.record({ ...baseContext, entryId, purpose: 'translation', taskType: 'translation' });

    const summaryOnly = store.getRecentEvents({ taskType: 'summary' });
    expect(summaryOnly).toHaveLength(1);
    expect(summaryOnly[0].taskType).toBe('summary');
  });

  it('limits recent events', () => {
    for (let i = 0; i < 5; i++) {
      store.record({ ...baseContext, entryId });
    }
    const limited = store.getRecentEvents({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('links recent events to task run', () => {
    const startedAt = '2026-06-09T10:00:00.000Z';
    const finishedAt = '2026-06-09T10:00:01.000Z';

    store.record({
      ...baseContext,
      entryId,
      startedAt,
      finishedAt,
    });

    // Create a real AgentTaskRun for the FK constraint
    const taskRunStore = createAgentTaskRunStore(db);
    const run = taskRunStore.create({ entryId, taskType: 'summary', status: 'succeeded' });

    store.linkRecentEventsToTaskRun(run.id, entryId, 'summary', startedAt, finishedAt);

    const events = store.getByTaskRunId(run.id);
    expect(events).toHaveLength(1);
    expect(events[0].taskRunId).toBe(run.id);
  });

  it('computes usage summary', () => {
    store.record({
      ...baseContext,
      entryId,
      promptTokens: 100,
      completionTokens: 50,
      requestStatus: 'succeeded',
    });
    store.record({
      ...baseContext,
      entryId,
      promptTokens: 200,
      completionTokens: 100,
      requestStatus: 'failed',
    });

    const summary = store.getUsageSummary();
    expect(summary.totalRequests).toBe(2);
    expect(summary.successCount).toBe(1);
    expect(summary.failureCount).toBe(1);
  });

  it('deletes by entryId', () => {
    store.record({ ...baseContext, entryId });
    store.record({ ...baseContext, entryId });
    store.deleteByEntryId(entryId);
    expect(store.getByEntryId(entryId)).toHaveLength(0);
  });
});
