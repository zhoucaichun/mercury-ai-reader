import { createLLMProvider } from '../src/features/agent/providers/providerFactory.js';
import type {
  Week3LLMConnectionTestResult,
  Week3LLMProviderConfig
} from '../src/features/agent/providers/types.js';
import {
  callLLMWithUsage,
  InMemoryLLMUsageEventStore,
  streamLLMWithUsage,
  summarizeUsage,
  testLLMConnectionWithUsage
} from '../src/features/usage/usage.js';
import type { Week3LLMUsageEvent, Week3LLMUsageSummary } from '../src/features/usage/types.js';

export type Week3SummaryDetailLevel = 'brief' | 'standard';

export interface Week3AgentArticleInput {
  articleId: string;
  contentId?: string;
  title: string;
  sourceUrl: string;
  feedTitle?: string;
  author?: string;
  publishedAt?: string;
  canonicalMarkdown: string;
}

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

export interface Week3AiIpcInput<TRequest> {
  config: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  request: TRequest;
}

const usageStore = new InMemoryLLMUsageEventStore();
const TRANSLATION_CHUNK_CHAR_LIMIT = 3500;

export async function testWeek3ProviderConnection(
  configInput: Week3AiIpcInput<unknown>['config']
): Promise<Week3LLMConnectionTestResult> {
  const provider = createProvider(configInput);

  try {
    const response = await testLLMConnectionWithUsage(provider, usageStore);
    return {
      providerId: response.providerId,
      providerName: response.providerName,
      model: response.model,
      status: 'succeeded',
      latencyMs: response.latencyMs
    };
  } catch (error) {
    return {
      providerId: provider.config.providerId,
      providerName: provider.config.providerName,
      model: provider.config.model,
      status: 'failed',
      errorMessage: normalizeError(error)
    };
  }
}

export async function generateWeek3Summary(
  input: Week3AiIpcInput<Week3SummaryRequest>
): Promise<Week3SummaryResult> {
  assertCanonicalMarkdown(input.request.canonicalMarkdown);
  const provider = createProvider(input.config);
  const taskId = createTaskId('summary', input.request.articleId, input.request.regenerate);

  const response = await callWeek3LLM(
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
            `Title: ${input.request.title}`,
            `Source URL: ${input.request.sourceUrl}`,
            input.request.feedTitle ? `Feed: ${input.request.feedTitle}` : '',
            input.request.author ? `Author: ${input.request.author}` : '',
            input.request.publishedAt ? `Published at: ${input.request.publishedAt}` : '',
            `Target language: ${input.request.targetLanguage}`,
            `Detail level: ${input.request.detailLevel}`,
            '',
            input.request.canonicalMarkdown
          ]
            .filter(Boolean)
            .join('\n')
        }
      ],
      metadata: {
        taskId,
        articleId: input.request.articleId,
        contentId: input.request.contentId,
        agentType: 'summary',
        targetLanguage: input.request.targetLanguage,
        detailLevel: input.request.detailLevel
      }
    }
  );

  const createdAt = new Date().toISOString();
  return {
    id: `summary-result-${createdAt}-${randomSuffix()}`,
    articleId: input.request.articleId,
    contentId: input.request.contentId,
    taskId,
    targetLanguage: input.request.targetLanguage,
    detailLevel: input.request.detailLevel,
    markdown: response.content,
    providerId: response.providerId,
    providerName: response.providerName,
    model: response.model,
    createdAt,
    updatedAt: createdAt
  };
}

