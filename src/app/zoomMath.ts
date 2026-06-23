export interface CursorZoomAnchor {
  canvasX: number;
  canvasY: number;
  clientX: number;
  clientY: number;
}

export interface WorkspaceViewportSnapshot {
  rectLeft: number;
  rectTop: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface CursorAnchoredScroll {
  scrollLeft: number;
  scrollTop: number;
}

export function getCursorAnchoredScroll(
  anchor: CursorZoomAnchor,
  workspace: WorkspaceViewportSnapshot,
  currentZoom: number,
  nextZoom: number
): CursorAnchoredScroll {
  const viewportX = anchor.clientX - workspace.rectLeft;
  const viewportY = anchor.clientY - workspace.rectTop;
  const canvasContentLeft = workspace.scrollLeft + viewportX - anchor.canvasX;
  const canvasContentTop = workspace.scrollTop + viewportY - anchor.canvasY;
  const scale = nextZoom / currentZoom;

  return {
    scrollLeft: Math.max(0, canvasContentLeft + anchor.canvasX * scale - viewportX),
    scrollTop: Math.max(0, canvasContentTop + anchor.canvasY * scale - viewportY)
  };
}
