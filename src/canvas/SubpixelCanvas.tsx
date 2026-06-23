import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { renderSimulatedView } from "@/canvas/renderSimulatedView";
import { lineCells, type CellPoint } from "@/canvas/strokeGeometry";
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

interface DragState {
  current: CellPoint;
  shiftKey: boolean;
  start: CellPoint;
  tool: Tool;
}

export interface WheelZoomAnchor {
  canvasX: number;
  canvasY: number;
  clientX: number;
  clientY: number;
  direction: 1 | -1;
}

export interface SubpixelCanvasProps {
  document: SubpixDocument;
  order: SubpixOrder;
  tool: Tool;
  zoom: number;
  ignoreColor: boolean;
  showGrid: boolean;
  showPixelBoundaries: boolean;
  onBeginStroke: () => void;
  onPaintCells: (cells: CellPoint[], intensity: number) => void;
  onEndStroke: () => void;
  onWheelZoom: (anchor: WheelZoomAnchor) => void;
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

function isBrushTool(tool: Tool): boolean {
  return tool === "brush" || tool === "eraser";
}

function clampCell(cell: CellPoint, widthSubpixels: number, heightSubpixels: number): CellPoint {
  return {
    x: Math.max(0, Math.min(widthSubpixels - 1, cell.x)),
    y: Math.max(0, Math.min(heightSubpixels - 1, cell.y))
  };
}

function normalizedBounds(start: CellPoint, current: CellPoint): { maxX: number; maxY: number; minX: number; minY: number } {
  return {
    maxX: Math.max(start.x, current.x),
    maxY: Math.max(start.y, current.y),
    minX: Math.min(start.x, current.x),
    minY: Math.min(start.y, current.y)
  };
}

function lockLineToAxis(start: CellPoint, current: CellPoint, shiftKey: boolean): CellPoint {
  if (!shiftKey) {
    return current;
  }

  return Math.abs(current.x - start.x) >= Math.abs(current.y - start.y)
    ? { x: current.x, y: start.y }
    : { x: start.x, y: current.y };
}

function rectangleCells(start: CellPoint, current: CellPoint, fill: boolean): CellPoint[] {
  const bounds = normalizedBounds(start, current);
  const cells: CellPoint[] = [];

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (fill || x === bounds.minX || x === bounds.maxX || y === bounds.minY || y === bounds.maxY) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function ellipseCells(start: CellPoint, current: CellPoint, fill: boolean): CellPoint[] {
  const bounds = normalizedBounds(start, current);
  const cells: CellPoint[] = [];
  const radiusX = Math.max(0.5, (bounds.maxX - bounds.minX + 1) / 2);
  const radiusY = Math.max(0.5, (bounds.maxY - bounds.minY + 1) / 2);
  const centerX = bounds.minX + radiusX - 0.5;
  const centerY = bounds.minY + radiusY - 0.5;
  const edgeTolerance = Math.max(0.18, Math.min(0.42, 1 / Math.max(radiusX, radiusY)));

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const normalized =
        ((x - centerX) * (x - centerX)) / (radiusX * radiusX) +
        ((y - centerY) * (y - centerY)) / (radiusY * radiusY);

      if (fill ? normalized <= 1 : Math.abs(normalized - 1) <= edgeTolerance) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

function cellsForDrag(drag: DragState): CellPoint[] {
  const current = drag.tool === "line" ? lockLineToAxis(drag.start, drag.current, drag.shiftKey) : drag.current;

  switch (drag.tool) {
    case "line":
      return lineCells(drag.start, current);
    case "rect-outline":
      return rectangleCells(drag.start, current, false);
    case "box-eraser":
      return rectangleCells(drag.start, current, true);
    case "rect-fill":
      return rectangleCells(drag.start, current, true);
    case "ellipse-outline":
      return ellipseCells(drag.start, current, false);
    case "ellipse-fill":
      return ellipseCells(drag.start, current, true);
    default:
      return [];
  }
}

function drawDragPreview(ctx: CanvasRenderingContext2D, drag: DragState, metrics: CanvasMetrics): void {
  const current = drag.tool === "line" ? lockLineToAxis(drag.start, drag.current, drag.shiftKey) : drag.current;
  const bounds = normalizedBounds(drag.start, current);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = drag.tool === "box-eraser" ? "#ff3434" : "rgba(255, 255, 255, 0.9)";
  ctx.fillStyle = drag.tool === "box-eraser" ? "rgba(255, 52, 52, 0.08)" : "rgba(255, 255, 255, 0.12)";

  if (drag.tool === "line") {
    ctx.beginPath();
    ctx.moveTo((drag.start.x + 0.5) * metrics.subpixelCellWidth, (drag.start.y + 0.5) * metrics.subpixelCellHeight);
    ctx.lineTo((current.x + 0.5) * metrics.subpixelCellWidth, (current.y + 0.5) * metrics.subpixelCellHeight);
    ctx.stroke();
  } else {
    const x = bounds.minX * metrics.subpixelCellWidth;
    const y = bounds.minY * metrics.subpixelCellHeight;
    const width = (bounds.maxX - bounds.minX + 1) * metrics.subpixelCellWidth;
    const height = (bounds.maxY - bounds.minY + 1) * metrics.subpixelCellHeight;

    if (drag.tool === "ellipse-outline" || drag.tool === "ellipse-fill") {
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      if (drag.tool === "ellipse-fill") {
        ctx.fill();
      }
      ctx.stroke();
    } else {
      if (drag.tool === "rect-fill" || drag.tool === "box-eraser") {
        ctx.fillRect(x, y, width, height);
      }
      ctx.strokeRect(x, y, width, height);
    }
  }

  ctx.restore();
}

export function SubpixelCanvas({
  document,
  order,
  tool,
  zoom,
  ignoreColor,
  showGrid,
  showPixelBoundaries,
  onBeginStroke,
  onPaintCells,
  onEndStroke,
  onWheelZoom
}: SubpixelCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastBrushCellRef = useRef<CellPoint | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [pointerCell, setPointerCell] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
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
      ignoreColor,
      showGrid,
      showPixelBoundaries
    });

    if (dragState) {
      drawDragPreview(ctx, dragState, metrics);
    }
  }, [document, dragState, ignoreColor, metrics, order, showGrid, showPixelBoundaries, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const targetCanvas = canvas;

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      const rect = targetCanvas.getBoundingClientRect();
      onWheelZoom({
        canvasX: event.clientX - rect.left,
        canvasY: event.clientY - rect.top,
        clientX: event.clientX,
        clientY: event.clientY,
        direction: event.deltaY < 0 ? 1 : -1
      });
    }

    targetCanvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => targetCanvas.removeEventListener("wheel", handleWheel);
  }, [onWheelZoom]);

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

  function paintBrushSegment(cell: CellPoint): void {
    const lastCell = lastBrushCellRef.current;
    if (lastCell && lastCell.x === cell.x && lastCell.y === cell.y) {
      return;
    }

    onPaintCells(lastCell ? lineCells(lastCell, cell) : [cell], tool === "brush" ? 255 : 0);
    lastBrushCellRef.current = cell;
  }

  function scrollWorkspace(event: React.PointerEvent<HTMLCanvasElement>): void {
    const pan = panRef.current;
    const workspace = event.currentTarget.closest(".workspace");
    if (!pan || !(workspace instanceof HTMLElement)) {
      return;
    }

    workspace.scrollLeft -= event.clientX - pan.x;
    workspace.scrollTop -= event.clientY - pan.y;
    panRef.current = { ...pan, x: event.clientX, y: event.clientY };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (event.button === 2) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      setIsPanning(true);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const cell = getCellFromPointer(event);
    if (!cell) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerCell(cell);

    if (isBrushTool(tool)) {
      drawingRef.current = true;
      lastBrushCellRef.current = null;
      onBeginStroke();
      paintBrushSegment(cell);
      return;
    }

    setDragState({ current: cell, shiftKey: event.shiftKey, start: cell, tool });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
    if (panRef.current) {
      event.preventDefault();
      scrollWorkspace(event);
      return;
    }

    const cell = getCellFromPointer(event);
    setPointerCell(cell);

    if (!cell) {
      return;
    }

    if (dragState) {
      const widthSubpixels = getWidthSubpixels(document);
      const heightSubpixels = getHeightSubpixels(document);
      setDragState((drag) =>
        drag
          ? {
              ...drag,
              current: clampCell(cell, widthSubpixels, heightSubpixels),
              shiftKey: event.shiftKey
            }
          : drag
      );
      return;
    }

    if (drawingRef.current) {
      paintBrushSegment(cell);
    }
  }

  function handlePointerUp(): void {
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
      return;
    }

    if (dragState) {
      const cells = cellsForDrag(dragState);
      setDragState(null);

      if (cells.length > 0) {
        onBeginStroke();
        onPaintCells(cells, dragState.tool === "box-eraser" ? 0 : 255);
        onEndStroke();
      }
      return;
    }

    if (drawingRef.current) {
      drawingRef.current = false;
      lastBrushCellRef.current = null;
      onEndStroke();
    }
  }

  function originAdjustedCell(cell: CellPoint): CellPoint {
    return {
      x: cell.x - Math.floor(getWidthSubpixels(document) / 2),
      y: cell.y - Math.floor(getHeightSubpixels(document) / 2)
    };
  }

  return (
    <div className="canvas-stage">
      <canvas
        ref={canvasRef}
        aria-label="Subpixel artwork canvas"
        className={`subpixel-canvas subpixel-canvas--simulated${isPanning ? " is-panning" : ""}`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setPointerCell(null)}
      />
      {pointerCell ? (
        <div className="cell-readout">
          {originAdjustedCell(pointerCell).x}, {originAdjustedCell(pointerCell).y}
        </div>
      ) : null}
    </div>
  );
}
