const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
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
      // webSecurity must be false for file:// protocol.
      // With webSecurity: true, Electron treats local file requests as cross-origin
      // and blocks the JS/CSS bundles (the crossorigin attribute on <script>/<link>
      // triggers a CORS preflight that always fails under file://).
      webSecurity: false,
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
      },
    });

    await printWindow.loadFile(filePath);

    // Print
    printWindow.webContents.print(
      {
        silent: false,
        printBackground: true,
      },
      (success, errorType) => {
        if (!success) {
          console.error("Print failed:", errorType);
        }
        printWindow.close();
      }
    );

    return { success: true };
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

