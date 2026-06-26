import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import {
  importOpmlAndSync,
  importOpmlFileAndSync,
  previewOpmlImport,
  runWeek2Sync,
  updateArticleState,
  updateFeedSubscription
} from './week2-sync.js';
import {
  generateWeek3Summary,
  getWeek3UsageSummary,
  listWeek3UsageEvents,
  testWeek3ProviderConnection,
  translateWeek3Article,
  translateWeek3Text
} from './week3-ai.js';
import {
  activateProviderProfile,
  deleteProviderProfile,
  listProviderProfiles,
  loadProviderConfig,
  saveProviderConfig
} from './secure-provider-store.js';

const devServerUrl = 'http://127.0.0.1:5173';
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'Prism Reader',
    backgroundColor: '#f7f5ef',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const shouldLoadBuiltFiles = app.isPackaged || process.argv.includes('--built');
  if (shouldLoadBuiltFiles) {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    void mainWindow.loadFile(indexPath);
    return;
  }

  void mainWindow.loadURL(devServerUrl);
}

ipcMain.handle('week2:sync', (_event, feedUrls?: string[]) => runWeek2Sync(feedUrls));
ipcMain.handle('week2:import-opml', (event, input: string | { opmlText: string; jobId?: string }) => {
  const opmlText = typeof input === 'string' ? input : input.opmlText;
  const jobId = typeof input === 'string' ? undefined : input.jobId;
  return importOpmlAndSync(opmlText, {
    jobId,
    onProgress: (progress) => {
      event.sender.send('week2:opml-import-progress', progress);
    }
  });
});
ipcMain.handle('week2:import-opml-file', (event, input: string | { filePath: string; jobId?: string }) => {
  const filePath = typeof input === 'string' ? input : input.filePath;
  const jobId = typeof input === 'string' ? undefined : input.jobId;
  return importOpmlFileAndSync(filePath, {
    jobId,
    onProgress: (progress) => {
      event.sender.send('week2:opml-import-progress', progress);
    }
  });
});
ipcMain.handle('week2:preview-opml', (_event, opmlText: string) => previewOpmlImport(opmlText));
ipcMain.handle('week2:update-article-state', (_event, input) => updateArticleState(input));
ipcMain.handle('week2:update-feed-subscription', (_event, input) => updateFeedSubscription(input));
ipcMain.handle('week3:test-provider', (_event, config) => testWeek3ProviderConnection(config));
ipcMain.handle('week3:generate-summary', (_event, input) => generateWeek3Summary(input));
ipcMain.handle('week3:translate-article', (_event, input) => translateWeek3Article(input));
ipcMain.handle('week3:translate-text', (_event, input) => translateWeek3Text(input));
ipcMain.handle('week3:stream-summary', (event, input) => {
  const streamId = typeof input?.streamId === 'string' ? input.streamId : `summary-${Date.now()}`;
  return generateWeek3Summary(input, (delta) => {
    event.sender.send('week3:stream-delta', { streamId, delta });
  });
});
ipcMain.handle('week3:stream-translation', (event, input) => {
  const streamId = typeof input?.streamId === 'string' ? input.streamId : `translation-${Date.now()}`;
  return translateWeek3Article(input, (delta) => {
    event.sender.send('week3:stream-delta', { streamId, delta });
  });
});
ipcMain.handle('week3:stream-text-translation', (event, input) => {
  const streamId = typeof input?.streamId === 'string' ? input.streamId : `text-translation-${Date.now()}`;
  return translateWeek3Text(input, (delta) => {
    event.sender.send('week3:stream-delta', { streamId, delta });
  });
});
ipcMain.handle('week3:list-usage-events', () => listWeek3UsageEvents());
ipcMain.handle('week3:get-usage-summary', () => getWeek3UsageSummary());
ipcMain.on('week3:load-provider-config-sync', (event) => {
  event.returnValue = loadProviderConfig();
});
ipcMain.on('week3:list-provider-profiles-sync', (event) => {
  event.returnValue = listProviderProfiles();
});
ipcMain.on('week3:save-provider-config-sync', (event, input) => {
  event.returnValue = saveProviderConfig(input);
});
ipcMain.on('week3:activate-provider-profile-sync', (event, profile) => {
  event.returnValue = activateProviderProfile(profile);
});
ipcMain.on('week3:delete-provider-profile-sync', (event, profile) => {
  event.returnValue = deleteProviderProfile(profile);
});

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
