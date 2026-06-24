import { exportCurrentArticle as createExportFile } from '../export';
import type { Week3AgentArticleInput } from '../agent/runtime/types';
import type {
  Week3LLMConnectionTestResult,
  Week3LLMProvider,
  Week3LLMProviderConfig
} from '../agent/providers/types';
export type { Week3LLMProviderConfig } from '../agent/providers/types';
import type { Week3LLMUsageEvent, Week3LLMUsageSummary } from '../usage/types';
import {
  BrowserLocalStorageLLMUsageEventStore,
  callLLMWithUsage,
  summarizeUsage,
  testLLMConnectionWithUsage,
  type LLMUsageEventStore
} from '../usage/usage';

export type Week3SummaryDetailLevel = 'brief' | 'standard';

export const READER_LLM_PROVIDER_STORAGE_KEY = 'mercury.reader.llmProviderConfig';
export const READER_LLM_PROVIDER_PROFILES_STORAGE_KEY = 'mercury.reader.llmProviderProfiles';

export interface ReaderLLMProviderConfigInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
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

export interface Week3ProviderConfigStore {
  loadProviderConfig?(): Week3LLMProviderConfig | null;
  saveProviderConfig?(input: ReaderLLMProviderConfigInput): Week3LLMProviderConfig;
  listProviderProfiles?(): Week3LLMProviderConfig[];
  activateProviderProfile?(profile: Week3LLMProviderConfig): Week3LLMProviderConfig;
  deleteProviderProfile?(profile: Pick<Week3LLMProviderConfig, 'baseUrl' | 'model'>): Week3LLMProviderConfig | null;
}

export interface Week3AgentUiPort {
  generateSummary(request: Week3SummaryRequest): Promise<Week3SummaryResult>;
  streamSummary?(request: Week3SummaryRequest, onDelta: (delta: string) => void): Promise<Week3SummaryResult>;
  translateArticle(request: Week3TranslationRequest): Promise<Week3TranslationResult>;
  streamTranslation?(request: Week3TranslationRequest, onDelta: (delta: string) => void): Promise<Week3TranslationResult>;
  /** Translate a single text string. Used for per-paragraph and inline translation. */
  translateText?(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string>;
  streamText?(text: string, targetLanguage: string, sourceLanguage: string | undefined, onDelta: (delta: string) => void): Promise<string>;
  testConnection?(): Promise<Week3LLMConnectionTestResult>;
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
  const usageStore = options.usageStore ?? new BrowserLocalStorageLLMUsageEventStore();

  if (!options.provider && isElectronAiBridgeAvailable()) {
    return createElectronAgentUiPort(usageStore);
  }

  if (!options.provider) {
    return createBrowserPreviewAgentUiPort(usageStore);
  }

  const provider = options.provider;

  if (!provider) {
    return createUnconfiguredAgentUiPort(usageStore);
  }

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
                'You are Prism Reader summary assistant. Return concise Markdown only, based on the article content.'
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
                'You are Prism Reader translation assistant. Preserve Markdown structure and return translated Markdown only.'
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

    async translateText(text: string, targetLanguage: string, sourceLanguage?: string) {
      const response = await callLLMWithUsage(
        provider,
        {
          purpose: 'translation',
          model: provider.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a translation assistant. Translate the given text accurately. Return ONLY the translated text, no explanations or extra formatting.'
            },
            {
              role: 'user',
              content: `Translate the following from ${sourceLanguage ?? 'auto-detect'} to ${targetLanguage}:\n\n${text}`
            }
          ],
          metadata: {
            taskId: `inline-translation-${Date.now()}`,
            articleId: '',
            agentType: 'translation',
            sourceLanguage,
            targetLanguage
          }
        },
        usageStore
      );
      return response.content;
    },

    async listUsageEvents() {
      return usageStore.list();
    },

    async getUsageSummary() {
      return summarizeUsage(await usageStore.list());
    },

    async testConnection() {
      const response = await testLLMConnectionWithUsage(provider, usageStore);
      return {
        providerId: response.providerId,
        providerName: response.providerName,
        model: response.model,
        status: 'succeeded',
        latencyMs: response.latencyMs
      };
    },

    exportCurrentArticle(data) {
      return createExportFile(data);
    }
  };
}

export function loadReaderLLMProviderConfig(): Week3LLMProviderConfig | null {
  const bridgeConfig = globalThis.window?.mercury?.loadProviderConfig?.();
  if (bridgeConfig) {
    return normalizeProviderConfig(bridgeConfig);
  }

  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  const raw = globalThis.localStorage.getItem(READER_LLM_PROVIDER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Week3LLMProviderConfig>;
    if (
      parsed.kind !== 'openai-compatible' ||
      !isNonEmptyString(parsed.baseUrl) ||
      !isNonEmptyString(parsed.model) ||
      !isNonEmptyString(parsed.apiKey)
    ) {
      return null;
    }

    return {
      providerId: 'school',
      providerName: 'School Model',
      kind: 'openai-compatible',
      baseUrl: parsed.baseUrl.trim(),
      model: parsed.model.trim(),
      apiKey: parsed.apiKey.trim(),
      enabled: true,
      timeoutMs: parsed.timeoutMs ?? 30000
    };
  } catch {
    return null;
  }
}

