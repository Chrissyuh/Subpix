import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import {
  Brush,
  Check,
  Circle,
  Eraser,
  Eye,
  EyeOff,
  Focus,
  Grid2X2,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Square,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { SubpixelCanvas } from "@/canvas/SubpixelCanvas";
import { getDesktopApi } from "@/app/desktopApi";
import type { DesktopAppCommand } from "@/app/desktopApiTypes";
import { getCursorAnchoredScroll } from "@/app/zoomMath";
import { getSubpixDocumentStats } from "@/format/documentStats";
import { getExportReadiness } from "@/format/exportReadiness";
import { createPackedPngBytes, getCompositeSubpixelIntensities } from "@/format/exportPng";
import { loadSubpix, SubpixLoadError } from "@/format/loadSubpix";
import { getSubpixPattern, type SubpixPatternId } from "@/format/patterns";
import { saveSubpix } from "@/format/saveSubpix";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clampZoom,
  readAppPreferences,
  writeAppPreferences
} from "@/state/appPreferences";
import {
  canUsePackedPreview,
  DEFAULT_DOCUMENT_FILE_NAME,
  DEFAULT_DOCUMENT_NAME,
  DEFAULT_HEIGHT_PIXELS,
  DEFAULT_WIDTH_PIXELS,
  DISPLAY_PROFILES,
  MAX_DOCUMENT_PIXELS,
  MIN_DOCUMENT_PIXELS,
  getCompatibilityMessage,
  getDisplayProfileLabel,
  getHeightSubpixels,
  getRenderOrder,
  getWidthSubpixels,
  isSupportedDocumentDimension,
  normalizeDocumentName,
  type DisplayProfileId,
  type Tool
} from "@/format/subpixTypes";
import { useDocumentStore } from "@/state/documentStore";
import { baseNameFromPath, ensurePngFileName, ensureSubpixFileName } from "@/utils/fileNames";

const TOOL_LABELS: Record<Tool, string> = {
  brush: "Draw On",
  eraser: "Erase Off",
  "box-eraser": "Box Eraser",
  line: "Line",
  "rect-outline": "Rectangle",
  "rect-fill": "Filled Rectangle",
  "ellipse-outline": "Ellipse",
  "ellipse-fill": "Filled Ellipse"
};

type TopMenuId = "file" | "edit" | "view" | "image" | "tools" | "display" | "help";

interface MenuItemProps {
  children: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  hasSubmenu?: boolean;
  onClick?: () => void;
  shortcut?: string;
}

function MenuItem({ children, checked, disabled, hasSubmenu, onClick, shortcut }: MenuItemProps): ReactElement {
  return (
    <button
      aria-checked={checked === undefined ? undefined : checked}
      className={checked ? "menu-item is-checked" : "menu-item"}
      disabled={disabled}
      onClick={onClick}
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      type="button"
    >
      <span className="menu-item__mark">{checked ? <Check size={13} strokeWidth={2.6} /> : null}</span>
      <span className="menu-item__label">{children}</span>
      {shortcut ? <span className="menu-item__shortcut">{shortcut}</span> : null}
      {hasSubmenu ? <span className="menu-item__submenu">&gt;</span> : null}
    </button>
  );
}

function MenuSeparator(): ReactElement {
  return <div className="menu-separator" role="separator" />;
}

interface NewDocumentDraft {
  name: string;
  widthPixels: string;
  heightPixels: string;
}

const DEFAULT_NEW_DOCUMENT_DRAFT: NewDocumentDraft = {
  name: DEFAULT_DOCUMENT_NAME,
  widthPixels: String(DEFAULT_WIDTH_PIXELS),
  heightPixels: String(DEFAULT_HEIGHT_PIXELS)
};

interface AppDialogState {
  cancelLabel?: string;
  confirmLabel: string;
  message: string;
  resolve: (confirmed: boolean) => void;
  title: string;
  variant: "confirm" | "info";
}

interface WheelZoomAnchor {
  canvasX: number;
  canvasY: number;
  clientX: number;
  clientY: number;
  direction: 1 | -1;
}

