import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mercury', {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node
  },
  runWeek2Sync: (feedUrls?: string[]) => ipcRenderer.invoke('week2:sync', feedUrls)
});
