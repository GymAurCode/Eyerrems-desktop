/**
 * Electron API Type Definitions
 * ==============================
 * TypeScript declarations for Electron preload APIs.
 */

export interface ElectronAPI {
  platform: string;

  pdf: {
    saveAndOpen: (blob: Blob, filename: string) => Promise<{
      success: boolean;
      path?: string;
      size?: number;
      error?: string;
    }>;

    openInWindow: (filePath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;

    saveAs: (blob: Blob, defaultName: string) => Promise<{
      success: boolean;
      path?: string;
      canceled?: boolean;
      error?: string;
    }>;

    print: (filePath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  file: {
    exists: (filePath: string) => Promise<boolean>;
    getSize: (filePath: string) => Promise<number>;
    delete: (filePath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  system: {
    openExternal: (filePath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  temp: {
    getPath: () => Promise<string>;
    cleanup: () => Promise<{ deleted: number }>;
  };

  log: (level: string, message: string, details?: any) => void;

  // Auto-updater
  checkForUpdates: () => void;
  getAppVersion: () => Promise<string>;
  startUpdateDownload: () => void;
  restartApp: () => void;
  onUpdateAvailable: (callback: (data: { version: string; currentVersion: string }) => void) => void;
  onUpdateDownloadStarted: (callback: () => void) => void;
  onUpdateProgress: (callback: (data: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => void;
  onUpdateDownloaded: (callback: (data: { version: string }) => void) => void;
  onUpdateError: (callback: (data: { message: string; isNetworkError: boolean }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

