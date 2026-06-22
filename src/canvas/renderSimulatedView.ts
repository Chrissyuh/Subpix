import { clearCanvas, colorForSlot, drawGrid, type GridOptions } from "@/canvas/renderCommon";
import { getCompositeSubpixelIntensities } from "@/format/exportPng";
import { getWidthSubpixels, type SubpixDocument, type SubpixOrder } from "@/format/subpixTypes";

export interface RenderSimulatedViewOptions extends GridOptions {
  subpixelWidth: number;
  pixelHeight: number;
  order: SubpixOrder;
}

export function renderSimulatedView(
  ctx: CanvasRenderingContext2D,
  document: SubpixDocument,
  options: RenderSimulatedViewOptions
): void {
  const widthSubpixels = getWidthSubpixels(document);
  const heightPixels = document.document.heightPixels;
  const width = widthSubpixels * options.subpixelWidth;
  const height = heightPixels * options.pixelHeight;
  const composite = getCompositeSubpixelIntensities(document);

  clearCanvas(ctx, width, height);

  for (let y = 0; y < heightPixels; y += 1) {
    for (let x = 0; x < widthSubpixels; x += 1) {
      const intensity = composite[y * widthSubpixels + x] ?? 0;
      ctx.fillStyle = colorForSlot(x % 3, options.order, intensity);
      ctx.fillRect(x * options.subpixelWidth, y * options.pixelHeight, options.subpixelWidth, options.pixelHeight);
    }
  }

  drawGrid(ctx, widthSubpixels, heightPixels, options.subpixelWidth, options.pixelHeight, options);
}

