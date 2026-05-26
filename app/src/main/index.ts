import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc.js';
import { logger } from './logger.js';
import { initAutoUpdater, installUpdate } from './updater.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'Multi-Agent Command Center',
    backgroundColor: '#101317',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  logger.info('App ready', { version: app.getVersion(), platform: process.platform });
  registerIpcHandlers();
  ipcMain.handle('update:install', () => installUpdate());
  createWindow();
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
