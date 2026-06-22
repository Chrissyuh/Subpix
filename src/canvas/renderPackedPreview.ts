import { clearCanvas } from "@/canvas/renderCommon";
import { packSubpixToRgba } from "@/format/exportPng";
import type { SubpixDocument, SubpixOrder } from "@/format/subpixTypes";

export interface RenderPackedPreviewOptions {
  pixelSize: number;
  order: SubpixOrder;
  showGrid: boolean;
}

export function renderPackedPreview(
  ctx: CanvasRenderingContext2D,
  document: SubpixDocument,
  options: RenderPackedPreviewOptions
): void {
  const { widthPixels, heightPixels } = document.document;
  const width = widthPixels * options.pixelSize;
  const height = heightPixels * options.pixelSize;
  const rgba = packSubpixToRgba(document, options.order);

  clearCanvas(ctx, width, height);

  for (let y = 0; y < heightPixels; y += 1) {
    for (let x = 0; x < widthPixels; x += 1) {
      const base = (y * widthPixels + x) * 4;
      ctx.fillStyle = `rgb(${rgba[base]} ${rgba[base + 1]} ${rgba[base + 2]})`;
      ctx.fillRect(x * options.pixelSize, y * options.pixelSize, options.pixelSize, options.pixelSize);
    }
  }

  if (options.showGrid && options.pixelSize >= 8) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= widthPixels; x += 1) {
      const px = Math.round(x * options.pixelSize) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }

    for (let y = 0; y <= heightPixels; y += 1) {
      const py = Math.round(y * options.pixelSize) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }

    ctx.stroke();
  }
}

