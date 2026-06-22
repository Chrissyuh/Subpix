import { channelIndexForSlot, getCompositeSubpixelIntensities } from "@/format/exportPng";
import { getWidthSubpixels, type SubpixDocument, type SubpixOrder } from "@/format/subpixTypes";

export interface GridOptions {
  showGrid: boolean;
  showPixelBoundaries: boolean;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#111317";
  ctx.fillRect(0, 0, width, height);
}

export function colorForSlot(slot: number, order: SubpixOrder, intensity: number): string {
  const channels = [0, 0, 0];
  channels[channelIndexForSlot(slot, order)] = intensity;
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
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
      ctx.fillStyle = colorForSlot(x % 3, order, intensity);
      ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    }
  }
}

