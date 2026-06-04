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
    ipcRenderer.invoke('week2:update-feed-subscription', input)
});
