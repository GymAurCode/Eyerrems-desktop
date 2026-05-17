const { contextBridge, ipcRenderer } = require("electron");

/**
 * Electron Preload Script
 * =======================
 * Secure bridge between renderer and main process.
 * Exposes safe APIs for PDF handling, file operations, and system integration.
 */

contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,

  // PDF Operations
  pdf: {
    /**
     * Save PDF blob to temp directory and open in system viewer
     * @param {Blob} blob - PDF blob data
     * @param {string} filename - Suggested filename
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    saveAndOpen: (blob, filename) => ipcRenderer.invoke("pdf:save-and-open", blob, filename),

    /**
     * Open PDF in new Electron window with built-in viewer
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    openInWindow: (filePath) => ipcRenderer.invoke("pdf:open-window", filePath),

    /**
     * Save PDF to user-selected location
     * @param {Blob} blob - PDF blob data
     * @param {string} defaultName - Default filename
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    saveAs: (blob, defaultName) => ipcRenderer.invoke("pdf:save-as", blob, defaultName),

    /**
     * Print PDF file
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    print: (filePath) => ipcRenderer.invoke("pdf:print", filePath),
  },

  // File Operations
  file: {
    /**
     * Check if file exists
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>}
     */
    exists: (filePath) => ipcRenderer.invoke("file:exists", filePath),

    /**
     * Get file size
     * @param {string} filePath - Path to file
     * @returns {Promise<number>} Size in bytes
     */
    getSize: (filePath) => ipcRenderer.invoke("file:size", filePath),

    /**
     * Delete file
     * @param {string} filePath - Path to file
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    delete: (filePath) => ipcRenderer.invoke("file:delete", filePath),
  },

  // System Operations
  system: {
    /**
     * Open file in system default application
     * @param {string} filePath - Path to file
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    openExternal: (filePath) => ipcRenderer.invoke("system:open-external", filePath),

    /**
     * Show file in system file explorer
     * @param {string} filePath - Path to file
     * @returns {Promise<void>}
     */
    showInFolder: (filePath) => ipcRenderer.invoke("system:show-in-folder", filePath),
  },

  // Temp Directory Management
  temp: {
    /**
     * Get temp directory path
     * @returns {Promise<string>}
     */
    getPath: () => ipcRenderer.invoke("temp:get-path"),

    /**
     * Clean old temp files (older than 24 hours)
     * @returns {Promise<{deleted: number}>}
     */
    cleanup: () => ipcRenderer.invoke("temp:cleanup"),
  },
});

