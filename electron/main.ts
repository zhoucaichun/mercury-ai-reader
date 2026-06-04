import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { importOpmlAndSync, runWeek2Sync } from './week2-sync.js';

const devServerUrl = 'http://127.0.0.1:5173';
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'Mercury AI Reader',
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
ipcMain.handle('week2:import-opml', (_event, opmlText: string) => importOpmlAndSync(opmlText));

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
