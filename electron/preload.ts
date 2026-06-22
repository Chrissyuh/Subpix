import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopApi,
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
  saveSubpix: (payload: DesktopSavePayload) =>
    ipcRenderer.invoke("subpix:save", payload) as Promise<DesktopSaveResult | null>,
  exportPng: (payload: DesktopExportPngPayload) =>
    ipcRenderer.invoke("subpix:export-png", payload) as Promise<DesktopSaveResult | null>
};

contextBridge.exposeInMainWorld("subpixDesktop", api);
