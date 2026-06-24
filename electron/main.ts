import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
  type MessageBoxOptions
} from "electron";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type {
  DesktopAppCommand,
  DesktopExportPngPayload,
  DesktopOpenResult,
  DesktopSavePayload,
  DesktopSaveResult
} from "../src/app/desktopApiTypes";
import { SUBPIX_EXTENSION } from "../src/format/subpixTypes";

const SUBPIX_FILTER = { name: "Subpixel Image", extensions: ["subpix"] };
const PNG_FILTER = { name: "PNG Image", extensions: ["png"] };
let mainWindow: BrowserWindow | null = null;
let launchFilePath: string | null = getSubpixPathFromArgs(process.argv);
let rendererHasUnsavedChanges = false;
let closeRequestPending = false;
let forceWindowClose = false;

function getWindowIconPath(): string {
  return app.isPackaged ? join(process.resourcesPath, "icon.ico") : resolve("build", "icon.ico");
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: "Subpix",
    icon: getWindowIconPath(),
    backgroundColor: "#050505",
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

  mainWindow.on("close", (event) => {
    if (forceWindowClose || !rendererHasUnsavedChanges) {
      return;
    }

    event.preventDefault();
    if (closeRequestPending) {
      return;
    }

    closeRequestPending = true;
    mainWindow?.webContents.send("subpix:close-requested");
  });

  mainWindow.on("closed", () => {
    rendererHasUnsavedChanges = false;
    closeRequestPending = false;
    forceWindowClose = false;
    mainWindow = null;
  });

  return mainWindow;
}

function ensureExtension(filePath: string, extension: string): string {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return filePath.toLowerCase().endsWith(normalizedExtension.toLowerCase()) ? filePath : `${filePath}${normalizedExtension}`;
}

function isSubpixPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(SUBPIX_EXTENSION);
}

function getSubpixPathFromArgs(args: string[]): string | null {
  return args.find((arg) => isSubpixPath(arg)) ?? null;
}

async function readSubpixFile(filePath: string): Promise<DesktopOpenResult> {
  const content = await readFile(filePath, "utf8");
  return { filePath, content };
}

async function writeFileAtomically(filePath: string, content: string | Buffer): Promise<void> {
  const tempPath = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);

  try {
    await writeFile(tempPath, content);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function openSubpixFileFromShell(filePath: string): Promise<void> {
  if (!mainWindow) {
    launchFilePath = filePath;
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("subpix:file-opened", await readSubpixFile(filePath));
}

function sendAppCommand(command: DesktopAppCommand): void {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send("subpix:app-command", command);
}

function commandMenuItem(label: string, command: DesktopAppCommand, accelerator?: string): MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    click: () => sendAppCommand(command)
  };
}

function buildApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        commandMenuItem("New Subpixel Image", "new", "CommandOrControl+N"),
        commandMenuItem("Open...", "open", "CommandOrControl+O"),
        { type: "separator" },
        commandMenuItem("Save", "save", "CommandOrControl+S"),
        commandMenuItem("Save As...", "save-as", "CommandOrControl+Shift+S"),
        { type: "separator" },
        commandMenuItem("Export PNG...", "export-png", "CommandOrControl+Shift+E"),
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        commandMenuItem("Undo", "undo", "CommandOrControl+Z"),
        commandMenuItem("Redo", "redo", "CommandOrControl+Y"),
        { type: "separator" },
        commandMenuItem("Draw On", "select-brush"),
        commandMenuItem("Erase Off", "select-eraser"),
        commandMenuItem("Box Eraser", "select-box-eraser"),
        { type: "separator" },
        commandMenuItem("Clear Canvas", "clear", "CommandOrControl+Backspace")
      ]
    },
    {
      label: "Tools",
      submenu: [
        commandMenuItem("Line", "select-line"),
        commandMenuItem("Rectangle Outline", "select-rect-outline"),
        commandMenuItem("Filled Rectangle", "select-rect-fill"),
        commandMenuItem("Ellipse Outline", "select-ellipse-outline"),
        commandMenuItem("Filled Ellipse", "select-ellipse-fill"),
        { type: "separator" },
        commandMenuItem("Insert Calibration Bars", "insert-calibration-bars"),
        commandMenuItem("Insert Slot Sweep", "insert-slot-sweep")
      ]
    },
    {
      label: "View",
      submenu: [
        commandMenuItem("Zoom In", "zoom-in", "CommandOrControl+="),
        commandMenuItem("Zoom Out", "zoom-out", "CommandOrControl+-"),
        commandMenuItem("Zoom To Drawing", "zoom-to-drawing", "CommandOrControl+0"),
        { type: "separator" },
        commandMenuItem("Toggle Grid", "toggle-grid", "CommandOrControl+G"),
        commandMenuItem("Toggle Pixel Boundaries", "toggle-pixel-boundaries", "CommandOrControl+Shift+P"),
        commandMenuItem("Toggle Ignore Color", "toggle-ignore-color")
      ]
    },
    {
      label: "Display",
      submenu: [
        commandMenuItem("RGB Horizontal Stripe", "display-rgb"),
        commandMenuItem("BGR Horizontal Stripe", "display-bgr"),
        commandMenuItem("Incompatible / Simulated Only", "display-incompatible")
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "togglefullscreen" }]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Subpix",
          click: () => {
            const options: MessageBoxOptions = {
              buttons: ["OK"],
              detail:
                "Subpix edits logical RGB/BGR stripe subpixel artwork, saves readable .subpix files, and exports PNG images.",
              message: "Subpix",
              title: "About Subpix",
              type: "info"
            };

            if (mainWindow) {
              void dialog.showMessageBox(mainWindow, options);
              return;
            }

            void dialog.showMessageBox(options);
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  return readSubpixFile(filePath);
});

ipcMain.handle("subpix:get-launch-file", async (): Promise<DesktopOpenResult | null> => {
  if (!launchFilePath) {
    return null;
  }

  const filePath = launchFilePath;
  launchFilePath = null;
  return readSubpixFile(filePath);
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

      targetPath = ensureExtension(result.filePath, SUBPIX_EXTENSION);
    }

    await writeFileAtomically(targetPath, payload.content);
    return { filePath: targetPath };
  }
);

ipcMain.handle(
  "subpix:export-png",
  async (_event, payload: DesktopExportPngPayload): Promise<DesktopSaveResult | null> => {
    const result = await dialog.showSaveDialog({
      title: "Export PNG",
      defaultPath: payload.suggestedName,
      filters: [PNG_FILTER, { name: "All Files", extensions: ["*"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    const targetPath = ensureExtension(result.filePath, "png");
    await writeFileAtomically(targetPath, Buffer.from(payload.bytes));
    return { filePath: targetPath };
  }
);

ipcMain.on("subpix:set-dirty-state", (_event, isDirty: boolean) => {
  rendererHasUnsavedChanges = isDirty;
});

ipcMain.on("subpix:close-response", (_event, allowClose: boolean) => {
  closeRequestPending = false;
  if (!allowClose || !mainWindow) {
    return;
  }

  forceWindowClose = true;
  mainWindow.close();
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const filePath = getSubpixPathFromArgs(commandLine);
    if (filePath) {
      void openSubpixFileFromShell(filePath);
      return;
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName("Subpix");
    buildApplicationMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (isSubpixPath(filePath)) {
    void openSubpixFileFromShell(filePath);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
