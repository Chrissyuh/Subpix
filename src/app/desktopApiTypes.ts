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

export type DesktopAppCommand =
  | "new"
  | "open"
  | "save"
  | "save-as"
  | "export-png"
  | "undo"
  | "redo"
  | "clear"
  | "insert-calibration-bars"
  | "insert-slot-sweep"
  | "select-brush"
  | "select-eraser"
  | "select-box-eraser"
  | "select-line"
  | "select-rect-outline"
  | "select-rect-fill"
  | "select-ellipse-outline"
  | "select-ellipse-fill"
  | "zoom-in"
  | "zoom-out"
  | "zoom-to-drawing"
  | "toggle-grid"
  | "toggle-pixel-boundaries"
  | "toggle-ignore-color"
  | "display-rgb"
  | "display-bgr"
  | "display-incompatible";

export interface DesktopApi {
  openSubpix: () => Promise<DesktopOpenResult | null>;
  getLaunchSubpixFile: () => Promise<DesktopOpenResult | null>;
  onOpenSubpixFile: (listener: (result: DesktopOpenResult) => void) => () => void;
  onAppCommand: (listener: (command: DesktopAppCommand) => void) => () => void;
  onCloseRequest: (listener: () => void) => () => void;
  setDirtyState: (isDirty: boolean) => void;
  confirmClose: (allowClose: boolean) => void;
  saveSubpix: (payload: DesktopSavePayload) => Promise<DesktopSaveResult | null>;
  exportPng: (payload: DesktopExportPngPayload) => Promise<DesktopSaveResult | null>;
}
