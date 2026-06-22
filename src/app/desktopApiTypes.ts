export interface DesktopOpenResult {
  filePath: string;
  content: string;
}

export interface DesktopSaveResult {
  filePath: string;
}

export interface DesktopSavePayload {
  filePath: string | null;
  suggestedName: string;
  content: string;
  saveAs: boolean;
}

export interface DesktopExportPngPayload {
  suggestedName: string;
  bytes: number[];
}

export interface DesktopApi {
  openSubpix: () => Promise<DesktopOpenResult | null>;
  saveSubpix: (payload: DesktopSavePayload) => Promise<DesktopSaveResult | null>;
  exportPng: (payload: DesktopExportPngPayload) => Promise<DesktopSaveResult | null>;
}

