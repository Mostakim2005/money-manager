import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronStateSnapshot,
  ElectronSyncLogEntry,
  RealbyteEndpointOverrides,
} from './types';

contextBridge.exposeInMainWorld('moneyApi', {
  isElectron: true,
  db: {
    loadState: () => ipcRenderer.invoke('db:loadState'),
    saveState: (snapshot: ElectronStateSnapshot) => ipcRenderer.invoke('db:saveState', snapshot),
    getSyncLogs: (limit?: number) => ipcRenderer.invoke('db:getSyncLogs', limit),
    appendSyncLog: (entry: ElectronSyncLogEntry) => ipcRenderer.invoke('db:appendSyncLog', entry),
    getInfo: () => ipcRenderer.invoke('db:getInfo'),
  },
  realbyte: {
    checkConnection: (phoneIp: string, port: number) =>
      ipcRenderer.invoke('realbyte:checkConnection', phoneIp, port),
    fetchAccounts: (phoneIp: string, port: number, overrides?: RealbyteEndpointOverrides) =>
      ipcRenderer.invoke('realbyte:fetchAccounts', phoneIp, port, overrides),
    fetchCategories: (phoneIp: string, port: number, overrides?: RealbyteEndpointOverrides) =>
      ipcRenderer.invoke('realbyte:fetchCategories', phoneIp, port, overrides),
    fetchTransactions: (
      phoneIp: string,
      port: number,
      startDate: string,
      endDate: string,
      overrides?: RealbyteEndpointOverrides
    ) => ipcRenderer.invoke('realbyte:fetchTransactions', phoneIp, port, startDate, endDate, overrides),
    probeEndpoints: (phoneIp: string, port: number, overrides?: RealbyteEndpointOverrides) =>
      ipcRenderer.invoke('realbyte:probeEndpoints', phoneIp, port, overrides),
    readSqliteFile: (filePath: string) => ipcRenderer.invoke('realbyte:readSqliteFile', filePath),
  },
  fs: {
    saveFile: (options: {
      defaultName: string;
      content: string;
      filters?: { name: string; extensions: string[] }[];
    }) => ipcRenderer.invoke('fs:saveFile', options),
    pickFile: (options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
    }) => ipcRenderer.invoke('fs:pickFile', options),
    saveReceipt: (options: { originalName: string; bytes: number[] }) =>
      ipcRenderer.invoke('fs:saveReceipt', options),
    openPath: (targetPath: string) => ipcRenderer.invoke('fs:openPath', targetPath),
  },
});
