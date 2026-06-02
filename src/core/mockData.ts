import type { MercuryMockDataset } from './types';

export const mockDataset: MercuryMockDataset = {
  feeds: [
    {
      id: 'feed-hacker-news',
      title: 'Hacker News Front Page',
      siteUrl: 'https://news.ycombinator.com/',
      feedUrl: 'https://hnrss.org/frontpage',
      unreadCount: 4,
      status: 'ready',
      lastSyncedAt: '2026-06-02T02:30:00.000Z'
    },
    {
      id: 'feed-ai-systems',
      title: 'AI Systems Digest',
      siteUrl: 'https://example.com/ai-systems',
      feedUrl: 'https://example.com/ai-systems/atom.xml',
      unreadCount: 7,
      status: 'syncing',
      lastSyncedAt: '2026-06-02T01:48:00.000Z'
    },
    {
      id: 'feed-reader-design',
      title: 'Reader UX Weekly',
      siteUrl: 'https://example.com/reader-ux',
      feedUrl: 'https://example.com/reader-ux/feed.xml',
      unreadCount: 2,
      status: 'error',
      lastSyncedAt: '2026-05-27T22:12:00.000Z'
    }
  ],
  articles: [
    {
      id: 'article-hn-local-first-sync',
      feedId: 'feed-hacker-news',
      title: 'Designing a Local-First Sync Loop',
      author: 'Mercury Mock Team',
      url: 'https://news.ycombinator.com/',
      excerpt:
        'A Week2 reader sample that exercises the same shape T5 will write after syncing a real feed into local storage.',
      publishedAt: '2026-06-02T02:20:00.000Z',
      readState: 'reading',
      estimatedMinutes: 6,
      tags: ['Week2', 'Reader', 'Local-first']
    },
    {
      id: 'article-agent-contract',
      feedId: 'feed-ai-systems',
      title: 'Keeping Agent Runtime and Provider Contracts Separate',
      author: 'Mercury Mock Team',
      url: 'https://example.com/ai-systems/agent-provider-contract',
      excerpt:
        'Provider configuration, prompt templates, usage records, and agent status can share types without collapsing into one llm folder.',
      publishedAt: '2026-05-27T18:45:00.000Z',
      readState: 'unread',
      estimatedMinutes: 8,
      tags: ['Agent', 'Provider', 'Usage']
    },
    {
      id: 'article-reader-layout',
      feedId: 'feed-reader-design',
      title: 'A Three-Pane Reader Shell for Fast Triage',
      author: 'Mercury Mock Team',
      url: 'https://example.com/reader-ux/three-pane-shell',
      excerpt:
        'The first app shell should make feed selection, article scanning, reading, and AI entry points visible without waiting for storage.',
      publishedAt: '2026-05-26T11:10:00.000Z',
      readState: 'saved',
      estimatedMinutes: 5,
      tags: ['Reader', 'UI', 'Mock']
    }
  ],
  contents: [
    {
      articleId: 'article-hn-local-first-sync',
      sourceHtml:
        '<article><h1>Designing a Local-First Sync Loop</h1><p>Raw source HTML placeholder.</p></article>',
      cleanedHtml:
        '<p>Mercury keeps feed metadata, article records, cleaned content, and AI results on the user device first. Week2 now treats the reader as a consumer of <code>Week2ReaderDataPort</code>, so the same UI can read from mock data today and T2/T5 storage after integration.</p><p>The reading page deliberately shows the synced feed source, article metadata, and a non-empty content entry. T3 can replace the parser, T5 can replace the sync source, and T2 can swap mock arrays for SQLite without forcing T7 to change its component boundary.</p>',
      canonicalMarkdown:
        '# Designing a Local-First Sync Loop\n\nMercury keeps feed metadata, article records, cleaned content, and AI results on the user device first.\n\nWeek2 now treats the reader as a consumer of Week2ReaderDataPort, so the same UI can read from mock data today and T2/T5 storage after integration.\n\nThe reading page deliberately shows the synced feed source, article metadata, and a non-empty content entry.',
      createdAt: '2026-06-02T02:25:00.000Z',
      updatedAt: '2026-06-02T02:25:00.000Z'
    },
    {
      articleId: 'article-agent-contract',
      sourceHtml:
        '<article><h1>Keeping Agent Runtime and Provider Contracts Separate</h1><p>Raw source HTML placeholder.</p></article>',
      cleanedHtml:
        '<p>Mercury keeps Agent Runtime under the agent feature area and usage records under the usage feature area. Provider configuration belongs beside agent contracts because Summary and Translation should share one calling shape.</p><p>This avoids a parallel <code>src/features/llm</code> tree that would fight the final directory plan.</p>',
      canonicalMarkdown:
        '# Keeping Agent Runtime and Provider Contracts Separate\n\nMercury keeps Agent Runtime under the agent feature area and usage records under the usage feature area.\n\nProvider configuration belongs beside agent contracts because Summary and Translation should share one calling shape.\n\nThis avoids a parallel src/features/llm tree that would fight the final directory plan.',
      createdAt: '2026-06-02T01:50:00.000Z',
      updatedAt: '2026-06-02T01:50:00.000Z'
    },
    {
      articleId: 'article-reader-layout',
      sourceHtml:
        '<article><h1>A Three-Pane Reader Shell for Fast Triage</h1><p>Raw source HTML placeholder.</p></article>',
      cleanedHtml:
        '<p>A desktop reader benefits from stable regions: feeds, articles, and the current reading surface. The mock shell also leaves room for Summary, Translation, Export, and Usage without pretending those modules are finished.</p>',
      canonicalMarkdown:
        '# A Three-Pane Reader Shell for Fast Triage\n\nA desktop reader benefits from stable regions: feeds, articles, and the current reading surface.\n\nThe mock shell also leaves room for Summary, Translation, Export, and Usage without pretending those modules are finished.',
      createdAt: '2026-05-26T11:18:00.000Z',
      updatedAt: '2026-05-26T11:18:00.000Z'
    }
  ],
  providers: [
    {
      id: 'provider-openai-compatible',
      name: 'OpenAI-compatible Mock',
      baseUrl: 'http://localhost:8000/v1',
      model: 'mock-reader-model',
      status: 'mock'
    }
  ],
  agentPreviews: [
    {
      taskType: 'summary',
      status: 'succeeded',
      model: 'mock-reader-model',
      output:
        '本地优先阅读器应先稳定 Feed、Article、Content 的边界，再让 Summary / Translation 复用统一 Provider 契约。',
      updatedAt: '2026-05-28T05:42:00.000Z'
    },
    {
      taskType: 'translation',
      status: 'idle',
      model: 'mock-reader-model',
      output:
        'A local-first reader should stabilize Feed, Article, and Content boundaries before wiring real AI calls.',
      updatedAt: '2026-05-28T05:42:00.000Z'
    }
  ],
  usageEvents: [
    {
      id: 'usage-001',
      providerId: 'provider-openai-compatible',
      providerName: 'OpenAI-compatible Mock',
      purpose: 'summary',
      model: 'mock-reader-model',
      status: 'succeeded',
      promptTokens: 820,
      completionTokens: 138,
      totalTokens: 958,
      estimated: true,
      startedAt: '2026-06-02T02:42:00.000Z',
      finishedAt: '2026-06-02T02:42:01.200Z',
      latencyMs: 1200
    },
    {
      id: 'usage-002',
      providerId: 'provider-openai-compatible',
      providerName: 'OpenAI-compatible Mock',
      purpose: 'translation',
      model: 'mock-reader-model',
      status: 'succeeded',
      promptTokens: 760,
      completionTokens: 212,
      totalTokens: 972,
      estimated: true,
      startedAt: '2026-06-02T02:44:00.000Z',
      finishedAt: '2026-06-02T02:44:01.500Z',
      latencyMs: 1500
    }
  ]
};
