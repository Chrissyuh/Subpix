import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DesktopExportPngPayload,
  DesktopOpenResult,
  DesktopSavePayload,
  DesktopSaveResult
} from "../src/app/desktopApiTypes";

const SUBPIX_FILTER = { name: "Subpixel Image", extensions: ["subpix"] };
const PNG_FILTER = { name: "PNG Image", extensions: ["png"] };

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: "Subpix",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function ensureExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(`.${extension}`) ? filePath : `${filePath}.${extension}`;
}

ipcMain.handle("subpix:open", async (): Promise<DesktopOpenResult | null> => {
  const result = await dialog.showOpenDialog({
    title: "Open Subpixel Image",
    properties: ["openFile"],
    filters: [SUBPIX_FILTER, { name: "All Files", extensions: ["*"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await readFile(filePath, "utf8");
  return { filePath, content };
});

ipcMain.handle(
  "subpix:save",
  async (_event, payload: DesktopSavePayload): Promise<DesktopSaveResult | null> => {
    let targetPath = payload.saveAs ? null : payload.filePath;

    if (!targetPath) {
      const result = await dialog.showSaveDialog({
        title: payload.saveAs ? "Save Subpixel Image As" : "Save Subpixel Image",
        defaultPath: payload.suggestedName,
        filters: [SUBPIX_FILTER, { name: "All Files", extensions: ["*"] }]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      targetPath = ensureExtension(result.filePath, "subpix");
    }

    await writeFile(targetPath, payload.content, "utf8");
    return { filePath: targetPath };
  }
);

ipcMain.handle(
  "subpix:export-png",
  async (_event, payload: DesktopExportPngPayload): Promise<DesktopSaveResult | null> => {
    const result = await dialog.showSaveDialog({
      title: "Export Packed PNG",
      defaultPath: payload.suggestedName,
      filters: [PNG_FILTER, { name: "All Files", extensions: ["*"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeFile(ensureExtension(result.filePath, "png"), Buffer.from(payload.bytes));
    return { filePath: ensureExtension(result.filePath, "png") };
  }
);

app.whenReady().then(() => {
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

