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
  getLaunchSubpixFile: () => Promise<DesktopOpenResult | null>;
  onOpenSubpixFile: (listener: (result: DesktopOpenResult) => void) => () => void;
  saveSubpix: (payload: DesktopSavePayload) => Promise<DesktopSaveResult | null>;
  exportPng: (payload: DesktopExportPngPayload) => Promise<DesktopSaveResult | null>;
}
