import type { MercuryMockDataset } from './types';

export const mockDataset: MercuryMockDataset = {
  feeds: [
    {
      id: 'feed-local-first',
      title: 'Local First Notes',
      siteUrl: 'https://example.com/local-first',
      feedUrl: 'https://example.com/local-first/rss.xml',
      unreadCount: 4,
      status: 'ready',
      lastSyncedAt: '2026-05-28T05:30:00.000Z'
    },
    {
      id: 'feed-ai-systems',
      title: 'AI Systems Digest',
      siteUrl: 'https://example.com/ai-systems',
      feedUrl: 'https://example.com/ai-systems/atom.xml',
      unreadCount: 7,
      status: 'syncing',
      lastSyncedAt: '2026-05-28T04:48:00.000Z'
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
      id: 'article-local-first-sync',
      feedId: 'feed-local-first',
      title: 'Designing a Local-First Sync Loop',
      author: 'Mercury Mock Team',
      url: 'https://example.com/local-first/sync-loop',
      excerpt:
        'A compact walkthrough of how feed records, article snapshots, and reader content can move through a local-first desktop app.',
      publishedAt: '2026-05-28T03:20:00.000Z',
      readState: 'reading',
      estimatedMinutes: 6,
      tags: ['Sync', 'SQLite', 'Local-first']
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
      articleId: 'article-local-first-sync',
      sourceHtml:
        '<article><h1>Designing a Local-First Sync Loop</h1><p>Raw source HTML placeholder.</p></article>',
      cleanedHtml:
        '<p>Mercury keeps feed metadata, article records, cleaned content, and AI results on the user device first. Sync starts with a feed URL, normalizes article metadata, then stores records through the local persistence layer.</p><p>The first T1 mock keeps those boundaries visible. T3 can replace the feed parser, T5 can replace the sync source, and T2 can swap mock arrays for SQLite without forcing the UI to change shape.</p>',
      canonicalMarkdown:
        '# Designing a Local-First Sync Loop\n\nMercury keeps feed metadata, article records, cleaned content, and AI results on the user device first.\n\nSync starts with a feed URL, normalizes article metadata, then stores records through the local persistence layer.\n\nThe first T1 mock keeps those boundaries visible so T2, T3, T5, and T7 can integrate gradually.'
    },
    {
      articleId: 'article-agent-contract',
      sourceHtml:
        '<article><h1>Keeping Agent Runtime and Provider Contracts Separate</h1><p>Raw source HTML placeholder.</p></article>',
      cleanedHtml:
        '<p>Mercury keeps Agent Runtime under the agent feature area and usage records under the usage feature area. Provider configuration belongs beside agent contracts because Summary and Translation should share one calling shape.</p><p>This avoids a parallel <code>src/features/llm</code> tree that would fight the final directory plan.</p>',
      canonicalMarkdown:
        '# Keeping Agent Runtime and Provider Contracts Separate\n\nMercury keeps Agent Runtime under the agent feature area and usage records under the usage feature area.\n\nProvider configuration belongs beside agent contracts because Summary and Translation should share one calling shape.\n\nThis avoids a parallel src/features/llm tree that would fight the final directory plan.'
    },
    {
      articleId: 'article-reader-layout',
      sourceHtml:
        '<article><h1>A Three-Pane Reader Shell for Fast Triage</h1><p>Raw source HTML placeholder.</p></article>',
      cleanedHtml:
        '<p>A desktop reader benefits from stable regions: feeds, articles, and the current reading surface. The mock shell also leaves room for Summary, Translation, Export, and Usage without pretending those modules are finished.</p>',
      canonicalMarkdown:
        '# A Three-Pane Reader Shell for Fast Triage\n\nA desktop reader benefits from stable regions: feeds, articles, and the current reading surface.\n\nThe mock shell also leaves room for Summary, Translation, Export, and Usage without pretending those modules are finished.'
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
  translationResults: [
    {
      id: 'translation-001',
      articleId: 'article-local-first-sync',
      targetLanguage: 'zh-CN',
      translatedText:
        '# 设计一个本地优先的同步循环\n\nMercury 将 feed 元数据、文章记录、清洗后的内容和 AI 结果首先保存在用户设备上。\n\n同步从 feed URL 开始，标准化文章元数据，然后通过本地持久层存储记录。\n\n第一个 T1 mock 保持这些边界可见，以便 T2、T3、T5 和 T7 可以逐步集成。',
      status: 'succeeded',
      providerId: 'provider-openai-compatible',
      model: 'mock-reader-model',
      promptTokens: 760,
      completionTokens: 212,
      totalTokens: 972,
      createdAt: '2026-05-28T05:44:00.000Z',
      updatedAt: '2026-05-28T05:44:00.000Z'
    },
    {
      id: 'translation-002',
      articleId: 'article-agent-contract',
      targetLanguage: 'zh-CN',
      translatedText:
        '# 保持 Agent Runtime 和 Provider 契约分离\n\nMercury 将 Agent Runtime 放在 agent 功能区域下，将 usage 记录放在 usage 功能区域下。\n\nProvider 配置应该放在 agent 契约旁边，因为 Summary 和 Translation 应该共享同一个调用形状。\n\n这避免了一个并行的 src/features/llm 树，它会导致与最终目录计划冲突。',
      status: 'idle',
      providerId: 'provider-openai-compatible',
      model: 'mock-reader-model',
      createdAt: '2026-05-28T04:00:00.000Z',
      updatedAt: '2026-05-28T04:00:00.000Z'
    }
  ],
  usageEvents: [
    {
      id: 'usage-001',
      providerId: 'provider-openai-compatible',
      taskType: 'summary',
      model: 'mock-reader-model',
      promptTokens: 820,
      completionTokens: 138,
      totalTokens: 958,
      createdAt: '2026-05-28T05:42:00.000Z'
    },
    {
      id: 'usage-002',
      providerId: 'provider-openai-compatible',
      taskType: 'translation',
      model: 'mock-reader-model',
      promptTokens: 760,
      completionTokens: 212,
      totalTokens: 972,
      createdAt: '2026-05-28T05:44:00.000Z'
    }
  ]
};
