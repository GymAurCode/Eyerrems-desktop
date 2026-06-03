const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const os = require("os");

const isDev = !app.isPackaged;

// ── App icon path — resolves correctly in both dev and packaged builds ────────
// In dev:       <repo>/frontend/assets/icon.ico
// In packaged:  resources/assets/icon.ico  (electron-builder copies assets/)
const ICON_PATH = isDev
  ? path.join(__dirname, "../assets/icon.ico")
  : path.join(process.resourcesPath, "assets/icon.ico");

// ══════════════════════════════════════════════════════════════════════════════
// TEMP DIRECTORY MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

const TEMP_DIR = path.join(os.tmpdir(), "rems-reports");

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create temp directory:", err);
  }
}

/**
 * Generate unique filename with timestamp
 */
function generateTempFilename(originalName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  return `${base}_${timestamp}_${random}${ext}`;
}

/**
 * Clean old temp files (older than 24 hours)
 */
async function cleanupOldTempFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deleted++;
        }
      } catch (err) {
        // File might be in use or already deleted
        console.warn(`Could not delete temp file ${file}:`, err.message);
      }
    }

    console.log(`Cleaned up ${deleted} old temp files`);
    return deleted;
  } catch (err) {
    console.error("Temp cleanup failed:", err);
    return 0;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WINDOW MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

let mainWindow = null;
const pdfWindows = new Map(); // Track PDF preview windows

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: ICON_PATH,
    // Don't show until content is ready — prevents the black flash
    show: false,
    backgroundColor: "#0a0a0f", // Match app background so no white flash either
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Show window only once the renderer has painted — eliminates black screen flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In packaged builds, __dirname is .../resources/app/electron/
    // dist/index.html sits one level up at .../resources/app/dist/index.html
    const indexPath = path.join(__dirname, "../dist/index.html");
    console.log("[main] Loading production build from:", indexPath);

    // Verify the file exists before trying to load it
    if (!fsSync.existsSync(indexPath)) {
      dialog.showErrorBox(
        "App failed to start",
        `Build output not found at:\n${indexPath}\n\nPlease reinstall the application.`
      );
      app.quit();
      return;
    }

    mainWindow.loadFile(indexPath).catch((err) => {
      console.error("[main] loadFile failed:", err);
      dialog.showErrorBox(
        "Failed to load app",
        `Could not load: ${indexPath}\n\n${err.message}`
      );
    });

    // Log renderer-side errors that would otherwise be silent
    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
      console.error("[renderer] did-fail-load:", errorCode, errorDescription, validatedURL);
      dialog.showErrorBox(
        "Page failed to load",
        `Error ${errorCode}: ${errorDescription}\nURL: ${validatedURL}`
      );
    });

    mainWindow.webContents.on("render-process-gone", (event, details) => {
      console.error("[renderer] render-process-gone:", details);
    });

    mainWindow.webContents.on("unresponsive", () => {
      console.warn("[renderer] window became unresponsive");
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setupAutoUpdater(mainWindow);
}

/**
 * Create PDF preview window
 */
function createPdfWindow(filePath) {
  const pdfWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: `PDF Preview - ${path.basename(filePath)}`,
    webPreferences: {
      plugins: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
    parent: mainWindow,
    modal: false,
  });

  // Load PDF file directly
  pdfWindow.loadFile(filePath);

  // Track window
  const windowId = Date.now();
  pdfWindows.set(windowId, pdfWindow);

  pdfWindow.on("closed", () => {
    pdfWindows.delete(windowId);
  });

  return pdfWindow;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTO-UPDATER
// ══════════════════════════════════════════════════════════════════════════════

function setupAutoUpdater(mainWindow) {
  if (!app.isPackaged) {
    console.log("[Updater] Skipping auto-update in development mode");
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error("[Updater] Update check failed:", err.message);
    });
  }, 3000);

  autoUpdater.on("update-available", (info) => {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message: `Version ${info.version} is available.`,
      detail: `You are currently on version ${app.getVersion()}.\n\nWould you like to download and install the update now?`,
      buttons: ["Download Update", "Later"],
      defaultId: 0,
      cancelId: 1,
    }).then(result => {
      if (result.response === 0) {
        mainWindow.webContents.send("update-download-started");
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[Updater] App is up to date.");
  });

  autoUpdater.on("download-progress", (progressObj) => {
    mainWindow.webContents.send("update-download-progress", {
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Ready",
      message: "Update downloaded successfully.",
      detail: `Version ${info.version} has been downloaded.\n\nThe application will restart to apply the update.`,
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("[Updater] Error:", err.message);
    if (!err.message.includes("net::") && !err.message.includes("404")) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Update Check Failed",
        message: "Could not check for updates.",
        detail: "Please check your internet connection and try again later.",
        buttons: ["OK"],
      });
    }
  });

  ipcMain.on("check-for-updates", () => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error("[Updater] Manual check failed:", err.message);
    });
  });

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - PDF OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Save PDF blob to temp directory and open in system viewer
 */
