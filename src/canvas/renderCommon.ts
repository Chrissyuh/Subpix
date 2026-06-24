import { channelIndexForSlot, getCompositeSubpixelIntensities } from "@/format/exportPng";
import { getWidthSubpixels, type SubpixDocument, type SubpixOrder } from "@/format/subpixTypes";

export interface GridOptions {
  ignoreColor: boolean;
  showGrid: boolean;
  showPixelBoundaries: boolean;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#111317";
  ctx.fillRect(0, 0, width, height);
}

const COLOR_CACHE: Record<SubpixOrder, string[][]> = {
  RGB: [[], [], []],
  BGR: [[], [], []]
};

const GRAY_COLOR_CACHE: string[] = [];

function normalizedIntensity(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function colorForSlot(slot: number, order: SubpixOrder, intensity: number, ignoreColor = false): string {
  const value = normalizedIntensity(intensity);

  if (ignoreColor) {
    GRAY_COLOR_CACHE[value] ??= `rgb(${value} ${value} ${value})`;
    return GRAY_COLOR_CACHE[value];
  }

  const slotColorCache = COLOR_CACHE[order][slot] ?? COLOR_CACHE[order][0];
  const channelIndex = channelIndexForSlot(slot, order);
  slotColorCache[value] ??= channelIndex === 0
    ? `rgb(${value} 0 0)`
    : channelIndex === 1
      ? `rgb(0 ${value} 0)`
      : `rgb(0 0 ${value})`;

  return slotColorCache[value];
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  widthSubpixels: number,
  heightSubpixels: number,
  cellWidth: number,
  cellHeight: number,
  options: GridOptions
): void {
  if (options.showGrid && cellWidth >= 5 && cellHeight >= 5) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= widthSubpixels; x += 1) {
      const px = Math.round(x * cellWidth) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, heightSubpixels * cellHeight);
    }

    for (let y = 0; y <= heightSubpixels; y += 1) {
      const py = Math.round(y * cellHeight) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(widthSubpixels * cellWidth, py);
    }

    ctx.stroke();
  }

  if (options.showPixelBoundaries) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;

    for (let x = 0; x <= widthSubpixels; x += 3) {
      const px = Math.round(x * cellWidth) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, heightSubpixels * cellHeight);
    }

    for (let y = 0; y <= heightSubpixels; y += 1) {
      const py = Math.round(y * cellHeight) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(widthSubpixels * cellWidth, py);
    }

    ctx.stroke();
  }
}

export function drawOriginPoint(
  ctx: CanvasRenderingContext2D,
  widthSubpixels: number,
  heightSubpixels: number,
  cellWidth: number,
  cellHeight: number
): void {
  const x = (widthSubpixels * cellWidth) / 2;
  const y = (heightSubpixels * cellHeight) / 2;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawSubpixelCells(
  ctx: CanvasRenderingContext2D,
  document: SubpixDocument,
  order: SubpixOrder,
  cellWidth: number,
  cellHeight: number
): void {
  const widthSubpixels = getWidthSubpixels(document);
  const heightSubpixels = document.document.heightPixels;
  const composite = getCompositeSubpixelIntensities(document);

  for (let y = 0; y < heightSubpixels; y += 1) {
    for (let x = 0; x < widthSubpixels; x += 1) {
      const intensity = composite[y * widthSubpixels + x] ?? 0;
      ctx.fillStyle = colorForSlot(x % 3, order, intensity, false);
      ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    }
  }
}
