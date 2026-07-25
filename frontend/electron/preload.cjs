const { contextBridge, ipcRenderer } = require("electron");

/**
 * Electron Preload Script
 * =======================
 * Secure bridge between renderer and main process.
 * Exposes safe APIs for PDF handling, file operations, and system integration.
 */

function safeInvoke(...args) {
  try { return ipcRenderer.invoke(...args); }
  catch { return Promise.reject(new Error("IPC disconnected")); }
}

function safeSend(...args) {
  try { ipcRenderer.send(...args); }
  catch { /* port disconnected during HMR — safe to ignore */ }
}

function safeOn(channel, callback) {
  try {
    ipcRenderer.on(channel, (_, data) => callback(data));
    return () => { try { ipcRenderer.removeAllListeners(channel); } catch {} };
  } catch { return () => {}; }
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,

  // PDF Operations
  pdf: {
    saveAndOpen: (blob, filename) => safeInvoke("pdf:save-and-open", blob, filename),
    openInWindow: (filePath) => safeInvoke("pdf:open-window", filePath),
    saveAs: (blob, defaultName) => safeInvoke("pdf:save-as", blob, defaultName),
    print: (filePath) => safeInvoke("pdf:print", filePath),
  },

  // File Operations
  file: {
    exists: (filePath) => safeInvoke("file:exists", filePath),
    getSize: (filePath) => safeInvoke("file:size", filePath),
    delete: (filePath) => safeInvoke("file:delete", filePath),
  },

  // System Operations
  system: {
    openExternal: (filePath) => safeInvoke("system:open-external", filePath),
    showInFolder: (filePath) => safeInvoke("system:show-in-folder", filePath),
  },

  // Temp Directory Management
  temp: {
    getPath: () => safeInvoke("temp:get-path"),
    cleanup: () => safeInvoke("temp:cleanup"),
  },

  // Logger
  log: (level, message, details) => safeSend("log:renderer", level, message, details),

  // Auto-updater
  checkForUpdates: () => safeSend("check-for-updates"),
  getAppVersion: () => safeInvoke("get-app-version"),
  startUpdateDownload: () => safeSend("start-update-download"),
  restartApp: () => safeSend("restart-app"),

  // Update event listeners
  onUpdateAvailable: (callback) => safeOn("update-available", callback),
  onUpdateDownloadStarted: (callback) => safeOn("update-download-started", () => callback()),
  onUpdateProgress: (callback) => safeOn("update-download-progress", callback),
  onUpdateDownloaded: (callback) => safeOn("update-downloaded", callback),
  onUpdateError: (callback) => safeOn("update-error", callback),
});

