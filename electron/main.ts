import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MoneySqliteService } from './db/sqliteService';
import { readRealbyteBinarySqlite } from './db/realbyteReader';
import {
  checkRealbyteConnection,
  fetchRealbyteAccounts,
  fetchRealbyteCategories,
  fetchRealbyteTransactions,
  probeRealbyteEndpoints,
} from './net/realbyteProxy';
import type {
  ElectronStateSnapshot,
  ElectronSyncLogEntry,
  RealbyteEndpointOverrides,
} from './types';

let mainWindow: BrowserWindow | null = null;
let sqliteService: MoneySqliteService | null = null;

function getDbService(): MoneySqliteService {
  if (!sqliteService) {
    const dbPath = path.join(app.getPath('userData'), 'money_manager.sqlite');
    sqliteService = new MoneySqliteService(dbPath);
  }
  return sqliteService;
}

function registerIpcHandlers(): void {
  // Database IPC
  ipcMain.handle('db:loadState', () => {
    return getDbService().loadFullState();
  });

  ipcMain.handle('db:saveState', (_event, snapshot: ElectronStateSnapshot) => {
    getDbService().saveFullState(snapshot);
    return { ok: true };
  });

  ipcMain.handle('db:getSyncLogs', (_event, limit?: number) => {
    return getDbService().getSyncLogs(limit);
  });

  ipcMain.handle('db:appendSyncLog', (_event, entry: ElectronSyncLogEntry) => {
    getDbService().appendSyncLog(entry);
    return { ok: true };
  });

  ipcMain.handle('db:getInfo', () => {
    return getDbService().getDbInfo();
  });

  // Realbyte CORS-free Node HTTP Proxy & Binary SQLite Reader
  ipcMain.handle('realbyte:checkConnection', (_event, phoneIp: string, port: number) => {
    return checkRealbyteConnection(phoneIp, port);
  });

  ipcMain.handle(
    'realbyte:fetchAccounts',
    (_event, phoneIp: string, port: number, overrides?: RealbyteEndpointOverrides) => {
      return fetchRealbyteAccounts(phoneIp, port, overrides);
    }
  );

  ipcMain.handle(
    'realbyte:fetchCategories',
    (_event, phoneIp: string, port: number, overrides?: RealbyteEndpointOverrides) => {
      return fetchRealbyteCategories(phoneIp, port, overrides);
    }
  );

  ipcMain.handle(
    'realbyte:fetchTransactions',
    (
      _event,
      phoneIp: string,
      port: number,
      startDate: string,
      endDate: string,
      overrides?: RealbyteEndpointOverrides
    ) => {
      return fetchRealbyteTransactions(phoneIp, port, startDate, endDate, overrides);
    }
  );

  ipcMain.handle(
    'realbyte:probeEndpoints',
    (_event, phoneIp: string, port: number, overrides?: RealbyteEndpointOverrides) => {
      return probeRealbyteEndpoints(phoneIp, port, overrides);
    }
  );

  ipcMain.handle('realbyte:readSqliteFile', (_event, filePath: string) => {
    return readRealbyteBinarySqlite(filePath);
  });

  // Native File Dialogs & Receipt Storage
  ipcMain.handle(
    'fs:saveFile',
    async (
      _event,
      options: { defaultName: string; content: string; filters?: { name: string; extensions: string[] }[] }
    ) => {
      const result = await dialog.showSaveDialog(mainWindow ?? undefined!, {
        defaultPath: options.defaultName,
        filters: options.filters,
      });
      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }
      writeFileSync(result.filePath, options.content, 'utf-8');
      return { canceled: false, filePath: result.filePath };
    }
  );

  ipcMain.handle(
    'fs:pickFile',
    async (
      _event,
      options?: { title?: string; filters?: { name: string; extensions: string[] }[] }
    ) => {
      const result = await dialog.showOpenDialog(mainWindow ?? undefined!, {
        title: options?.title || 'Select File',
        properties: ['openFile'],
        filters: options?.filters,
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }
      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();
      const isText = ['.json', '.sql', '.csv', '.ofx', '.qfx', '.qif', '.xml', '.txt'].includes(ext);
      return {
        canceled: false,
        filePath,
        fileName: path.basename(filePath),
        textContent: isText ? readFileSync(filePath, 'utf-8') : undefined,
      };
    }
  );

  ipcMain.handle(
    'fs:saveReceipt',
    (_event, options: { originalName: string; bytes: number[] }) => {
      const receiptsDir = path.join(app.getPath('userData'), 'receipts');
      mkdirSync(receiptsDir, { recursive: true });
      const safeName = path.basename(options.originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = path.join(receiptsDir, `${Date.now()}-${safeName}`);
      writeFileSync(targetPath, Buffer.from(options.bytes));
      return { filePath: targetPath };
    }
  );

  ipcMain.handle('fs:openPath', async (_event, targetPath: string) => {
    if (!targetPath || !existsSync(targetPath)) {
      return { ok: false, error: 'File does not exist on disk' };
    }
    const err = await shell.openPath(targetPath);
    return err ? { ok: false, error: err } : { ok: true };
  });
}

function createMainWindow(): void {
  const iconCandidates = [
    path.resolve(process.cwd(), 'assets/icons/icon.ico'),
    path.resolve(__dirname, '../assets/icons/icon.ico'),
  ];
  const iconPath = iconCandidates.find((p) => existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Money Manager',
    icon: iconPath,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://127.0.0.1:* http://localhost:* http://192.168.*:* http://10.*:* http://172.*:*;",
        ],
      },
    });
  });

  getDbService();
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  if (sqliteService) {
    sqliteService.close();
    sqliteService = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