export function saveReaderLLMProviderConfig(input: ReaderLLMProviderConfigInput): Week3LLMProviderConfig {
  const bridgeConfig = globalThis.window?.mercury?.saveProviderConfig?.(input);
  if (bridgeConfig) {
    return normalizeProviderConfig(bridgeConfig)!;
  }

  const current = loadReaderLLMProviderConfig();
  const apiKey = input.apiKey?.trim() || current?.apiKey;

  const config: Week3LLMProviderConfig = {
    providerId: 'school',
    providerName: 'School Model',
    kind: 'openai-compatible',
    baseUrl: input.baseUrl.trim(),
    model: input.model.trim(),
    apiKey,
    enabled: true,
    timeoutMs: current?.timeoutMs ?? 30000
  };

  if (!isNonEmptyString(config.baseUrl)) {
    throw new Error('Base URL is required.');
  }

  if (!isNonEmptyString(config.model)) {
    throw new Error('Model is required.');
  }

  if (!isNonEmptyString(config.apiKey)) {
    throw new Error('API key is required.');
  }

  globalThis.localStorage?.setItem(READER_LLM_PROVIDER_STORAGE_KEY, JSON.stringify(config));
  saveReaderLLMProviderProfile(config);
  return config;
}

export function loadReaderLLMProviderProfiles(): Week3LLMProviderConfig[] {
  const bridgeProfiles = globalThis.window?.mercury?.listProviderProfiles?.();
  if (bridgeProfiles) {
    return bridgeProfiles
      .map((profile) => normalizeProviderConfig(profile))
      .filter((profile): profile is Week3LLMProviderConfig => Boolean(profile));
  }

  if (typeof globalThis.localStorage === 'undefined') {
    return [];
  }

  const raw = globalThis.localStorage.getItem(READER_LLM_PROVIDER_PROFILES_STORAGE_KEY);
  if (!raw) {
    const current = loadReaderLLMProviderConfig();
    return current ? [current] : [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<Week3LLMProviderConfig>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (profile): profile is Week3LLMProviderConfig =>
          profile.kind === 'openai-compatible' &&
          isNonEmptyString(profile.baseUrl) &&
          isNonEmptyString(profile.model) &&
          isNonEmptyString(profile.apiKey)
      )
      .map((profile) => ({
        providerId: profile.providerId || 'school',
        providerName: profile.providerName || 'School Model',
        kind: 'openai-compatible',
        baseUrl: profile.baseUrl.trim(),
        model: profile.model.trim(),
        apiKey: profile.apiKey?.trim() ?? '',
        enabled: true,
        timeoutMs: profile.timeoutMs ?? 30000
      }));
  } catch {
    return [];
  }
}

export function activateReaderLLMProviderProfile(profile: Week3LLMProviderConfig): Week3LLMProviderConfig {
  const bridgeConfig = globalThis.window?.mercury?.activateProviderProfile?.(profile);
  if (bridgeConfig) {
    return normalizeProviderConfig(bridgeConfig)!;
  }

  globalThis.localStorage?.setItem(READER_LLM_PROVIDER_STORAGE_KEY, JSON.stringify(profile));
  saveReaderLLMProviderProfile(profile);
  return profile;
}

export function deleteReaderLLMProviderProfile(profile: Pick<Week3LLMProviderConfig, 'baseUrl' | 'model'>): Week3LLMProviderConfig | null {
  const bridgeConfig = globalThis.window?.mercury?.deleteProviderProfile?.(profile);
  if (bridgeConfig !== undefined) {
    return normalizeProviderConfig(bridgeConfig);
  }

  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }

  const deletedKey = providerProfileKey(profile);
  const profiles = loadReaderLLMProviderProfiles().filter((item) => providerProfileKey(item) !== deletedKey);
  globalThis.localStorage.setItem(READER_LLM_PROVIDER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));

  const current = loadReaderLLMProviderConfig();
  if (current && providerProfileKey(current) === deletedKey) {
    if (profiles[0]) {
      globalThis.localStorage.setItem(READER_LLM_PROVIDER_STORAGE_KEY, JSON.stringify(profiles[0]));
      return profiles[0];
    }
    globalThis.localStorage.removeItem(READER_LLM_PROVIDER_STORAGE_KEY);
    return null;
  }

  return current;
}

function normalizeProviderConfig(input: Partial<Week3LLMProviderConfig> | null | undefined): Week3LLMProviderConfig | null {
  if (
    input?.kind !== 'openai-compatible' ||
    !isNonEmptyString(input.baseUrl) ||
    !isNonEmptyString(input.model) ||
    !isNonEmptyString(input.apiKey)
  ) {
    return null;
  }

  return {
    providerId: input.providerId || 'school',
    providerName: input.providerName || 'School Model',
    kind: 'openai-compatible',
    baseUrl: input.baseUrl.trim(),
    model: input.model.trim(),
    apiKey: input.apiKey.trim(),
    enabled: true,
    timeoutMs: input.timeoutMs ?? 30000
  };
}

