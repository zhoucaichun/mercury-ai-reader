import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mercury', {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  runWeek2Sync: (feedUrls?: string[]) => ipcRenderer.invoke('week2:sync', feedUrls),
  importOpmlText: (opmlText: string) => ipcRenderer.invoke('week2:import-opml', opmlText),
  previewOpmlText: (opmlText: string) => ipcRenderer.invoke('week2:preview-opml', opmlText),
  updateArticleState: (input: { articleId: string; isRead?: boolean; isStarred?: boolean }) =>
    ipcRenderer.invoke('week2:update-article-state', input),
  updateFeedSubscription: (input: { feedId: string; isEnabled?: boolean; isDeleted?: boolean }) =>
    ipcRenderer.invoke('week2:update-feed-subscription', input),
  testLLMConnection: (config: { baseUrl: string; model: string; apiKey: string }) =>
    ipcRenderer.invoke('week3:test-provider', config),
  generateSummary: (input: unknown) => ipcRenderer.invoke('week3:generate-summary', input),
  translateArticle: (input: unknown) => ipcRenderer.invoke('week3:translate-article', input),
  translateText: (input: { config: { baseUrl: string; model: string; apiKey: string }; text: string; targetLanguage: string; sourceLanguage?: string }) =>
    ipcRenderer.invoke('week3:translate-text', input),
  listUsageEvents: () => ipcRenderer.invoke('week3:list-usage-events'),
  getUsageSummary: () => ipcRenderer.invoke('week3:get-usage-summary')
});
