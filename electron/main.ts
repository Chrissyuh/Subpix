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
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DesktopAppCommand,
  DesktopExportPngPayload,
  DesktopOpenResult,
  DesktopSavePayload,
  DesktopSaveResult
} from "../src/app/desktopApiTypes";

const SUBPIX_FILTER = { name: "Subpixel Image", extensions: ["subpix"] };
const PNG_FILTER = { name: "PNG Image", extensions: ["png"] };
let mainWindow: BrowserWindow | null = null;
let launchFilePath: string | null = getSubpixPathFromArgs(process.argv);

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: "Subpix",
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function ensureExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(`.${extension}`) ? filePath : `${filePath}.${extension}`;
}

function isSubpixPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".subpix");
}

function getSubpixPathFromArgs(args: string[]): string | null {
  return args.find((arg) => isSubpixPath(arg)) ?? null;
}

async function readSubpixFile(filePath: string): Promise<DesktopOpenResult> {
  const content = await readFile(filePath, "utf8");
  return { filePath, content };
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
        commandMenuItem("Export Packed PNG...", "export-png", "CommandOrControl+Shift+E"),
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
        commandMenuItem("Brush", "select-brush"),
        commandMenuItem("Eraser", "select-eraser"),
        { type: "separator" },
        commandMenuItem("Clear Canvas", "clear", "CommandOrControl+Backspace")
      ]
    },
    {
      label: "Tools",
      submenu: [
        commandMenuItem("Insert Calibration Bars", "insert-calibration-bars"),
        commandMenuItem("Insert Slot Sweep", "insert-slot-sweep")
      ]
    },
    {
      label: "View",
      submenu: [
        commandMenuItem("Drawing Grid", "show-grid-view", "CommandOrControl+1"),
        commandMenuItem("Simulated Preview", "show-simulated-view", "CommandOrControl+2"),
        commandMenuItem("Packed Preview", "show-packed-view", "CommandOrControl+3"),
        { type: "separator" },
        commandMenuItem("Zoom In", "zoom-in", "CommandOrControl+="),
        commandMenuItem("Zoom Out", "zoom-out", "CommandOrControl+-"),
        { type: "separator" },
        commandMenuItem("Toggle Grid", "toggle-grid", "CommandOrControl+G"),
        commandMenuItem("Toggle Pixel Boundaries", "toggle-pixel-boundaries", "CommandOrControl+Shift+P")
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
                "Subpix edits logical RGB/BGR stripe subpixel artwork, saves readable .subpix files, and exports packed PNG images.",
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
