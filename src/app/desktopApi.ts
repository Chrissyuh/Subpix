import type {
  DesktopApi,
  DesktopExportPngPayload,
  DesktopOpenResult,
  DesktopSavePayload,
  DesktopSaveResult
} from "@/app/desktopApiTypes";
import { SUBPIX_EXTENSION, SUBPIX_INTERNAL_MIME } from "@/format/subpixTypes";

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

function cleanupInput(input: HTMLInputElement): void {
  input.remove();
}

async function readPickedSubpixFile(file: File): Promise<DesktopOpenResult> {
  return {
    content: await file.text(),
    filePath: file.name
  };
}

function pickSubpixFile(): Promise<DesktopOpenResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    let settled = false;

    function cleanup(): void {
      window.removeEventListener("focus", handleFocus);
      cleanupInput(input);
    }

    function settle(result: DesktopOpenResult | null): void {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    }

    function fail(error: unknown): void {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    }

    function handleFocus(): void {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settle(null);
        }
      }, 250);
    }

    input.type = "file";
    input.accept = `${SUBPIX_EXTENSION},${SUBPIX_INTERNAL_MIME},application/json`;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        settle(null);
        return;
      }

      readPickedSubpixFile(file).then(settle).catch(fail);
    });

    document.body.append(input);
    window.addEventListener("focus", handleFocus);
    input.click();
  });
}

const browserFallback: DesktopApi = {
  openSubpix: pickSubpixFile,
  getLaunchSubpixFile: async (): Promise<DesktopOpenResult | null> => null,
  onOpenSubpixFile: () => () => undefined,
  onAppCommand: () => () => undefined,
  onCloseRequest: () => () => undefined,
  setDirtyState: () => undefined,
  confirmClose: () => undefined,
  saveSubpix: async (payload: DesktopSavePayload): Promise<DesktopSaveResult> => {
    downloadText(payload.content, payload.suggestedName, SUBPIX_INTERNAL_MIME);
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
