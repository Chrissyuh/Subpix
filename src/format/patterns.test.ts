import { describe, expect, it } from "vitest";
import { getSubpixDocumentStats } from "@/format/documentStats";
import { applySubpixPattern, getSubpixPattern } from "@/format/patterns";
import { createSubpixDocument } from "@/format/subpixTypes";
import { validateSubpix } from "@/format/validateSubpix";

describe("subpix pattern generation", () => {
  it("creates deterministic calibration bars without changing document metadata", () => {
    const document = createSubpixDocument({ name: "Pattern Fixture", widthPixels: 3, heightPixels: 2 });
    const patternedDocument = applySubpixPattern(document, "calibration-bars");

    expect(patternedDocument.document).toEqual(document.document);
    expect(patternedDocument.layers[0].data).toEqual([
      255, 0, 0,
      0, 255, 0,
      0, 0, 255,
      0, 0, 0,
      255, 255, 255,
      0, 0, 0
    ]);
    expect(validateSubpix(patternedDocument).ok).toBe(true);
  });

  it("creates a slot sweep with grayscale-compatible intensity values", () => {
    const document = createSubpixDocument({ widthPixels: 3, heightPixels: 1 });
    const patternedDocument = applySubpixPattern(document, "slot-sweep");

    expect(patternedDocument.layers[0].data).toEqual([
      255, 0, 0,
      42, 255, 42,
      85, 85, 255
    ]);
    expect(validateSubpix(patternedDocument).ok).toBe(true);
  });

  it("summarizes generated pattern signal through the document stats pipeline", () => {
    const document = createSubpixDocument({ widthPixels: 3, heightPixels: 2 });
    const patternedDocument = applySubpixPattern(document, "calibration-bars");
    const stats = getSubpixDocumentStats(patternedDocument, "RGB");

    expect(stats.activeCells).toBe(6);
    expect(stats.slotActivities.map((activity) => activity.activeCells)).toEqual([2, 2, 2]);
  });

  it("falls back to the first registered pattern for unknown ids at runtime", () => {
    expect(getSubpixPattern("missing" as never).id).toBe("calibration-bars");
  });
});
