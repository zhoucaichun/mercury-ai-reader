import { exportCurrentArticle as createExportFile } from '../export';
import { MockLLMProvider } from '../agent/providers/mockProvider';
import type { Week3AgentArticleInput } from '../agent/runtime/types';
import type { Week3LLMProvider } from '../agent/providers/types';
import type { Week3LLMUsageEvent, Week3LLMUsageSummary } from '../usage/types';
import {
  BrowserLocalStorageLLMUsageEventStore,
  callLLMWithUsage,
  summarizeUsage,
  type LLMUsageEventStore
} from '../usage/usage';

export type Week3SummaryDetailLevel = 'brief' | 'standard';

export interface Week3SummaryRequest extends Week3AgentArticleInput {
  targetLanguage: 'zh-CN' | 'en-US' | string;
  detailLevel: Week3SummaryDetailLevel;
  regenerate?: boolean;
}

export interface Week3SummaryResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  detailLevel: Week3SummaryDetailLevel;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface Week3TranslationRequest extends Week3AgentArticleInput {
  targetLanguage: string;
  sourceLanguage?: string;
  regenerate?: boolean;
}

export interface Week3TranslationResult {
  id: string;
  articleId: string;
  contentId?: string;
  taskId: string;
  targetLanguage: string;
  sourceLanguage?: string;
  markdown: string;
  providerId: string;
  providerName: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface Week3MarkdownExportData {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  feedTitle?: string;
  canonicalMarkdown: string;
  summaryMarkdown?: string;
  translationMarkdown?: string;
  exportedAt?: string;
}

export interface Week3MarkdownExportFile {
  fileName: string;
  markdown: string;
}

export interface Week3AgentUiPort {
  generateSummary(request: Week3SummaryRequest): Promise<Week3SummaryResult>;
  translateArticle(request: Week3TranslationRequest): Promise<Week3TranslationResult>;
  listUsageEvents?(): Promise<Week3LLMUsageEvent[]>;
  getUsageSummary?(): Promise<Week3LLMUsageSummary>;
  exportCurrentArticle(data: Week3MarkdownExportData): Promise<Week3MarkdownExportFile>;
}

export interface CreateBrowserWeek3AgentUiPortOptions {
  provider?: Week3LLMProvider;
  usageStore?: LLMUsageEventStore;
}

export function createBrowserWeek3AgentUiPort(
  options: CreateBrowserWeek3AgentUiPortOptions = {}
): Week3AgentUiPort {
  const provider = options.provider ?? createReaderMockProvider();
  const usageStore = options.usageStore ?? new BrowserLocalStorageLLMUsageEventStore();

  return {
    async generateSummary(request) {
      assertCanonicalMarkdown(request.canonicalMarkdown);

      const taskId = createTaskId('summary', request.articleId, request.regenerate);
      const response = await callLLMWithUsage(
        provider,
        {
          purpose: 'summary',
          model: provider.config.model,
          messages: [
            {
              role: 'system',
              content:
                'You are Mercury AI Reader summary assistant. Return concise Markdown only, based on the article content.'
            },
            {
              role: 'user',
              content: [
                `Title: ${request.title}`,
                `Source URL: ${request.sourceUrl}`,
                request.feedTitle ? `Feed: ${request.feedTitle}` : '',
                request.author ? `Author: ${request.author}` : '',
                request.publishedAt ? `Published at: ${request.publishedAt}` : '',
                `Target language: ${request.targetLanguage}`,
                `Detail level: ${request.detailLevel}`,
                '',
                request.canonicalMarkdown
              ]
                .filter(Boolean)
                .join('\n')
            }
          ],
          metadata: {
            taskId,
            articleId: request.articleId,
            contentId: request.contentId,
            agentType: 'summary',
            targetLanguage: request.targetLanguage,
            detailLevel: request.detailLevel
          }
        },
        usageStore
      );

      const createdAt = new Date().toISOString();
      return {
        id: `summary-result-${createdAt}-${randomSuffix()}`,
        articleId: request.articleId,
        contentId: request.contentId,
        taskId,
        targetLanguage: request.targetLanguage,
        detailLevel: request.detailLevel,
        markdown: response.content,
        providerId: response.providerId,
        providerName: response.providerName,
        model: response.model,
        createdAt,
        updatedAt: createdAt
      };
    },

    async translateArticle(request) {
      assertCanonicalMarkdown(request.canonicalMarkdown);

      const taskId = createTaskId('translation', request.articleId, request.regenerate);
      const response = await callLLMWithUsage(
        provider,
        {
          purpose: 'translation',
          model: provider.config.model,
          messages: [
            {
              role: 'system',
              content:
                'You are Mercury AI Reader translation assistant. Preserve Markdown structure and return translated Markdown only.'
            },
            {
              role: 'user',
              content: [
                `Title: ${request.title}`,
                `Source URL: ${request.sourceUrl}`,
                `Source language: ${request.sourceLanguage ?? 'auto'}`,
                `Target language: ${request.targetLanguage}`,
                '',
                request.canonicalMarkdown
              ].join('\n')
            }
          ],
          metadata: {
            taskId,
            articleId: request.articleId,
            contentId: request.contentId,
            agentType: 'translation',
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage
          }
        },
        usageStore
      );

      const createdAt = new Date().toISOString();
      return {
        id: `translation-result-${createdAt}-${randomSuffix()}`,
        articleId: request.articleId,
        contentId: request.contentId,
        taskId,
        targetLanguage: request.targetLanguage,
        sourceLanguage: request.sourceLanguage,
        markdown: response.content,
        providerId: response.providerId,
        providerName: response.providerName,
        model: response.model,
        createdAt,
        updatedAt: createdAt
      };
    },

    async listUsageEvents() {
      return usageStore.list();
    },

    async getUsageSummary() {
      return summarizeUsage(await usageStore.list());
    },

    exportCurrentArticle(data) {
      return createExportFile(data);
    }
  };
}

function createReaderMockProvider(): Week3LLMProvider {
  return new MockLLMProvider({
    providerId: 'mock-provider',
    providerName: 'Mock Provider',
    kind: 'mock',
    baseUrl: 'mock://local',
    model: 'mock-reader-ui-v1'
  });
}

function assertCanonicalMarkdown(value: string): void {
  if (!value.trim()) {
    throw new Error('canonicalMarkdown is required before running AI processing.');
  }
}

function createTaskId(agentType: 'summary' | 'translation', articleId: string, regenerate?: boolean): string {
  const mode = regenerate ? 'regenerate' : 'generate';
  return `${agentType}-${articleId}-${mode}-${Date.now()}-${randomSuffix()}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
