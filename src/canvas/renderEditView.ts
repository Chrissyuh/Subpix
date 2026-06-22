import { drawGrid, drawSubpixelCells, clearCanvas, type GridOptions } from "@/canvas/renderCommon";
import { getHeightSubpixels, getWidthSubpixels, type SubpixDocument, type SubpixOrder } from "@/format/subpixTypes";

export interface RenderEditViewOptions extends GridOptions {
  cellSize: number;
  order: SubpixOrder;
}

export function renderEditView(
  ctx: CanvasRenderingContext2D,
  document: SubpixDocument,
  options: RenderEditViewOptions
): void {
  const widthSubpixels = getWidthSubpixels(document);
  const heightSubpixels = getHeightSubpixels(document);
  const width = widthSubpixels * options.cellSize;
  const height = heightSubpixels * options.cellSize;

  clearCanvas(ctx, width, height);
  drawSubpixelCells(ctx, document, options.order, options.cellSize, options.cellSize);
  drawGrid(ctx, widthSubpixels, heightSubpixels, options.cellSize, options.cellSize, options);
}