ipcMain.handle("pdf:save-and-open", async (event, blobData, filename) => {
  try {
    await ensureTempDir();

    // Generate unique filename
    const safeFilename = generateTempFilename(filename);
    const filePath = path.join(TEMP_DIR, safeFilename);

    // Convert blob data to buffer
    let buffer;
    if (blobData instanceof ArrayBuffer) {
      buffer = Buffer.from(blobData);
    } else if (Buffer.isBuffer(blobData)) {
      buffer = blobData;
    } else {
      // Assume it's a base64 string or similar
      buffer = Buffer.from(blobData);
    }

    // Write file
    await fs.writeFile(filePath, buffer);

    // Verify file was written correctly
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error("PDF file is empty");
    }

    // Verify it's a valid PDF (check header)
    const header = await fs.readFile(filePath, { encoding: "utf8", flag: "r" });
    if (!header.startsWith("%PDF")) {
      throw new Error("Invalid PDF file format");
    }

    console.log(`PDF saved successfully: ${filePath} (${stats.size} bytes)`);

    // Open in system default PDF viewer
    await shell.openPath(filePath);

    return {
      success: true,
      path: filePath,
      size: stats.size,
    };
  } catch (err) {
    console.error("Failed to save and open PDF:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

/**
 * Open PDF in new Electron window
 */
ipcMain.handle("pdf:open-window", async (event, filePath) => {
  try {
    // Verify file exists
    const exists = fsSync.existsSync(filePath);
    if (!exists) {
      throw new Error("PDF file not found");
    }

    // Create PDF preview window
    createPdfWindow(filePath);

    return { success: true };
  } catch (err) {
    console.error("Failed to open PDF window:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

/**
 * Save PDF to user-selected location
 */
ipcMain.handle("pdf:save-as", async (event, blobData, defaultName) => {
  try {
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save PDF Report",
      defaultPath: defaultName,
      filters: [
        { name: "PDF Files", extensions: ["pdf"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // Convert blob to buffer
    let buffer;
    if (blobData instanceof ArrayBuffer) {
      buffer = Buffer.from(blobData);
    } else if (Buffer.isBuffer(blobData)) {
      buffer = blobData;
    } else {
      buffer = Buffer.from(blobData);
    }

    // Write file
    await fs.writeFile(result.filePath, buffer);

    console.log(`PDF saved to: ${result.filePath}`);

    return {
      success: true,
      path: result.filePath,
    };
  } catch (err) {
    console.error("Failed to save PDF:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

/**
 * Print PDF file
 */
ipcMain.handle("pdf:print", async (event, filePath) => {
  try {
    // Create hidden window for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        plugins: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await printWindow.loadFile(filePath);

    // Print — return a Promise that resolves from the print callback
    return await new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
        },
        (success, errorType) => {
          printWindow.close();
          if (success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: errorType || "Print failed" });
          }
        }
      );
    });
  } catch (err) {
    console.error("Failed to print PDF:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - FILE OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

ipcMain.handle("file:exists", async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("file:size", async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (err) {
    console.error("Failed to get file size:", err);
    return 0;
  }
});

ipcMain.handle("file:delete", async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (err) {
    console.error("Failed to delete file:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - SYSTEM OPERATIONS
// ══════════════════════════════════════════════════════════════════════════════

ipcMain.handle("system:open-external", async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    console.error("Failed to open external:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

ipcMain.handle("system:show-in-folder", async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) {
    console.error("Failed to show in folder:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - TEMP DIRECTORY
// ══════════════════════════════════════════════════════════════════════════════

ipcMain.handle("temp:get-path", async () => {
  await ensureTempDir();
  return TEMP_DIR;
});

ipcMain.handle("temp:cleanup", async () => {
  const deleted = await cleanupOldTempFiles();
  return { deleted };
});

// ══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - LOGGING
// ══════════════════════════════════════════════════════════════════════════════

ipcMain.on("log:renderer", (event, level, message, details) => {
  const timestamp = new Date().toISOString();
  const detailStr = details ? ` | Details: ${typeof details === "string" ? details : JSON.stringify(details)}` : "";
  const logMessage = `[Renderer][${level.toUpperCase()}] ${timestamp} - ${message}${detailStr}\n`;
  
  if (level === "error") {
    console.error(logMessage.trim());
  } else {
    console.log(logMessage.trim());
  }

  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    const logPath = path.join(logDir, "renderer.log");
    fsSync.mkdirSync(logDir, { recursive: true });
    fsSync.appendFileSync(logPath, logMessage, "utf8");
  } catch (err) {
    console.error("Failed to write renderer log to file:", err);
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  await ensureTempDir();
  await cleanupOldTempFiles();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Cleanup on quit
app.on("before-quit", async () => {
  // Optional: cleanup temp files on quit
  // await cleanupOldTempFiles();
});

