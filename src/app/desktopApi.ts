import type {
  DesktopApi,
  DesktopExportPngPayload,
  DesktopOpenResult,
  DesktopSavePayload,
  DesktopSaveResult
} from "@/app/desktopApiTypes";

function downloadBytes(bytes: number[], fileName: string, mimeType: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

function downloadText(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

const browserFallback: DesktopApi = {
  openSubpix: async (): Promise<DesktopOpenResult | null> => {
    throw new Error("Opening files is available in the Subpix desktop app.");
  },
  getLaunchSubpixFile: async (): Promise<DesktopOpenResult | null> => null,
  onOpenSubpixFile: () => () => undefined,
  saveSubpix: async (payload: DesktopSavePayload): Promise<DesktopSaveResult> => {
    downloadText(payload.content, payload.suggestedName, "image/x-subpix");
    return { filePath: payload.suggestedName };
  },
  exportPng: async (payload: DesktopExportPngPayload): Promise<DesktopSaveResult> => {
    downloadBytes(payload.bytes, payload.suggestedName, "image/png");
    return { filePath: payload.suggestedName };
  }
};

export function getDesktopApi(): DesktopApi {
  return window.subpixDesktop ?? browserFallback;
}

export function isDesktopRuntime(): boolean {
  return Boolean(window.subpixDesktop);
}
