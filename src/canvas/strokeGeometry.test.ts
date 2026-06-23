import { describe, expect, it } from "vitest";
import { lineCells } from "@/canvas/strokeGeometry";

describe("stroke geometry", () => {
  it("fills gaps between sparse horizontal brush samples", () => {
    expect(lineCells({ x: 2, y: 4 }, { x: 7, y: 4 })).toEqual([
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 7, y: 4 }
    ]);
  });

  it("fills gaps between sparse vertical brush samples", () => {
    expect(lineCells({ x: 5, y: 1 }, { x: 5, y: 5 })).toEqual([
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
      { x: 5, y: 5 }
    ]);
  });

  it("rasterizes diagonal samples in drawing order", () => {
    expect(lineCells({ x: 1, y: 1 }, { x: 4, y: 3 })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 3 }
    ]);
  });
});
