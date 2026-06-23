import { describe, expect, it } from "vitest";
import { colorForSlot } from "@/canvas/renderCommon";

describe("subpixel render colors", () => {
  it("renders slots in physical channel color by default", () => {
    expect(colorForSlot(0, "RGB", 255)).toBe("rgb(255 0 0)");
    expect(colorForSlot(1, "RGB", 128)).toBe("rgb(0 128 0)");
    expect(colorForSlot(2, "RGB", 64)).toBe("rgb(0 0 64)");
  });

  it("renders active subpixels as white intensity when color is ignored", () => {
    expect(colorForSlot(0, "RGB", 255, true)).toBe("rgb(255 255 255)");
    expect(colorForSlot(1, "RGB", 128, true)).toBe("rgb(128 128 128)");
    expect(colorForSlot(2, "BGR", 64, true)).toBe("rgb(64 64 64)");
  });
});
