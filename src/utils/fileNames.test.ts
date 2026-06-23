import { describe, expect, it } from "vitest";
import { baseNameFromPath, ensurePngFileName, ensureSubpixFileName } from "@/utils/fileNames";

describe("file name helpers", () => {
  it("extracts base names from Windows and POSIX paths", () => {
    expect(baseNameFromPath("C:\\Users\\me\\Drawing.subpix")).toBe("Drawing");
    expect(baseNameFromPath("/tmp/Export.png")).toBe("Export");
  });

  it("normalizes subpix file names", () => {
    expect(ensureSubpixFileName("Drawing")).toBe("Drawing.subpix");
    expect(ensureSubpixFileName("Drawing.SUBPIX")).toBe("Drawing.SUBPIX");
    expect(ensureSubpixFileName("  ")).toBe("Untitled.subpix");
  });

  it("normalizes png file names", () => {
    expect(ensurePngFileName("Packed")).toBe("Packed.png");
    expect(ensurePngFileName("Packed.PNG")).toBe("Packed.PNG");
    expect(ensurePngFileName("  ")).toBe("Untitled.png");
  });
});