function saveReaderLLMProviderProfile(config: Week3LLMProviderConfig): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  const profiles = loadReaderLLMProviderProfiles();
  const nextProfiles = [
    config,
    ...profiles.filter((profile) => profile.baseUrl !== config.baseUrl || profile.model !== config.model)
  ].slice(0, 8);

  globalThis.localStorage.setItem(READER_LLM_PROVIDER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
}

function providerProfileKey(profile: Pick<Week3LLMProviderConfig, 'baseUrl' | 'model'>): string {
  return `${profile.baseUrl.trim()}::${profile.model.trim()}`;
}

export function hasReaderLLMProviderConfig(): boolean {
  return loadReaderLLMProviderConfig() !== null;
}

function createElectronAgentUiPort(usageStore: LLMUsageEventStore): Week3AgentUiPort {
  return {
    async generateSummary(request) {
      const config = loadRequiredReaderConfig();
      return window.mercury!.generateSummary({
        config: toIpcProviderConfig(config),
        request
      });
    },

    async streamSummary(request, onDelta) {
      const config = loadRequiredReaderConfig();
      return window.mercury!.streamSummary({
        config: toIpcProviderConfig(config),
        request
      }, onDelta);
    },

    async translateArticle(request) {
      const config = loadRequiredReaderConfig();
      return window.mercury!.translateArticle({
        config: toIpcProviderConfig(config),
        request
      });
    },

    async streamTranslation(request, onDelta) {
      const config = loadRequiredReaderConfig();
      return window.mercury!.streamTranslation({
        config: toIpcProviderConfig(config),
        request
      }, onDelta);
    },

    async translateText(text: string, targetLanguage: string, sourceLanguage?: string) {
      const config = loadRequiredReaderConfig();
      const result = await window.mercury!.translateText({
        config: toIpcProviderConfig(config),
        text,
        targetLanguage,
        sourceLanguage
      });
      return result.translatedText;
    },

    async streamText(text: string, targetLanguage: string, sourceLanguage: string | undefined, onDelta: (delta: string) => void) {
      const config = loadRequiredReaderConfig();
      const result = await window.mercury!.streamTextTranslation({
        config: toIpcProviderConfig(config),
        text,
        targetLanguage,
        sourceLanguage
      }, onDelta);
      return result.translatedText;
    },

    async testConnection() {
      const config = loadRequiredReaderConfig();
      return window.mercury!.testLLMConnection(toIpcProviderConfig(config));
    },

    async listUsageEvents() {
      return window.mercury?.listUsageEvents ? window.mercury.listUsageEvents() : usageStore.list();
    },

    async getUsageSummary() {
      return window.mercury?.getUsageSummary
        ? window.mercury.getUsageSummary()
        : summarizeUsage(await usageStore.list());
    },

    exportCurrentArticle(data) {
      return createExportFile(data);
    }
  };
}

function createUnconfiguredAgentUiPort(usageStore: LLMUsageEventStore): Week3AgentUiPort {
  return {
    async generateSummary() {
      throw new Error('请先在阅读设置中配置模型服务，再生成摘要。');
    },

    async translateArticle() {
      throw new Error('请先在阅读设置中配置模型服务，再翻译文章。');
    },

    async testConnection() {
      return {
        providerId: 'school',
        providerName: 'School Model',
        model: '',
        status: 'failed',
        errorMessage: '请先填写 Base URL、Model 和 API Key。'
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

function createBrowserPreviewAgentUiPort(usageStore: LLMUsageEventStore): Week3AgentUiPort {
  return {
    async generateSummary() {
      throw new Error('浏览器预览不能直接连接真实模型。请在 Electron 桌面窗口中生成摘要。');
    },

    async translateArticle() {
      throw new Error('浏览器预览不能直接连接真实模型。请在 Electron 桌面窗口中翻译文章。');
    },

    async testConnection() {
      return {
        providerId: 'school',
        providerName: 'School Model',
        model: loadReaderLLMProviderConfig()?.model ?? '',
        status: 'failed',
        errorMessage: '浏览器预览没有 Electron IPC，无法避开 CORS。请在 Electron 桌面窗口中测试连接。'
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isElectronAiBridgeAvailable(): boolean {
  const mercury = globalThis.window?.mercury;
  return (
    typeof mercury?.testLLMConnection === 'function' &&
    typeof mercury.generateSummary === 'function' &&
    typeof mercury.translateArticle === 'function'
  );
}

function loadRequiredReaderConfig(): Week3LLMProviderConfig {
  const config = loadReaderLLMProviderConfig();
  if (!config) {
    throw new Error('请先在阅读设置中填写 Base URL、Model 和 API Key。');
  }

  return config;
}

function toIpcProviderConfig(config: Week3LLMProviderConfig): Required<ReaderLLMProviderConfigInput> {
  if (!isNonEmptyString(config.apiKey)) {
    throw new Error('API key is required.');
  }

  return {
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey
  };
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
