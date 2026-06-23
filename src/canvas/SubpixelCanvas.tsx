import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { renderSimulatedView } from "@/canvas/renderSimulatedView";
import {
  getHeightSubpixels,
  getWidthSubpixels,
  type SubpixDocument,
  type SubpixOrder,
  type Tool
} from "@/format/subpixTypes";

interface CanvasMetrics {
  width: number;
  height: number;
  subpixelCellWidth: number;
  subpixelCellHeight: number;
}

export interface SubpixelCanvasProps {
  document: SubpixDocument;
  order: SubpixOrder;
  tool: Tool;
  zoom: number;
  showGrid: boolean;
  showPixelBoundaries: boolean;
  onBeginStroke: () => void;
  onPaintCell: (x: number, y: number, intensity: number) => void;
  onEndStroke: () => void;
}

function getCanvasMetrics(document: SubpixDocument, zoom: number): CanvasMetrics {
  const widthSubpixels = getWidthSubpixels(document);

  return {
    width: widthSubpixels * zoom,
    height: getHeightSubpixels(document) * zoom * 3,
    subpixelCellWidth: zoom,
    subpixelCellHeight: zoom * 3
  };
}

export function SubpixelCanvas({
  document,
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
  const metrics = useMemo(() => getCanvasMetrics(document, zoom), [document, zoom]);

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

    renderSimulatedView(ctx, document, {
      subpixelWidth: zoom,
      pixelHeight: zoom * 3,
      order,
      showGrid,
      showPixelBoundaries
    });
  }, [document, metrics, order, showGrid, showPixelBoundaries, zoom]);

  function getCellFromPointer(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
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
    if (event.button !== 0) {
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

  return (
    <div className="canvas-stage">
      <canvas
        ref={canvasRef}
        aria-label="Subpixel artwork canvas"
        className="subpixel-canvas subpixel-canvas--simulated"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setPointerCell(null)}
      />
      {pointerCell ? (
        <div className="cell-readout">
          {pointerCell.x}, {pointerCell.y}
        </div>
      ) : null}
    </div>
  );
}
