import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopApi,
  DesktopAppCommand,
  DesktopExportPngPayload,
  DesktopOpenResult,
  DesktopSavePayload,
  DesktopSaveResult
} from "../src/app/desktopApiTypes";

const api: DesktopApi = {
  openSubpix: () => ipcRenderer.invoke("subpix:open") as Promise<DesktopOpenResult | null>,
  getLaunchSubpixFile: () => ipcRenderer.invoke("subpix:get-launch-file") as Promise<DesktopOpenResult | null>,
  onOpenSubpixFile: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, result: DesktopOpenResult): void => listener(result);
    ipcRenderer.on("subpix:file-opened", handler);
    return () => ipcRenderer.removeListener("subpix:file-opened", handler);
  },
  onAppCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: DesktopAppCommand): void => listener(command);
    ipcRenderer.on("subpix:app-command", handler);
    return () => ipcRenderer.removeListener("subpix:app-command", handler);
  },
  onCloseRequest: (listener) => {
    const handler = (): void => listener();
    ipcRenderer.on("subpix:close-requested", handler);
    return () => ipcRenderer.removeListener("subpix:close-requested", handler);
  },
  setDirtyState: (isDirty) => ipcRenderer.send("subpix:set-dirty-state", isDirty),
  confirmClose: (allowClose) => ipcRenderer.send("subpix:close-response", allowClose),
  saveSubpix: (payload: DesktopSavePayload) =>
    ipcRenderer.invoke("subpix:save", payload) as Promise<DesktopSaveResult | null>,
  exportPng: (payload: DesktopExportPngPayload) =>
    ipcRenderer.invoke("subpix:export-png", payload) as Promise<DesktopSaveResult | null>
};

contextBridge.exposeInMainWorld("subpixDesktop", api);
