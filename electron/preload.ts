import { contextBridge, ipcRenderer } from 'electron';

function invokeWithStreamDelta<T>(
  channel: string,
  input: Record<string, unknown>,
  onDelta: (delta: string) => void
): Promise<T> {
  const streamId = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const listener = (_event: Electron.IpcRendererEvent, payload: { streamId?: string; delta?: string }) => {
    if (payload?.streamId === streamId && typeof payload.delta === 'string') {
      onDelta(payload.delta);
    }
  };

  ipcRenderer.on('week3:stream-delta', listener);
  return ipcRenderer
    .invoke(channel, { ...input, streamId })
    .finally(() => ipcRenderer.removeListener('week3:stream-delta', listener));
}

function invokeWithOpmlProgress<T>(
  channel: string,
  input: Record<string, unknown>,
  onProgress?: (progress: unknown) => void
): Promise<T> {
  if (!onProgress) {
    return ipcRenderer.invoke(channel, input);
  }

  const jobId = `${channel}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const listener = (_event: Electron.IpcRendererEvent, progress: { jobId?: string; phase?: string }) => {
    if (progress?.jobId === jobId) {
      onProgress(progress);
      if (progress.phase === 'completed') {
        ipcRenderer.removeListener('week2:opml-import-progress', listener);
      }
    }
  };

  ipcRenderer.on('week2:opml-import-progress', listener);
  return ipcRenderer
    .invoke(channel, { ...input, jobId })
    .catch((error) => {
      ipcRenderer.removeListener('week2:opml-import-progress', listener);
      throw error;
    });
}

contextBridge.exposeInMainWorld('mercury', {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  runWeek2Sync: (feedUrls?: string[]) => ipcRenderer.invoke('week2:sync', feedUrls),
  importOpmlText: (opmlText: string, onProgress?: (progress: unknown) => void) =>
    invokeWithOpmlProgress('week2:import-opml', { opmlText }, onProgress),
  importOpmlFile: (filePath: string, onProgress?: (progress: unknown) => void) =>
    invokeWithOpmlProgress('week2:import-opml-file', { filePath }, onProgress),
  previewOpmlText: (opmlText: string) => ipcRenderer.invoke('week2:preview-opml', opmlText),
  getArticleContent: (articleId: string) => ipcRenderer.invoke('week2:get-article-content', articleId),
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
  streamSummary: (input: Record<string, unknown>, onDelta: (delta: string) => void) =>
    invokeWithStreamDelta('week3:stream-summary', input, onDelta),
  streamTranslation: (input: Record<string, unknown>, onDelta: (delta: string) => void) =>
    invokeWithStreamDelta('week3:stream-translation', input, onDelta),
  streamTextTranslation: (input: Record<string, unknown>, onDelta: (delta: string) => void) =>
    invokeWithStreamDelta('week3:stream-text-translation', input, onDelta),
  listUsageEvents: () => ipcRenderer.invoke('week3:list-usage-events'),
  getUsageSummary: () => ipcRenderer.invoke('week3:get-usage-summary'),
  loadProviderConfig: () => ipcRenderer.sendSync('week3:load-provider-config-sync'),
  saveProviderConfig: (input: { baseUrl: string; model: string; apiKey?: string; timeoutMs?: number }) =>
    ipcRenderer.sendSync('week3:save-provider-config-sync', input),
  listProviderProfiles: () => ipcRenderer.sendSync('week3:list-provider-profiles-sync'),
  activateProviderProfile: (profile: unknown) => ipcRenderer.sendSync('week3:activate-provider-profile-sync', profile),
  deleteProviderProfile: (profile: unknown) => ipcRenderer.sendSync('week3:delete-provider-profile-sync', profile)
});
