import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from "react";
import {
  Brush,
  Check,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  Redo2,
  Save,
  SaveAll,
  Sparkles,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { SubpixelCanvas } from "@/canvas/SubpixelCanvas";
import { getDesktopApi, isDesktopRuntime } from "@/app/desktopApi";
import type { DesktopAppCommand } from "@/app/desktopApiTypes";
import { getSubpixDocumentStats } from "@/format/documentStats";
import { getExportReadiness } from "@/format/exportReadiness";
import { createPackedPngBytes } from "@/format/exportPng";
import { loadSubpix, SubpixLoadError } from "@/format/loadSubpix";
import { getSubpixPattern, SUBPIX_PATTERNS, type SubpixPatternId } from "@/format/patterns";
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
  SUBPIX_INTERNAL_MIME,
  type DisplayProfileId,
  type Tool,
  type ViewMode
} from "@/format/subpixTypes";
import { useDocumentStore } from "@/state/documentStore";
import { baseNameFromPath, ensurePngFileName, ensureSubpixFileName } from "@/utils/fileNames";

const PREVIEW_MODES: Array<{ id: Exclude<ViewMode, "grid">; label: string }> = [
  { id: "simulated", label: "Simulated" },
  { id: "packed", label: "Packed" }
];

const TOOL_LABELS: Record<Tool, string> = {
  brush: "Brush",
  eraser: "Eraser"
};

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
  const [tool, setTool] = useState<Tool>(initialPreferences.tool);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [displayProfile, setDisplayProfile] = useState<DisplayProfileId>(initialPreferences.displayProfile);
  const [zoom, setZoom] = useState(initialPreferences.zoom);
  const [showGrid, setShowGrid] = useState(initialPreferences.showGrid);
  const [showPixelBoundaries, setShowPixelBoundaries] = useState(initialPreferences.showPixelBoundaries);
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [isNewDocumentDialogOpen, setIsNewDocumentDialogOpen] = useState(false);
  const [newDocumentDraft, setNewDocumentDraft] = useState<NewDocumentDraft>(DEFAULT_NEW_DOCUMENT_DRAFT);
  const [newDocumentError, setNewDocumentError] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<SubpixPatternId>(SUBPIX_PATTERNS[0].id);

  const document = state.currentDocument;
  const packedAvailable = canUsePackedPreview(document, displayProfile);
  const renderOrder = getRenderOrder(document, displayProfile);
  const compatibilityMessage = getCompatibilityMessage(document, displayProfile);
  const selectedPatternDefinition = getSubpixPattern(selectedPattern);
  const suggestedBaseName = baseNameFromPath(state.filePath) || document.document.name || "Untitled";
  const fileLabel = ensureSubpixFileName(suggestedBaseName);
  const documentStats = useMemo(() => getSubpixDocumentStats(document, renderOrder), [document, renderOrder]);
  const exportReadiness = useMemo(() => getExportReadiness(document, displayProfile), [displayProfile, document]);
  const activeViewLabel =
    viewMode === "grid" ? "Drawing grid" : viewMode === "simulated" ? "Simulated preview" : "Packed preview";
  const windowTitle = `${state.isDirty ? "*" : ""}${ensureSubpixFileName(suggestedBaseName)} - Subpix`;

  useEffect(() => {
    isDirtyRef.current = state.isDirty;
  }, [state.isDirty]);

  useEffect(() => {
    window.document.title = windowTitle;
  }, [windowTitle]);

  useEffect(() => {
    writeAppPreferences({
      displayProfile,
      showGrid,
      showPixelBoundaries,
      tool,
      zoom
    });
  }, [displayProfile, showGrid, showPixelBoundaries, tool, zoom]);

  useEffect(() => {
    let disposed = false;
    const desktopApi = getDesktopApi();

    function openDesktopDocument(result: Awaited<ReturnType<typeof desktopApi.openSubpix>>): void {
      if (!result || disposed) {
        return;
      }

      if (isDirtyRef.current && !window.confirm("Discard unsaved changes?")) {
        return;
      }

      try {
        const nextDocument = loadSubpix(result.content);
        actions.loadDocument(nextDocument, result.filePath);
        setViewMode("grid");
        setStatusMessage(`Opened ${ensureSubpixFileName(baseNameFromPath(result.filePath))}.`);
      } catch (error) {
        setStatusMessage(`Open failed: ${formatError(error)}`);
      }
    }

    void desktopApi.getLaunchSubpixFile().then(openDesktopDocument).catch((error: unknown) => {
      if (!disposed) {
        setStatusMessage(`Open failed: ${formatError(error)}`);
      }
    });

    const unsubscribe = desktopApi.onOpenSubpixFile(openDesktopDocument);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [actions]);

  useEffect(() => {
    if (viewMode === "packed" && !packedAvailable) {
      setViewMode("simulated");
      setStatusMessage("Packed preview is disabled for the selected display profile.");
    }
  }, [packedAvailable, viewMode]);

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
        if (isNewDocumentDialogOpen) {
          event.preventDefault();
          setIsNewDocumentDialogOpen(false);
          return;
        }

        if (!editableTarget && viewMode !== "grid") {
          event.preventDefault();
          setViewMode("grid");
          setStatusMessage("Returned to drawing grid.");
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
        } else if (key === "o") {
          event.preventDefault();
          void handleOpen();
        } else if (key === "n") {
          event.preventDefault();
          handleNew();
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
      } else if (key === "g") {
        event.preventDefault();
        toggleGrid();
      } else if (key === "p") {
        event.preventDefault();
        togglePixelBoundaries();
      } else if (key === "=" || key === "+") {
        event.preventDefault();
        adjustZoom(zoom + ZOOM_STEP);
      } else if (key === "-") {
        event.preventDefault();
        adjustZoom(zoom - ZOOM_STEP);
      } else if (key === "1") {
        event.preventDefault();
        setViewMode("grid");
        setStatusMessage("Drawing grid selected.");
      } else if (key === "2") {
        event.preventDefault();
        setPreviewMode("simulated");
      } else if (key === "3") {
        event.preventDefault();
        setPreviewMode("packed");
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

  function selectTool(nextTool: Tool): void {
    setTool(nextTool);
    setViewMode("grid");
    setStatusMessage(`${TOOL_LABELS[nextTool]} selected.`);
  }

  function setPreviewMode(nextMode: Exclude<ViewMode, "grid">): void {
    if (nextMode === "packed" && !packedAvailable) {
      setStatusMessage("Packed preview is disabled for the selected display profile.");
      return;
    }

    const resolvedMode = viewMode === nextMode ? "grid" : nextMode;
    setViewMode(resolvedMode);
    setStatusMessage(resolvedMode === "grid" ? "Returned to drawing grid." : `${nextMode === "packed" ? "Packed" : "Simulated"} preview.`);
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

  function handleAppCommand(command: DesktopAppCommand): void {
    switch (command) {
      case "new":
        handleNew();
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
        actions.clearCanvas();
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
      case "show-grid-view":
        setViewMode("grid");
        setStatusMessage("Drawing grid selected.");
        break;
      case "show-simulated-view":
        setPreviewMode("simulated");
        break;
      case "show-packed-view":
        setPreviewMode("packed");
        break;
      case "zoom-in":
        adjustZoom(zoom + ZOOM_STEP);
        break;
      case "zoom-out":
        adjustZoom(zoom - ZOOM_STEP);
        break;
      case "toggle-grid":
        toggleGrid();
        break;
      case "toggle-pixel-boundaries":
        togglePixelBoundaries();
        break;
      case "display-rgb":
        setDisplayProfile("rgb-horizontal");
        setStatusMessage("RGB horizontal stripe display selected.");
        break;
      case "display-bgr":
        setDisplayProfile("bgr-horizontal");
        setStatusMessage("BGR horizontal stripe display selected.");
        break;
      case "display-incompatible":
        setDisplayProfile("incompatible");
        setStatusMessage("Incompatible display profile selected. Use simulated preview.");
        break;
    }
  }

  function confirmDiscardDirty(): boolean {
    return !state.isDirty || window.confirm("Discard unsaved changes?");
  }

  function insertPattern(patternId: SubpixPatternId = selectedPattern): void {
    const pattern = getSubpixPattern(patternId);
    actions.insertPattern(pattern.id);
    setSelectedPattern(pattern.id);
    setViewMode("grid");
    setStatusMessage(`Inserted ${pattern.label}.`);
  }

  function parseDocumentDimension(value: string, label: string): number {
    const parsedValue = Number(value);
    if (!isSupportedDocumentDimension(parsedValue)) {
      throw new Error(`${label} must be a whole number from ${MIN_DOCUMENT_PIXELS} to ${MAX_DOCUMENT_PIXELS}.`);
    }

    return parsedValue;
  }

  function handleNew(): void {
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

    if (!confirmDiscardDirty()) {
      return;
    }

    const name = normalizeDocumentName(newDocumentDraft.name);
    actions.newDocument({ name, widthPixels, heightPixels });
    setViewMode("grid");
    setIsNewDocumentDialogOpen(false);
    setNewDocumentError(null);
    setStatusMessage(`Created ${ensureSubpixFileName(name)} (${widthPixels}x${heightPixels}px).`);
  }

  async function handleOpen(): Promise<void> {
    if (!confirmDiscardDirty()) {
      return;
    }

    try {
      const result = await getDesktopApi().openSubpix();
      if (!result) {
        return;
      }

      const nextDocument = loadSubpix(result.content);
      actions.loadDocument(nextDocument, result.filePath);
      setViewMode("grid");
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

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup" aria-label="Subpix">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark__slot brand-mark__slot--r" />
            <span className="brand-mark__slot brand-mark__slot--g" />
            <span className="brand-mark__slot brand-mark__slot--b" />
          </div>
          <div className="brand-copy">
            <strong>Subpix</strong>
            <span>Subpixel Image Studio</span>
          </div>
        </div>

        <div className="top-bar__group">
          <button className="command-button" onClick={handleNew}>
            <FilePlus2 size={16} />
            New
          </button>
          <button className="command-button" onClick={() => void handleOpen()} disabled={!isDesktopRuntime()}>
            <FolderOpen size={16} />
            Open
          </button>
          <button className="command-button" onClick={() => void handleSave(false)}>
            <Save size={16} />
            Save
          </button>
          <button className="command-button" onClick={() => void handleSave(true)}>
            <SaveAll size={16} />
            Save As
          </button>
          <button
            className="command-button"
            onClick={() => void handleExportPng()}
            disabled={!packedAvailable}
            title={packedAvailable ? "Export packed RGB PNG" : "PNG export requires a compatible display profile"}
          >
            <Download size={16} />
            Export PNG
          </button>
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
        </div>

        <div className="segmented-control" aria-label="Preview mode">
          {PREVIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              className={viewMode === mode.id ? "is-selected" : ""}
              aria-pressed={viewMode === mode.id}
              onClick={() => setPreviewMode(mode.id)}
              disabled={mode.id === "packed" && !packedAvailable}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="document-strip" title={fileLabel}>
          <span className={state.isDirty ? "document-strip__state is-dirty" : "document-strip__state"} />
          <span className="document-strip__name">{fileLabel}</span>
          <span className="document-strip__meta">
            {document.document.widthPixels}x{document.document.heightPixels}px / {getWidthSubpixels(document)}x
            {getHeightSubpixels(document)} cells
          </span>
        </div>

        <label className="select-field">
          <span>Display</span>
          <select value={displayProfile} onChange={(event) => setDisplayProfile(event.target.value as DisplayProfileId)}>
            {DISPLAY_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <aside className="left-toolbar" aria-label="Tools">
        <button
          className={tool === "brush" ? "tool-button is-selected" : "tool-button"}
          title="Brush (B)"
          aria-pressed={tool === "brush"}
          onClick={() => selectTool("brush")}
        >
          <Brush size={20} />
        </button>
        <button
          className={tool === "eraser" ? "tool-button is-selected" : "tool-button"}
          title="Eraser (E)"
          aria-pressed={tool === "eraser"}
          onClick={() => selectTool("eraser")}
        >
          <Eraser size={20} />
        </button>
        <button className="tool-button" title="Clear canvas" onClick={actions.clearCanvas}>
          <Trash2 size={20} />
        </button>
        <div className="toolbar-divider" />
        <button
          className={showGrid ? "tool-button is-selected" : "tool-button"}
          title="Toggle grid (G)"
          aria-pressed={showGrid}
          onClick={toggleGrid}
        >
          <Grid2X2 size={20} />
        </button>
        <button
          className={showPixelBoundaries ? "tool-button is-selected" : "tool-button"}
          title="Toggle pixel boundaries (P)"
          aria-pressed={showPixelBoundaries}
          onClick={togglePixelBoundaries}
        >
          {showPixelBoundaries ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      </aside>

      <main className="workspace">
        <SubpixelCanvas
          document={document}
          viewMode={viewMode}
          displayProfile={displayProfile}
          order={renderOrder}
          tool={tool}
          zoom={zoom}
          showGrid={showGrid}
          showPixelBoundaries={showPixelBoundaries}
          onBeginStroke={actions.beginStroke}
          onPaintCell={actions.paintCell}
          onEndStroke={actions.endStroke}
        />
      </main>

      <aside className="right-panel">
        <section className="panel-section panel-section--identity">
          <div className="identity-card">
            <div className="identity-card__mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <h2>Subpixel Image</h2>
              <p>{activeViewLabel}</p>
            </div>
          </div>
        </section>

        <section className="panel-section">
          <h2>Document</h2>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{ensureSubpixFileName(suggestedBaseName)}</dd>
            </div>
            <div>
              <dt>Real pixels</dt>
              <dd>
                {document.document.widthPixels} x {document.document.heightPixels}
              </dd>
            </div>
            <div>
              <dt>Subpixel cells</dt>
              <dd>
                {getWidthSubpixels(document)} x {getHeightSubpixels(document)}
              </dd>
            </div>
            <div>
              <dt>Active cells</dt>
              <dd>
                {documentStats.activeCells} / {documentStats.totalCells}
              </dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>{documentStats.coverage.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{SUBPIX_INTERNAL_MIME}</dd>
            </div>
          </dl>
        </section>

        <section className="panel-section">
          <h2>Architecture</h2>
          <dl>
            <div>
              <dt>Geometry</dt>
              <dd>{document.architecture.geometry}</dd>
            </div>
            <div>
              <dt>Slots</dt>
              <dd>{document.architecture.slotsPerPixel.join(" x ")}</dd>
            </div>
            <div>
              <dt>Orders</dt>
              <dd>{document.architecture.compatibleOrders.join(", ")}</dd>
            </div>
            <div>
              <dt>Display</dt>
              <dd>{getDisplayProfileLabel(displayProfile)}</dd>
            </div>
          </dl>
        </section>

        <section className={`panel-section export-readiness export-readiness--${exportReadiness.status}`}>
          <div className="section-title-row">
            <h2>Export</h2>
            <span>{exportReadiness.statusLabel}</span>
          </div>
          <dl>
            <div>
              <dt>PNG size</dt>
              <dd>
                {exportReadiness.outputWidthPixels} x {exportReadiness.outputHeightPixels}
              </dd>
            </div>
            <div>
              <dt>Pixels</dt>
              <dd>{exportReadiness.outputPixelCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>RGBA bytes</dt>
              <dd>{exportReadiness.outputByteCount.toLocaleString()}</dd>
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
          <p>{exportReadiness.message}</p>
        </section>

        <section className="panel-section">
          <h2>Subpixel Signal</h2>
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

        <section className="panel-section">
          <h2>Patterns</h2>
          <div className="pattern-controls">
            <label className="input-field">
              <span>Preset</span>
              <select
                value={selectedPattern}
                onChange={(event) => setSelectedPattern(event.target.value as SubpixPatternId)}
              >
                {SUBPIX_PATTERNS.map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.label}
                  </option>
                ))}
              </select>
            </label>
            <p>{selectedPatternDefinition.summary}</p>
            <button className="command-button command-button--wide" type="button" onClick={() => insertPattern()}>
              <Sparkles size={16} />
              Insert Pattern
            </button>
          </div>
        </section>

        <section className="panel-section">
          <h2>Workspace</h2>
          <dl>
            <div>
              <dt>Tool</dt>
              <dd>{TOOL_LABELS[tool]}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{activeViewLabel}</dd>
            </div>
            <div>
              <dt>Zoom</dt>
              <dd>{zoom}px</dd>
            </div>
            <div>
              <dt>Grid</dt>
              <dd>{showGrid ? "Shown" : "Hidden"}</dd>
            </div>
            <div>
              <dt>Boundaries</dt>
              <dd>{showPixelBoundaries ? "Shown" : "Hidden"}</dd>
            </div>
          </dl>
        </section>

        <section className={`compatibility compatibility--${packedAvailable ? "ok" : "bad"}`}>
          <h2>{compatibilityLabel}</h2>
          <p>{compatibilityMessage}</p>
        </section>
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

      <footer className="status-bar" role="status">
        <span>{statusMessage}</span>
        <span>
          {activeViewLabel} / {TOOL_LABELS[tool]} / {state.isDirty ? "Unsaved changes" : "Saved"}
        </span>
      </footer>
    </div>
  );
}
