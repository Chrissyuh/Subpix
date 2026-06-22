import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Brush,
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
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { SubpixelCanvas } from "@/canvas/SubpixelCanvas";
import { getDesktopApi, isDesktopRuntime } from "@/app/desktopApi";
import { createPackedPngBytes } from "@/format/exportPng";
import { loadSubpix, SubpixLoadError } from "@/format/loadSubpix";
import { saveSubpix } from "@/format/saveSubpix";
import {
  canUsePackedPreview,
  DEFAULT_DOCUMENT_FILE_NAME,
  DISPLAY_PROFILES,
  getCompatibilityMessage,
  getDisplayProfileLabel,
  getHeightSubpixels,
  getRenderOrder,
  getWidthSubpixels,
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

function formatError(error: unknown): string {
  if (error instanceof SubpixLoadError) {
    return error.errors.join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function App(): ReactElement {
  const { state, actions } = useDocumentStore();
  const [tool, setTool] = useState<Tool>("brush");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [displayProfile, setDisplayProfile] = useState<DisplayProfileId>("rgb-horizontal");
  const [zoom, setZoom] = useState(12);
  const [showGrid, setShowGrid] = useState(true);
  const [showPixelBoundaries, setShowPixelBoundaries] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Ready.");

  const document = state.currentDocument;
  const packedAvailable = canUsePackedPreview(document, displayProfile);
  const renderOrder = getRenderOrder(document, displayProfile);
  const compatibilityMessage = getCompatibilityMessage(document, displayProfile);
  const suggestedBaseName = baseNameFromPath(state.filePath) || document.document.name || "Untitled";
  const windowTitle = `${state.isDirty ? "*" : ""}${ensureSubpixFileName(suggestedBaseName)} - Subpix`;

  useEffect(() => {
    window.document.title = windowTitle;
  }, [windowTitle]);

  useEffect(() => {
    if (viewMode === "packed" && !packedAvailable) {
      setViewMode("simulated");
      setStatusMessage("Packed preview is disabled for the selected display profile.");
    }
  }, [packedAvailable, viewMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;

      if (!commandKey) {
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

  function confirmDiscardDirty(): boolean {
    return !state.isDirty || window.confirm("Discard unsaved changes?");
  }

  function handleNew(): void {
    if (!confirmDiscardDirty()) {
      return;
    }

    actions.newDocument();
    setViewMode("grid");
    setStatusMessage("Created Untitled.subpix.");
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
    setZoom(Math.max(3, Math.min(40, nextZoom)));
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
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
          <button className="icon-button" title="Zoom out" onClick={() => adjustZoom(zoom - 2)}>
            <ZoomOut size={17} />
          </button>
          <span className="zoom-readout">{zoom}px</span>
          <button className="icon-button" title="Zoom in" onClick={() => adjustZoom(zoom + 2)}>
            <ZoomIn size={17} />
          </button>
        </div>

        <div className="segmented-control" aria-label="Preview mode">
          {PREVIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              className={viewMode === mode.id ? "is-selected" : ""}
              aria-pressed={viewMode === mode.id}
              onClick={() => setViewMode((currentMode) => (currentMode === mode.id ? "grid" : mode.id))}
              disabled={mode.id === "packed" && !packedAvailable}
            >
              {mode.label}
            </button>
          ))}
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
          title="Brush"
          aria-pressed={tool === "brush"}
          onClick={() => {
            setTool("brush");
            setViewMode("grid");
          }}
        >
          <Brush size={20} />
        </button>
        <button
          className={tool === "eraser" ? "tool-button is-selected" : "tool-button"}
          title="Eraser"
          aria-pressed={tool === "eraser"}
          onClick={() => {
            setTool("eraser");
            setViewMode("grid");
          }}
        >
          <Eraser size={20} />
        </button>
        <button className="tool-button" title="Clear canvas" onClick={actions.clearCanvas}>
          <Trash2 size={20} />
        </button>
        <div className="toolbar-divider" />
        <button
          className={showGrid ? "tool-button is-selected" : "tool-button"}
          title="Toggle grid"
          aria-pressed={showGrid}
          onClick={() => setShowGrid((value) => !value)}
        >
          <Grid2X2 size={20} />
        </button>
        <button
          className={showPixelBoundaries ? "tool-button is-selected" : "tool-button"}
          title="Toggle pixel boundaries"
          aria-pressed={showPixelBoundaries}
          onClick={() => setShowPixelBoundaries((value) => !value)}
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

        <section className={`compatibility compatibility--${packedAvailable ? "ok" : "bad"}`}>
          <h2>{compatibilityLabel}</h2>
          <p>{compatibilityMessage}</p>
        </section>
      </aside>

      <footer className="status-bar" role="status">
        <span>{statusMessage}</span>
        <span>{state.isDirty ? "Unsaved changes" : "Saved"}</span>
      </footer>
    </div>
  );
}
