import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { logger } from './logger.js';

const log = logger.child('updater');

export function initAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available', { version: info.version });
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    win.webContents.send('update:available', info.version);
    void autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No update available');
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info('Download progress', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', { version: info.version });
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    win.webContents.send('update:downloaded', info.version);
  });

  autoUpdater.on('error', (err) => {
    log.error('Update error', { error: err.message });
  });

  void autoUpdater.checkForUpdates().catch((err: Error) => {
    log.warn('Update check failed (expected in development)', { error: err.message });
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
