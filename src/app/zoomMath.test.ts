import { describe, expect, it } from "vitest";
import { getCursorAnchoredScroll } from "@/app/zoomMath";

describe("cursor anchored zoom", () => {
  it("keeps the same canvas point under the cursor while zooming in", () => {
    const nextScroll = getCursorAnchoredScroll(
      { canvasX: 240, canvasY: 180, clientX: 500, clientY: 340 },
      { rectLeft: 80, rectTop: 70, scrollLeft: 120, scrollTop: 60 },
      12,
      16
    );

    expect(nextScroll).toEqual({
      scrollLeft: 200,
      scrollTop: 120
    });
  });

  it("clamps scroll positions at the workspace origin", () => {
    const nextScroll = getCursorAnchoredScroll(
      { canvasX: 24, canvasY: 24, clientX: 120, clientY: 120 },
      { rectLeft: 80, rectTop: 70, scrollLeft: 0, scrollTop: 0 },
      16,
      12
    );

    expect(nextScroll).toEqual({
      scrollLeft: 0,
      scrollTop: 0
    });
  });
});
