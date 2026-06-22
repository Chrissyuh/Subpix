import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { renderPackedPreview } from "@/canvas/renderPackedPreview";
import { renderSimulatedView } from "@/canvas/renderSimulatedView";
import { renderSubpixelGrid } from "@/canvas/renderSubpixelGrid";
import {
  canUsePackedPreview,
  getHeightSubpixels,
  getWidthSubpixels,
  type DisplayProfileId,
  type SubpixDocument,
  type SubpixOrder,
  type Tool,
  type ViewMode
} from "@/format/subpixTypes";

interface CanvasMetrics {
  width: number;
  height: number;
  subpixelCellWidth: number;
  subpixelCellHeight: number;
}

export interface SubpixelCanvasProps {
  document: SubpixDocument;
  viewMode: ViewMode;
  displayProfile: DisplayProfileId;
  order: SubpixOrder;
  tool: Tool;
  zoom: number;
  showGrid: boolean;
  showPixelBoundaries: boolean;
  onBeginStroke: () => void;
  onPaintCell: (x: number, y: number, intensity: number) => void;
  onEndStroke: () => void;
}

function getCanvasMetrics(document: SubpixDocument, viewMode: ViewMode, zoom: number): CanvasMetrics {
  const widthSubpixels = getWidthSubpixels(document);
  const heightSubpixels = getHeightSubpixels(document);

  if (viewMode === "packed") {
    const pixelSize = zoom * 3;
    return {
      width: document.document.widthPixels * pixelSize,
      height: document.document.heightPixels * pixelSize,
      subpixelCellWidth: zoom,
      subpixelCellHeight: zoom
    };
  }

  if (viewMode === "simulated") {
    return {
      width: widthSubpixels * zoom,
      height: document.document.heightPixels * zoom * 3,
      subpixelCellWidth: zoom,
      subpixelCellHeight: zoom * 3
    };
  }

  return {
    width: widthSubpixels * zoom,
    height: heightSubpixels * zoom,
    subpixelCellWidth: zoom,
    subpixelCellHeight: zoom
  };
}

export function SubpixelCanvas({
  document,
  viewMode,
  displayProfile,
  order,
  tool,
  zoom,
  showGrid,
  showPixelBoundaries,
  onBeginStroke,
  onPaintCell,
  onEndStroke
}: SubpixelCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPaintedRef = useRef<string | null>(null);
  const [pointerCell, setPointerCell] = useState<{ x: number; y: number } | null>(null);
  const metrics = useMemo(() => getCanvasMetrics(document, viewMode, zoom), [document, viewMode, zoom]);
  const packedAvailable = canUsePackedPreview(document, displayProfile);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(metrics.width * dpr));
    canvas.height = Math.max(1, Math.round(metrics.height * dpr));
    canvas.style.width = `${metrics.width}px`;
    canvas.style.height = `${metrics.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (viewMode === "packed" && packedAvailable) {
      renderPackedPreview(ctx, document, {
        pixelSize: zoom * 3,
        order,
        showGrid
      });
      return;
    }

    if (viewMode === "simulated") {
      renderSimulatedView(ctx, document, {
        subpixelWidth: zoom,
        pixelHeight: zoom * 3,
        order,
        showGrid,
        showPixelBoundaries
      });
      return;
    }

    renderSubpixelGrid(ctx, document, {
      cellSize: zoom,
      order,
      showGrid,
      showPixelBoundaries
    });
  }, [displayProfile, document, metrics, order, packedAvailable, showGrid, showPixelBoundaries, viewMode, zoom]);

  function getCellFromPointer(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    if (viewMode !== "grid") {
      return null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / metrics.subpixelCellWidth);
    const y = Math.floor((event.clientY - rect.top) / metrics.subpixelCellHeight);
    const widthSubpixels = getWidthSubpixels(document);
    const heightSubpixels = getHeightSubpixels(document);

    if (x < 0 || y < 0 || x >= widthSubpixels || y >= heightSubpixels) {
      return null;
    }

    return { x, y };
  }

  function paintCell(cell: { x: number; y: number }): void {
    const key = `${cell.x}:${cell.y}`;
    if (lastPaintedRef.current === key) {
      return;
    }

    lastPaintedRef.current = key;
    onPaintCell(cell.x, cell.y, tool === "brush" ? 255 : 0);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (event.button !== 0 || viewMode !== "grid") {
      return;
    }

    const cell = getCellFromPointer(event);
    if (!cell) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerCell(cell);

    drawingRef.current = true;
    lastPaintedRef.current = null;
    onBeginStroke();
    paintCell(cell);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    const cell = getCellFromPointer(event);
    setPointerCell(cell);

    if (!cell || !drawingRef.current) {
      return;
    }

    paintCell(cell);
  }

  function handlePointerUp(): void {
    if (drawingRef.current) {
      drawingRef.current = false;
      lastPaintedRef.current = null;
      onEndStroke();
    }
  }

  if (viewMode === "packed" && !packedAvailable) {
    return (
      <div className="canvas-empty-state" role="status">
        Packed preview is disabled for the selected display profile.
      </div>
    );
  }

  return (
    <div className="canvas-stage">
      <canvas
        ref={canvasRef}
        aria-label="Subpixel artwork canvas"
        className={`subpixel-canvas subpixel-canvas--${viewMode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setPointerCell(null)}
      />
      {viewMode === "grid" && pointerCell ? (
        <div className="cell-readout">
          {pointerCell.x}, {pointerCell.y}
        </div>
      ) : null}
    </div>
  );
}
