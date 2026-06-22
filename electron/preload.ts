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
  saveSubpix: (payload: DesktopSavePayload) =>
    ipcRenderer.invoke("subpix:save", payload) as Promise<DesktopSaveResult | null>,
  exportPng: (payload: DesktopExportPngPayload) =>
    ipcRenderer.invoke("subpix:export-png", payload) as Promise<DesktopSaveResult | null>
};

contextBridge.exposeInMainWorld("subpixDesktop", api);

