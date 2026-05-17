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
    showInFolder: (filePath: string) => Promise<void>;
  };

  temp: {
    getPath: () => Promise<string>;
    cleanup: () => Promise<{ deleted: number }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