function formatError(error: unknown): string {
  if (error instanceof SubpixLoadError) {
    return error.errors.join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function getSignalWidthPercent(normalizedIntensity: number): number {
  return normalizedIntensity > 0 ? Math.max(2, Math.round(normalizedIntensity * 100)) : 0;
}

export function App(): ReactElement {
  const { state, actions } = useDocumentStore();
  const initialPreferences = useMemo(() => readAppPreferences(), []);
  const isDirtyRef = useRef(state.isDirty);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const pendingWheelZoomScrollRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null);
  const [tool, setTool] = useState<Tool>(initialPreferences.tool);
  const [displayProfile, setDisplayProfile] = useState<DisplayProfileId>(initialPreferences.displayProfile);
  const [zoom, setZoom] = useState(initialPreferences.zoom);
  const [ignoreColor, setIgnoreColor] = useState(initialPreferences.ignoreColor);
  const [showGrid, setShowGrid] = useState(initialPreferences.showGrid);
  const [showPixelBoundaries, setShowPixelBoundaries] = useState(initialPreferences.showPixelBoundaries);
  const [activeTopMenu, setActiveTopMenu] = useState<TopMenuId | null>(null);
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const [isRectangleMenuOpen, setIsRectangleMenuOpen] = useState(false);
  const [isEllipseMenuOpen, setIsEllipseMenuOpen] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [isNewDocumentDialogOpen, setIsNewDocumentDialogOpen] = useState(false);
  const [newDocumentDraft, setNewDocumentDraft] = useState<NewDocumentDraft>(DEFAULT_NEW_DOCUMENT_DRAFT);
  const [newDocumentError, setNewDocumentError] = useState<string | null>(null);
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null);
  const appDialogRef = useRef<AppDialogState | null>(null);

  const document = state.currentDocument;
  const packedAvailable = canUsePackedPreview(document, displayProfile);
  const renderOrder = getRenderOrder(document, displayProfile);
  const compatibilityMessage = getCompatibilityMessage(document, displayProfile);
  const suggestedBaseName = baseNameFromPath(state.filePath) || document.document.name || "Untitled";
  const fileLabel = ensureSubpixFileName(suggestedBaseName);
  const documentStats = useMemo(() => getSubpixDocumentStats(document, renderOrder), [document, renderOrder]);
  const exportReadiness = useMemo(() => getExportReadiness(document, displayProfile), [displayProfile, document]);
  const activeViewLabel = "Subpixel canvas";
  const windowTitle = `${state.isDirty ? "*" : ""}${ensureSubpixFileName(suggestedBaseName)} - Subpix`;

  useEffect(() => {
    isDirtyRef.current = state.isDirty;
    getDesktopApi().setDirtyState(state.isDirty);
  }, [state.isDirty]);

  useEffect(() => {
    appDialogRef.current = appDialog;
  }, [appDialog]);

  useEffect(() => {
    window.document.title = windowTitle;
  }, [windowTitle]);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const pendingScroll = pendingWheelZoomScrollRef.current;
    if (!workspace || !pendingScroll) {
      return;
    }

    workspace.scrollLeft = pendingScroll.scrollLeft;
    workspace.scrollTop = pendingScroll.scrollTop;
    pendingWheelZoomScrollRef.current = null;
  }, [zoom]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    function handleWheel(event: WheelEvent): void {
      handleWorkspaceWheel(event);
    }

    workspace.addEventListener("wheel", handleWheel, { passive: false });
    return () => workspace.removeEventListener("wheel", handleWheel);
  }, [zoom]);

  useEffect(() => {
    const desktopApi = getDesktopApi();
    return desktopApi.onCloseRequest(() => {
      void (async () => {
        const allowClose = await confirmDiscardDirty("Close Subpix and discard unsaved changes?");
        if (!allowClose) {
          setStatusMessage("Close canceled.");
        }

        desktopApi.confirmClose(allowClose);
      })();
    });
  }, []);

  useEffect(() => {
    writeAppPreferences({
      displayProfile,
      ignoreColor,
      showGrid,
      showPixelBoundaries,
      tool,
      zoom
    });
  }, [displayProfile, ignoreColor, showGrid, showPixelBoundaries, tool, zoom]);

  useEffect(() => {
    let disposed = false;
    const desktopApi = getDesktopApi();

    async function openDesktopDocument(result: Awaited<ReturnType<typeof desktopApi.openSubpix>>): Promise<void> {
      if (!result || disposed) {
        return;
      }

      if (!(await confirmDiscardDirty("Open this file and discard unsaved changes?"))) {
        return;
      }

      try {
        const nextDocument = loadSubpix(result.content);
        actions.loadDocument(nextDocument, result.filePath);
        setStatusMessage(`Opened ${ensureSubpixFileName(baseNameFromPath(result.filePath))}.`);
      } catch (error) {
        setStatusMessage(`Open failed: ${formatError(error)}`);
      }
    }

    void desktopApi.getLaunchSubpixFile().then((result) => {
      void openDesktopDocument(result);
    }).catch((error: unknown) => {
      if (!disposed) {
        setStatusMessage(`Open failed: ${formatError(error)}`);
      }
    });

    const unsubscribe = desktopApi.onOpenSubpixFile((result) => {
      void openDesktopDocument(result);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [actions]);

  useEffect(() => {
    return getDesktopApi().onAppCommand((command) => {
      handleAppCommand(command);
    });
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;
      const editableTarget = isEditableKeyboardTarget(event.target);

      if (key === "escape") {
        if (appDialogRef.current) {
          event.preventDefault();
          closeAppDialog(false);
          return;
        }

        if (isNewDocumentDialogOpen) {
          event.preventDefault();
          setIsNewDocumentDialogOpen(false);
          return;
        }
      }

      if (commandKey) {
        if (editableTarget && key !== "s") {
          return;
        }

        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          actions.undo();
        } else if (key === "y" || (key === "z" && event.shiftKey)) {
          event.preventDefault();
          actions.redo();
        } else if (key === "s") {
          event.preventDefault();
          void handleSave(event.shiftKey);
        } else if (key === "e" && event.shiftKey) {
          event.preventDefault();
          void handleExportPng();
        } else if (key === "o") {
          event.preventDefault();
          void handleOpen();
        } else if (key === "n") {
          event.preventDefault();
          void handleNew();
        } else if (key === "backspace") {
          event.preventDefault();
          void handleClearCanvas();
        }

        return;
      }

      if (event.altKey || editableTarget) {
        return;
      }

      if (key === "b") {
        event.preventDefault();
        selectTool("brush");
      } else if (key === "e") {
        event.preventDefault();
        selectTool("eraser");
      } else if (key === "x") {
        event.preventDefault();
        selectTool("box-eraser");
      } else if (key === "l") {
        event.preventDefault();
        selectTool("line");
      } else if (key === "r") {
        event.preventDefault();
        selectTool("rect-outline");
      } else if (key === "f") {
        event.preventDefault();
        selectTool("rect-fill");
      } else if (key === "o") {
        event.preventDefault();
        selectTool("ellipse-outline");
      } else if (key === "i") {
        event.preventDefault();
        selectTool("ellipse-fill");
      } else if (key === "g") {
        event.preventDefault();
        toggleGrid();
      } else if (key === "p") {
        event.preventDefault();
        togglePixelBoundaries();
      } else if (key === "c") {
        event.preventDefault();
        toggleIgnoreColor();
      } else if (key === "=" || key === "+") {
        event.preventDefault();
        adjustZoom(zoom + ZOOM_STEP);
      } else if (key === "-") {
        event.preventDefault();
        adjustZoom(zoom - ZOOM_STEP);
      } else if (key === "0") {
        event.preventDefault();
        zoomToDrawing();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const compatibilityLabel = useMemo(() => {
    if (!packedAvailable) {
      return "Incompatible";
    }

    return displayProfile === "bgr-horizontal" ? "BGR compatible" : "Compatible";
  }, [displayProfile, packedAvailable]);

  function closeMenus(): void {
    setActiveTopMenu(null);
    setIsEllipseMenuOpen(false);
    setIsGridMenuOpen(false);
    setIsRectangleMenuOpen(false);
  }

  function toggleTopMenu(menuId: TopMenuId): void {
    setIsEllipseMenuOpen(false);
    setIsGridMenuOpen(false);
    setIsRectangleMenuOpen(false);
    setActiveTopMenu(activeTopMenu === menuId ? null : menuId);
  }

  function switchTopMenu(menuId: TopMenuId): void {
    if (activeTopMenu) {
      setActiveTopMenu(menuId);
    }
  }

  function runMenuAction(action: () => void): void {
    closeMenus();
    action();
  }

  function runAsyncMenuAction(action: () => Promise<void>): void {
    closeMenus();
    void action();
  }

  function openAppDialog(options: Omit<AppDialogState, "resolve">): Promise<boolean> {
    return new Promise((resolve) => {
      setAppDialog({ ...options, resolve });
    });
  }

  function closeAppDialog(confirmed: boolean): void {
    setAppDialog((dialog) => {
      dialog?.resolve(confirmed);
      return null;
    });
  }

  function showConfirmDialog(options: {
    cancelLabel?: string;
    confirmLabel: string;
    message: string;
    title: string;
  }): Promise<boolean> {
    return openAppDialog({
      cancelLabel: options.cancelLabel ?? "Cancel",
      confirmLabel: options.confirmLabel,
      message: options.message,
      title: options.title,
      variant: "confirm"
    });
  }

  function showAbout(): void {
    void openAppDialog({
      confirmLabel: "Close",
      message: "Subpixel Image Studio for logical RGB/BGR horizontal stripe artwork and .subpix files.",
      title: "About Subpix",
      variant: "info"
    });
    setStatusMessage("Subpix edits logical horizontal stripe subpixel images.");
  }

  function selectTool(nextTool: Tool): void {
    setTool(nextTool);
    closeMenus();
    setStatusMessage(`${TOOL_LABELS[nextTool]} selected.`);
  }

  function toggleGrid(): void {
    const nextValue = !showGrid;
    setShowGrid(nextValue);
    setStatusMessage(`Grid ${nextValue ? "shown" : "hidden"}.`);
  }

  function togglePixelBoundaries(): void {
    const nextValue = !showPixelBoundaries;
    setShowPixelBoundaries(nextValue);
    setStatusMessage(`Pixel boundaries ${nextValue ? "shown" : "hidden"}.`);
  }

  function toggleIgnoreColor(): void {
    const nextValue = !ignoreColor;
    setIgnoreColor(nextValue);
    setStatusMessage(`Color ${nextValue ? "ignored" : "shown"}.`);
  }

  function chooseDisplayProfile(nextProfile: DisplayProfileId): void {
    setDisplayProfile(nextProfile);
    closeMenus();
    setStatusMessage(`${getDisplayProfileLabel(nextProfile)} display selected.`);
  }

  function getActiveSubpixelBounds(): { maxX: number; maxY: number; minX: number; minY: number } | null {
    const composite = getCompositeSubpixelIntensities(document);
    const widthSubpixels = getWidthSubpixels(document);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < composite.length; index += 1) {
      if ((composite[index] ?? 0) === 0) {
        continue;
      }

      const x = index % widthSubpixels;
      const y = Math.floor(index / widthSubpixels);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    return Number.isFinite(minX) ? { maxX, maxY, minX, minY } : null;
  }

  function scrollWorkspaceToBounds(bounds: { maxX: number; maxY: number; minX: number; minY: number }, nextZoom: number): void {
    window.requestAnimationFrame(() => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return;
      }

      const centerX = ((bounds.minX + bounds.maxX + 1) / 2) * nextZoom;
      const centerY = ((bounds.minY + bounds.maxY + 1) / 2) * nextZoom * 3;
      workspace.scrollLeft = Math.max(0, 24 + centerX - workspace.clientWidth / 2);
      workspace.scrollTop = Math.max(0, 24 + centerY - workspace.clientHeight / 2);
    });
  }

  function zoomToDrawing(): void {
    const workspace = workspaceRef.current;
    const activeBounds = getActiveSubpixelBounds();
    const originX = Math.floor(getWidthSubpixels(document) / 2);
    const originY = Math.floor(getHeightSubpixels(document) / 2);
    const bounds = activeBounds ?? { maxX: originX, maxY: originY, minX: originX, minY: originY };
    const widthCells = Math.max(12, bounds.maxX - bounds.minX + 1);
    const heightCells = Math.max(8, bounds.maxY - bounds.minY + 1);
    const availableWidth = Math.max(120, (workspace?.clientWidth ?? 720) - 96);
    const availableHeight = Math.max(120, (workspace?.clientHeight ?? 480) - 96);
    const nextZoom = clampZoom(Math.floor(Math.min(availableWidth / widthCells, availableHeight / (heightCells * 3))));

    setZoom(nextZoom);
    scrollWorkspaceToBounds(bounds, nextZoom);
    closeMenus();
    setStatusMessage(activeBounds ? "Zoomed to active drawing." : "Centered on the canvas origin.");
  }

  function handleAppCommand(command: DesktopAppCommand): void {
    switch (command) {
      case "new":
        void handleNew();
        break;
      case "open":
        void handleOpen();
        break;
      case "save":
        void handleSave(false);
        break;
      case "save-as":
        void handleSave(true);
        break;
      case "export-png":
        void handleExportPng();
        break;
      case "undo":
        actions.undo();
        break;
      case "redo":
        actions.redo();
        break;
      case "clear":
        void handleClearCanvas();
        break;
      case "insert-calibration-bars":
        insertPattern("calibration-bars");
        break;
      case "insert-slot-sweep":
        insertPattern("slot-sweep");
        break;
      case "select-brush":
        selectTool("brush");
        break;
      case "select-eraser":
        selectTool("eraser");
        break;
      case "select-box-eraser":
        selectTool("box-eraser");
        break;
      case "select-line":
        selectTool("line");
        break;
      case "select-rect-outline":
        selectTool("rect-outline");
        break;
      case "select-rect-fill":
        selectTool("rect-fill");
        break;
      case "select-ellipse-outline":
        selectTool("ellipse-outline");
        break;
      case "select-ellipse-fill":
        selectTool("ellipse-fill");
        break;
      case "zoom-in":
        adjustZoom(zoom + ZOOM_STEP);
        break;
      case "zoom-out":
        adjustZoom(zoom - ZOOM_STEP);
        break;
      case "zoom-to-drawing":
        zoomToDrawing();
        break;
      case "toggle-grid":
        toggleGrid();
        break;
      case "toggle-pixel-boundaries":
        togglePixelBoundaries();
        break;
      case "toggle-ignore-color":
        toggleIgnoreColor();
        break;
      case "display-rgb":
        chooseDisplayProfile("rgb-horizontal");
        break;
      case "display-bgr":
        chooseDisplayProfile("bgr-horizontal");
        break;
      case "display-incompatible":
        chooseDisplayProfile("incompatible");
        break;
    }
  }

  function confirmDiscardDirty(message = "Discard unsaved changes?"): Promise<boolean> {
    if (!isDirtyRef.current) {
      return Promise.resolve(true);
    }

    return showConfirmDialog({
      confirmLabel: "Discard",
      message,
      title: "Discard unsaved changes?"
    });
  }

  async function handleClearCanvas(): Promise<void> {
    if (documentStats.activeCells === 0) {
      setStatusMessage("Canvas is already empty.");
      return;
    }

    const shouldClear = await showConfirmDialog({
      confirmLabel: "Clear",
      message: "Clear the canvas? This will erase all active subpixels.",
      title: "Clear canvas?"
    });

    if (!shouldClear) {
      setStatusMessage("Clear canvas canceled.");
      return;
    }

    actions.clearCanvas();
    setStatusMessage("Canvas cleared.");
  }

  function insertPattern(patternId: SubpixPatternId): void {
    const pattern = getSubpixPattern(patternId);
    actions.insertPattern(pattern.id);
    setStatusMessage(`Inserted ${pattern.label}.`);
  }

  function parseDocumentDimension(value: string, label: string): number {
    const parsedValue = Number(value);
    if (!isSupportedDocumentDimension(parsedValue)) {
      throw new Error(`${label} must be a whole number from ${MIN_DOCUMENT_PIXELS} to ${MAX_DOCUMENT_PIXELS}.`);
    }

    return parsedValue;
  }

  async function handleNew(): Promise<void> {
    if (!(await confirmDiscardDirty("Create a new image and discard unsaved changes?"))) {
      return;
    }

    setNewDocumentDraft(DEFAULT_NEW_DOCUMENT_DRAFT);
    setNewDocumentError(null);
    setIsNewDocumentDialogOpen(true);
  }

  function handleCreateDocument(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    let widthPixels: number;
    let heightPixels: number;

    try {
      widthPixels = parseDocumentDimension(newDocumentDraft.widthPixels, "Width");
      heightPixels = parseDocumentDimension(newDocumentDraft.heightPixels, "Height");
    } catch (error) {
      setNewDocumentError(formatError(error));
      return;
    }

    const name = normalizeDocumentName(newDocumentDraft.name);
    actions.newDocument({ name, widthPixels, heightPixels });
    setIsNewDocumentDialogOpen(false);
    setNewDocumentError(null);
    setStatusMessage(`Created ${ensureSubpixFileName(name)} (${widthPixels}x${heightPixels}px).`);
  }

  async function handleOpen(): Promise<void> {
    if (!(await confirmDiscardDirty("Open another file and discard unsaved changes?"))) {
      return;
    }

    try {
      const result = await getDesktopApi().openSubpix();
      if (!result) {
        return;
      }

      const nextDocument = loadSubpix(result.content);
      actions.loadDocument(nextDocument, result.filePath);
      setStatusMessage(`Opened ${ensureSubpixFileName(baseNameFromPath(result.filePath))}.`);
    } catch (error) {
      setStatusMessage(`Open failed: ${formatError(error)}`);
    }
  }

  async function handleSave(saveAs = false): Promise<void> {
    try {
      const suggestedName = ensureSubpixFileName(suggestedBaseName || DEFAULT_DOCUMENT_FILE_NAME);
      const result = await getDesktopApi().saveSubpix({
        filePath: state.filePath,
        suggestedName,
        content: saveSubpix(document),
        saveAs
      });

      if (!result) {
        return;
      }

      actions.setSavedPath(result.filePath);
      setStatusMessage(`Saved ${ensureSubpixFileName(baseNameFromPath(result.filePath))}.`);
    } catch (error) {
      setStatusMessage(`Save failed: ${formatError(error)}`);
    }
  }

  async function handleExportPng(): Promise<void> {
    if (!packedAvailable) {
      setStatusMessage("PNG export is disabled for the selected display profile.");
      return;
    }

    try {
      const bytes = await createPackedPngBytes(document, renderOrder);
      const result = await getDesktopApi().exportPng({
        suggestedName: ensurePngFileName(suggestedBaseName || "Untitled"),
        bytes
      });

      if (!result) {
        return;
      }

      setStatusMessage(`Exported ${ensurePngFileName(baseNameFromPath(result.filePath))}.`);
    } catch (error) {
      setStatusMessage(`PNG export failed: ${formatError(error)}`);
    }
  }

  function adjustZoom(nextZoom: number): void {
    const clampedZoom = clampZoom(nextZoom);
    setZoom(clampedZoom);
    setStatusMessage(`Zoom set to ${clampedZoom}px.`);
  }

  function adjustZoomByWheel(anchor: WheelZoomAnchor): void {
    const workspace = workspaceRef.current;
    const nextZoom = clampZoom(zoom + anchor.direction * ZOOM_STEP);
    if (nextZoom !== zoom) {
      const workspaceRect = workspace?.getBoundingClientRect();
      const nextScroll =
        workspace && workspaceRect
          ? getCursorAnchoredScroll(
              anchor,
              {
                rectLeft: workspaceRect.left,
                rectTop: workspaceRect.top,
                scrollLeft: workspace.scrollLeft,
                scrollTop: workspace.scrollTop
              },
              zoom,
              nextZoom
            )
          : null;

      setZoom(nextZoom);

      if (workspace && nextScroll) {
        pendingWheelZoomScrollRef.current = nextScroll;
      }

      setStatusMessage(`Zoom set to ${nextZoom}px.`);
    }
  }

  function handleWorkspaceWheel(event: WheelEvent): void {
    const canvas = workspaceRef.current?.querySelector(".subpixel-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    event.preventDefault();

    const canvasRect = canvas.getBoundingClientRect();
    adjustZoomByWheel({
      canvasX: event.clientX - canvasRect.left,
      canvasY: event.clientY - canvasRect.top,
      clientX: event.clientX,
      clientY: event.clientY,
      direction: event.deltaY < 0 ? 1 : -1
    });
  }

  return (
    <div className={isInspectorCollapsed ? "app-shell app-shell--inspector-collapsed" : "app-shell"}>
      <header className="top-bar">
        <div className="brand-lockup" aria-label="Subpix">
          <svg className="brand-mark" aria-hidden="true" viewBox="0 0 31 31">
            <rect className="brand-mark__shell" x="0.5" y="0.5" width="30" height="30" rx="5.5" />
            <rect className="brand-mark__inner" x="2.5" y="2.5" width="26" height="26" rx="4" />
            <rect className="brand-mark__slot brand-mark__slot--r" x="6" y="6" width="5" height="19" rx="2" />
            <rect className="brand-mark__slot brand-mark__slot--g" x="13" y="6" width="5" height="19" rx="2" />
            <rect className="brand-mark__slot brand-mark__slot--b" x="20" y="6" width="5" height="19" rx="2" />
          </svg>
          <div className="brand-copy">
            <strong>Subpix</strong>
            <span>Subpixel Image Studio</span>
          </div>
        </div>

        <div className="menu-bar" aria-label="Application menus">
          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "file"}
              onClick={() => toggleTopMenu("file")}
              onMouseEnter={() => switchTopMenu("file")}
            >
              File
            </button>
            {activeTopMenu === "file" ? (
              <div className="menu-popover" role="menu">
                <MenuItem shortcut="Ctrl+N" onClick={() => runAsyncMenuAction(handleNew)}>
                  New Subpixel Image
                </MenuItem>
                <MenuItem shortcut="Ctrl+O" onClick={() => runAsyncMenuAction(handleOpen)}>
                  Open...
                </MenuItem>
                <MenuSeparator />
                <MenuItem shortcut="Ctrl+S" onClick={() => runAsyncMenuAction(() => handleSave(false))}>
                  Save
                </MenuItem>
                <MenuItem shortcut="Ctrl+Shift+S" onClick={() => runAsyncMenuAction(() => handleSave(true))}>
                  Save As...
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  disabled={!packedAvailable}
                  shortcut="Ctrl+Shift+E"
                  onClick={() => runAsyncMenuAction(handleExportPng)}
                >
                  Export PNG...
                </MenuItem>
              </div>
            ) : null}
          </div>

          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "edit"}
              onClick={() => toggleTopMenu("edit")}
              onMouseEnter={() => switchTopMenu("edit")}
            >
              Edit
            </button>
            {activeTopMenu === "edit" ? (
              <div className="menu-popover" role="menu">
                <MenuItem shortcut="Ctrl+Z" disabled={state.past.length === 0} onClick={() => runMenuAction(actions.undo)}>
                  Undo
                </MenuItem>
                <MenuItem shortcut="Ctrl+Y" disabled={state.future.length === 0} onClick={() => runMenuAction(actions.redo)}>
                  Redo
                </MenuItem>
                <MenuSeparator />
                <MenuItem shortcut="Ctrl+Backspace" onClick={() => runAsyncMenuAction(handleClearCanvas)}>
                  Clear Canvas
                </MenuItem>
              </div>
            ) : null}
          </div>

          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "view"}
              onClick={() => toggleTopMenu("view")}
              onMouseEnter={() => switchTopMenu("view")}
            >
              View
            </button>
            {activeTopMenu === "view" ? (
              <div className="menu-popover" role="menu">
                <MenuItem
                  shortcut="Ctrl+-"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={() => runMenuAction(() => adjustZoom(zoom - ZOOM_STEP))}
                >
                  Zoom Out
                </MenuItem>
                <MenuItem
                  shortcut="Ctrl+="
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() => runMenuAction(() => adjustZoom(zoom + ZOOM_STEP))}
                >
                  Zoom In
                </MenuItem>
                <MenuItem shortcut="Ctrl+0" onClick={() => runMenuAction(zoomToDrawing)}>
                  Zoom To Drawing
                </MenuItem>
                <MenuSeparator />
                <MenuItem checked={showGrid} shortcut="G" onClick={() => runMenuAction(toggleGrid)}>
                  Grid
                </MenuItem>
                <MenuItem checked={showPixelBoundaries} shortcut="P" onClick={() => runMenuAction(togglePixelBoundaries)}>
                  Pixel Boundaries
                </MenuItem>
                <MenuItem checked={ignoreColor} shortcut="C" onClick={() => runMenuAction(toggleIgnoreColor)}>
                  Ignore Color
                </MenuItem>
              </div>
            ) : null}
          </div>

          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "image"}
              onClick={() => toggleTopMenu("image")}
              onMouseEnter={() => switchTopMenu("image")}
            >
              Image
            </button>
            {activeTopMenu === "image" ? (
              <div className="menu-popover" role="menu">
                <MenuItem shortcut="Ctrl+Backspace" onClick={() => runAsyncMenuAction(handleClearCanvas)}>
                  Clear Canvas
                </MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => runMenuAction(() => insertPattern("calibration-bars"))}>
                  Insert Calibration Bars
                </MenuItem>
                <MenuItem onClick={() => runMenuAction(() => insertPattern("slot-sweep"))}>Insert Slot Sweep</MenuItem>
              </div>
            ) : null}
          </div>

          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "tools"}
              onClick={() => toggleTopMenu("tools")}
              onMouseEnter={() => switchTopMenu("tools")}
            >
              Tools
            </button>
            {activeTopMenu === "tools" ? (
              <div className="menu-popover" role="menu">
                <MenuItem checked={tool === "brush"} shortcut="B" onClick={() => selectTool("brush")}>
                  Draw On
                </MenuItem>
                <MenuItem checked={tool === "eraser"} shortcut="E" onClick={() => selectTool("eraser")}>
                  Erase Off
                </MenuItem>
                <MenuItem checked={tool === "box-eraser"} shortcut="X" onClick={() => selectTool("box-eraser")}>
                  Box Eraser
                </MenuItem>
                <MenuSeparator />
                <MenuItem checked={tool === "line"} shortcut="L" onClick={() => selectTool("line")}>
                  Line
                </MenuItem>
                <MenuItem checked={tool === "rect-outline"} shortcut="R" onClick={() => selectTool("rect-outline")}>
                  Rectangle Outline
                </MenuItem>
                <MenuItem checked={tool === "rect-fill"} shortcut="F" onClick={() => selectTool("rect-fill")}>
                  Filled Rectangle
                </MenuItem>
                <MenuItem checked={tool === "ellipse-outline"} shortcut="O" onClick={() => selectTool("ellipse-outline")}>
                  Ellipse Outline
                </MenuItem>
                <MenuItem checked={tool === "ellipse-fill"} shortcut="I" onClick={() => selectTool("ellipse-fill")}>
                  Filled Ellipse
                </MenuItem>
              </div>
            ) : null}
          </div>

          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "display"}
              onClick={() => toggleTopMenu("display")}
              onMouseEnter={() => switchTopMenu("display")}
            >
              Display
            </button>
            {activeTopMenu === "display" ? (
              <div className="menu-popover menu-popover--align-right" role="menu">
                {DISPLAY_PROFILES.map((profile) => (
                  <MenuItem
                    checked={displayProfile === profile.id}
                    key={profile.id}
                    onClick={() => chooseDisplayProfile(profile.id)}
                  >
                    {profile.label}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem checked={ignoreColor} shortcut="C" onClick={() => runMenuAction(toggleIgnoreColor)}>
                  Ignore Color
                </MenuItem>
              </div>
            ) : null}
          </div>

          <div className="menu-root">
            <button
              className="menu-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={activeTopMenu === "help"}
              onClick={() => toggleTopMenu("help")}
              onMouseEnter={() => switchTopMenu("help")}
            >
              Help
            </button>
            {activeTopMenu === "help" ? (
              <div className="menu-popover menu-popover--align-right" role="menu">
                <MenuItem onClick={() => runMenuAction(showAbout)}>About Subpix</MenuItem>
              </div>
            ) : null}
          </div>
        </div>

        <div className="top-bar__group">
          <button className="icon-button" title="Undo" onClick={actions.undo} disabled={state.past.length === 0}>
            <Undo2 size={17} />
          </button>
          <button className="icon-button" title="Redo" onClick={actions.redo} disabled={state.future.length === 0}>
            <Redo2 size={17} />
          </button>
          <button className="icon-button" title="Zoom out (-)" onClick={() => adjustZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>
            <ZoomOut size={17} />
          </button>
          <span className="zoom-readout">{zoom}px</span>
          <button className="icon-button" title="Zoom in (+)" onClick={() => adjustZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
            <ZoomIn size={17} />
          </button>
          <button className="icon-button" title="Zoom to drawing (0)" onClick={zoomToDrawing}>
            <Focus size={17} />
          </button>
        </div>

        <div className="document-strip" title={fileLabel}>
          <span className={state.isDirty ? "document-strip__state is-dirty" : "document-strip__state"} />
          <span className="document-strip__name">{fileLabel}</span>
          <span className="document-strip__meta">
            {document.document.widthPixels}x{document.document.heightPixels}px / {getWidthSubpixels(document)}x
            {getHeightSubpixels(document)} cells
          </span>
        </div>

        <div className="display-chip">{getDisplayProfileLabel(displayProfile)}</div>
      </header>

      <aside className="left-toolbar" aria-label="Tools">
        <button
          className={tool === "brush" ? "tool-button is-selected" : "tool-button"}
          title="Draw on (B)"
          aria-pressed={tool === "brush"}
          onClick={() => selectTool("brush")}
        >
          <Brush size={20} />
        </button>
        <button
          className={tool === "eraser" ? "tool-button is-selected" : "tool-button"}
          title="Erase off (E)"
          aria-pressed={tool === "eraser"}
          onClick={() => selectTool("eraser")}
        >
          <Eraser size={20} />
        </button>
        <button
          className={tool === "box-eraser" ? "tool-button is-selected" : "tool-button"}
          title="Box eraser (X)"
          aria-pressed={tool === "box-eraser"}
          onClick={() => selectTool("box-eraser")}
        >
          <Square size={20} />
        </button>
        <div className="toolbar-divider" />
        <button
          className={tool === "line" ? "tool-button is-selected" : "tool-button"}
          title="Line (L), hold Shift for 90 degrees"
          aria-pressed={tool === "line"}
          onClick={() => selectTool("line")}
        >
          <Minus size={20} />
        </button>
        <div className="shape-menu-root">
          <button
            className={tool === "rect-outline" || tool === "rect-fill" ? "tool-button is-selected" : "tool-button"}
            title="Rectangle tools"
            aria-expanded={isRectangleMenuOpen}
            aria-pressed={tool === "rect-outline" || tool === "rect-fill"}
            onClick={() => {
              setIsEllipseMenuOpen(false);
              setIsGridMenuOpen(false);
              setIsRectangleMenuOpen(!isRectangleMenuOpen);
            }}
          >
            <Square size={20} fill={tool === "rect-fill" ? "currentColor" : "none"} />
          </button>
          {isRectangleMenuOpen ? (
            <div className="shape-popover">
              <button
                className={tool === "rect-outline" ? "tool-button is-selected" : "tool-button"}
                title="Rectangle outline (R)"
                aria-pressed={tool === "rect-outline"}
                onClick={() => selectTool("rect-outline")}
              >
                <Square size={18} />
              </button>
              <button
                className={tool === "rect-fill" ? "tool-button is-selected" : "tool-button"}
                title="Filled rectangle (F)"
                aria-pressed={tool === "rect-fill"}
                onClick={() => selectTool("rect-fill")}
              >
                <Square size={18} fill="currentColor" />
              </button>
            </div>
          ) : null}
        </div>
        <div className="shape-menu-root">
          <button
            className={tool === "ellipse-outline" || tool === "ellipse-fill" ? "tool-button is-selected" : "tool-button"}
            title="Ellipse tools"
            aria-expanded={isEllipseMenuOpen}
            aria-pressed={tool === "ellipse-outline" || tool === "ellipse-fill"}
            onClick={() => {
              setIsGridMenuOpen(false);
              setIsRectangleMenuOpen(false);
              setIsEllipseMenuOpen(!isEllipseMenuOpen);
            }}
          >
            <Circle size={20} fill={tool === "ellipse-fill" ? "currentColor" : "none"} />
          </button>
          {isEllipseMenuOpen ? (
            <div className="shape-popover">
              <button
                className={tool === "ellipse-outline" ? "tool-button is-selected" : "tool-button"}
                title="Ellipse outline (O)"
                aria-pressed={tool === "ellipse-outline"}
                onClick={() => selectTool("ellipse-outline")}
              >
                <Circle size={18} />
              </button>
              <button
                className={tool === "ellipse-fill" ? "tool-button is-selected" : "tool-button"}
                title="Filled ellipse (I)"
                aria-pressed={tool === "ellipse-fill"}
                onClick={() => selectTool("ellipse-fill")}
              >
                <Circle size={18} fill="currentColor" />
              </button>
            </div>
          ) : null}
        </div>
        <button className="tool-button" title="Clear canvas" onClick={() => void handleClearCanvas()}>
          <Trash2 size={20} />
        </button>
        <div className="toolbar-divider" />
        <div className="grid-menu-root">
          <button
            className={showGrid || showPixelBoundaries ? "tool-button is-selected" : "tool-button"}
            title="Grid options"
            aria-expanded={isGridMenuOpen}
            onClick={() => {
              setIsEllipseMenuOpen(false);
              setIsRectangleMenuOpen(false);
              setIsGridMenuOpen(!isGridMenuOpen);
            }}
          >
            <Grid2X2 size={20} />
          </button>
          {isGridMenuOpen ? (
            <div className="grid-popover">
              <button
                className={showGrid ? "tool-button is-selected" : "tool-button"}
                title="Toggle grid (G)"
                aria-pressed={showGrid}
                onClick={toggleGrid}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                className={showPixelBoundaries ? "tool-button is-selected" : "tool-button"}
                title="Toggle pixel boundaries (P)"
                aria-pressed={showPixelBoundaries}
                onClick={togglePixelBoundaries}
              >
                {showPixelBoundaries ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="workspace" ref={workspaceRef}>
        <SubpixelCanvas
          document={document}
          order={renderOrder}
          tool={tool}
          zoom={zoom}
          ignoreColor={ignoreColor}
          showGrid={showGrid}
          showPixelBoundaries={showPixelBoundaries}
          onBeginStroke={actions.beginStroke}
          onPaintCells={actions.paintCells}
          onEndStroke={actions.endStroke}
        />
      </main>

      <aside
        className={isInspectorCollapsed ? "right-panel right-panel--collapsed" : "right-panel"}
        aria-label="Inspector"
      >
        {isInspectorCollapsed ? (
          <button
            className="inspector-rail-button"
            type="button"
            title="Expand inspector"
            aria-label="Expand inspector"
            onClick={() => setIsInspectorCollapsed(false)}
          >
            <PanelRightOpen size={18} />
          </button>
        ) : (
          <>
            <section className="panel-section panel-section--header">
              <div className="panel-header">
                <div>
                  <h2>Inspector</h2>
                  <p>{ensureSubpixFileName(suggestedBaseName)}</p>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  title="Collapse inspector"
                  aria-label="Collapse inspector"
                  onClick={() => setIsInspectorCollapsed(true)}
                >
                  <PanelRightClose size={17} />
                </button>
              </div>
            </section>

            <section className="panel-section">
              <h2>Document</h2>
              <dl>
                <div>
                  <dt>Canvas</dt>
                  <dd>
                    {document.document.widthPixels} x {document.document.heightPixels}px
                  </dd>
                </div>
                <div>
                  <dt>Subpixels</dt>
                  <dd>
                    {getWidthSubpixels(document)} x {getHeightSubpixels(document)}
                  </dd>
                </div>
                <div>
                  <dt>Active</dt>
                  <dd>
                    {documentStats.activeCells.toLocaleString()} cells ({documentStats.coverage.toFixed(1)}%)
                  </dd>
                </div>
              </dl>
            </section>

            <section className={`panel-section export-readiness export-readiness--${exportReadiness.status}`}>
              <div className="section-title-row">
                <h2>Display & Export</h2>
                <span>{compatibilityLabel}</span>
              </div>
              <dl>
                <div>
                  <dt>Profile</dt>
                  <dd>{getDisplayProfileLabel(displayProfile)}</dd>
                </div>
                <div>
                  <dt>Layout</dt>
                  <dd>
                    horizontal {document.architecture.slotsPerPixel[0]} x {document.architecture.slotsPerPixel[1]} stripe
                  </dd>
                </div>
                <div>
                  <dt>PNG</dt>
                  <dd>
                    {exportReadiness.outputWidthPixels} x {exportReadiness.outputHeightPixels}px
                  </dd>
                </div>
                <div>
                  <dt>Order</dt>
                  <dd>{exportReadiness.renderOrder}</dd>
                </div>
              </dl>
              <div className="slot-map" aria-label="Export slot mapping">
                {exportReadiness.slotMappings.map((mapping) => (
                  <span className={`slot-map__item slot-map__item--${mapping.channel.toLowerCase()}`} key={mapping.slot}>
                    S{mapping.slot} {"->"} {mapping.channel}
                  </span>
                ))}
              </div>
              <p>{compatibilityMessage}</p>
            </section>

            <section className="panel-section">
              <h2>Signal</h2>
              <div className="signal-stack" aria-label="Subpixel slot activity">
                {documentStats.slotActivities.map((activity) => (
                  <div className="signal-row" key={activity.slot}>
                    <div className={`signal-channel signal-channel--${activity.channel.toLowerCase()}`}>
                      {activity.channel}
                    </div>
                    <div className="signal-meter" aria-label={`${activity.channel} activity`}>
                      <span style={{ width: `${getSignalWidthPercent(activity.normalizedIntensity)}%` }} />
                    </div>
                    <div className="signal-value">{activity.activeCells}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </aside>

      {isNewDocumentDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-document-title"
            noValidate
            onSubmit={handleCreateDocument}
          >
            <div className="modal__header">
              <div>
                <h2 id="new-document-title">New Subpixel Image</h2>
                <p>{MIN_DOCUMENT_PIXELS}-{MAX_DOCUMENT_PIXELS}px real-pixel documents, horizontal 3 x 1 subpixels.</p>
              </div>
              <button
                className="icon-button"
                type="button"
                title="Close"
                onClick={() => setIsNewDocumentDialogOpen(false)}
              >
                <X size={17} />
              </button>
            </div>

            <label className="input-field">
              <span>Name</span>
              <input
                value={newDocumentDraft.name}
                onChange={(event) =>
                  setNewDocumentDraft((draft) => ({
                    ...draft,
                    name: event.target.value
                  }))
                }
                placeholder={DEFAULT_DOCUMENT_NAME}
              />
            </label>

            <div className="input-grid">
              <label className="input-field">
                <span>Width</span>
                <input
                  inputMode="numeric"
                  min={MIN_DOCUMENT_PIXELS}
                  max={MAX_DOCUMENT_PIXELS}
                  step={1}
                  type="number"
                  value={newDocumentDraft.widthPixels}
                  onChange={(event) =>
                    setNewDocumentDraft((draft) => ({
                      ...draft,
                      widthPixels: event.target.value
                    }))
                  }
                />
              </label>
              <label className="input-field">
                <span>Height</span>
                <input
                  inputMode="numeric"
                  min={MIN_DOCUMENT_PIXELS}
                  max={MAX_DOCUMENT_PIXELS}
                  step={1}
                  type="number"
                  value={newDocumentDraft.heightPixels}
                  onChange={(event) =>
                    setNewDocumentDraft((draft) => ({
                      ...draft,
                      heightPixels: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <div className="modal__summary">
              {Number(newDocumentDraft.widthPixels || 0) * 3 || 0} x {Number(newDocumentDraft.heightPixels || 0) || 0}
              {" "}subpixel cells
            </div>

            {newDocumentError ? <div className="modal__error">{newDocumentError}</div> : null}

            <div className="modal__actions">
              <button className="command-button" type="button" onClick={() => setIsNewDocumentDialogOpen(false)}>
                Cancel
              </button>
              <button className="command-button command-button--primary" type="submit">
                <Check size={16} />
                Create
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {appDialog ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal modal--app-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
          >
            <div className="modal__header">
              <div>
                <h2 id="app-dialog-title">{appDialog.title}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                title="Close"
                onClick={() => closeAppDialog(false)}
              >
                <X size={17} />
              </button>
            </div>

            <p className="modal__message">{appDialog.message}</p>

            <div className="modal__actions">
              {appDialog.variant === "confirm" ? (
                <button className="command-button" type="button" onClick={() => closeAppDialog(false)}>
                  {appDialog.cancelLabel ?? "Cancel"}
                </button>
              ) : null}
              <button
                className="command-button command-button--primary"
                type="button"
                onClick={() => closeAppDialog(true)}
              >
                {appDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="status-bar" role="status">
        <span>{statusMessage}</span>
        <span>
          {activeViewLabel} / {TOOL_LABELS[tool]} / {state.isDirty ? "Unsaved changes" : "Saved"}
        </span>
      </footer>
    </div>
  );
}