export async function translateWeek3Article(
  input: Week3AiIpcInput<Week3TranslationRequest>
): Promise<Week3TranslationResult> {
  assertCanonicalMarkdown(input.request.canonicalMarkdown);
  const provider = createProvider(input.config);
  const taskId = createTaskId('translation', input.request.articleId, input.request.regenerate);
  const chunks = splitMarkdownIntoChunks(input.request.canonicalMarkdown, TRANSLATION_CHUNK_CHAR_LIMIT);
  const translatedChunks: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const response = await callWeek3LLM(
      provider,
      {
        purpose: 'translation',
        model: provider.config.model,
        temperature: 0.2,
        maxTokens: 4096,
        messages: [
          {
            role: 'system',
            content:
              'You are Mercury AI Reader translation assistant. Translate only the provided Markdown chunk. Preserve Markdown structure, links, lists, headings, code blocks, and meaning. Return translated Markdown only.'
          },
          {
            role: 'user',
            content: [
              `Title: ${input.request.title}`,
              `Source URL: ${input.request.sourceUrl}`,
              `Source language: ${input.request.sourceLanguage ?? 'auto'}`,
              `Target language: ${input.request.targetLanguage}`,
              `Chunk: ${index + 1}/${chunks.length}`,
              '',
              chunk
            ].join('\n')
          }
        ],
        metadata: {
          taskId,
          articleId: input.request.articleId,
          contentId: input.request.contentId,
          agentType: 'translation',
          sourceLanguage: input.request.sourceLanguage,
          targetLanguage: input.request.targetLanguage,
          chunkIndex: index,
          chunkCount: chunks.length
        }
      }
    );
    translatedChunks.push(response.content.trim());
  }

  const createdAt = new Date().toISOString();
  return {
    id: `translation-result-${createdAt}-${randomSuffix()}`,
    articleId: input.request.articleId,
    contentId: input.request.contentId,
    taskId,
    targetLanguage: input.request.targetLanguage,
    sourceLanguage: input.request.sourceLanguage,
    markdown: translatedChunks.join('\n\n'),
    providerId: provider.config.providerId,
    providerName: provider.config.providerName,
    model: provider.config.model,
    createdAt,
    updatedAt: createdAt
  };
}

export interface Week3TranslateTextInput {
  config: { baseUrl: string; model: string; apiKey: string };
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export async function translateWeek3Text(
  input: Week3TranslateTextInput
): Promise<{ translatedText: string }> {
  const provider = createProvider(input.config);
  const request = {
    purpose: 'translation' as const,
    model: provider.config.model,
    messages: [
      {
        role: 'system' as const,
        content: 'You are a translation assistant. Translate the given text accurately. Return ONLY the translated text, no explanations or extra formatting.'
      },
      {
        role: 'user' as const,
        content: `Translate the following from ${input.sourceLanguage ?? 'auto-detect'} to ${input.targetLanguage}:\n\n${input.text}`
      }
    ],
    metadata: {
      taskId: `inline-translation-${Date.now()}-${randomSuffix()}`,
      articleId: '',
      agentType: 'translation',
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage
    }
  };

  const response = await callWeek3LLM(provider, request);

  return { translatedText: response.content };
}

export async function listWeek3UsageEvents(): Promise<Week3LLMUsageEvent[]> {
  return usageStore.list();
}

export async function getWeek3UsageSummary(): Promise<Week3LLMUsageSummary> {
  return summarizeUsage(await usageStore.list());
}

function createProvider(input: Week3AiIpcInput<unknown>['config']) {
  const config: Week3LLMProviderConfig = {
    providerId: 'school',
    providerName: 'School Model',
    kind: 'openai-compatible',
    baseUrl: input.baseUrl.trim(),
    model: input.model.trim(),
    apiKey: input.apiKey.trim(),
    enabled: true,
    timeoutMs: 120000
  };

  return createLLMProvider(config);
}

function callWeek3LLM(
  provider: ReturnType<typeof createProvider>,
  request: Parameters<typeof callLLMWithUsage>[1]
) {
  return provider.streamChat
    ? streamLLMWithUsage(provider, request, () => undefined, usageStore)
    : callLLMWithUsage(provider, request, usageStore);
}

function splitMarkdownIntoChunks(markdown: string, charLimit: number): string[] {
  const paragraphs = markdown.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.length > charLimit) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      chunks.push(...splitLongParagraph(trimmed, charLimit));
      continue;
    }

    const next = current ? `${current}\n\n${trimmed}` : trimmed;
    if (next.length > charLimit && current.trim()) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [markdown];
}

function splitLongParagraph(paragraph: string, charLimit: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < paragraph.length; index += charLimit) {
    chunks.push(paragraph.slice(index, index + charLimit));
  }
  return chunks;
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

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
