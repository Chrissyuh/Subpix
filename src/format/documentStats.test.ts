import { describe, expect, it } from "vitest";
import { getSubpixDocumentStats } from "@/format/documentStats";
import { packSubpixToRgba } from "@/format/exportPng";
import { createSubpixDocument } from "@/format/subpixTypes";
import { validateSubpix } from "@/format/validateSubpix";

function createFixtureDocument() {
  const document = createSubpixDocument({ name: "Stats Fixture", widthPixels: 2, heightPixels: 1 });
  document.layers[0].data = [255, 0, 128, 0, 64, 255];
  return document;
}

describe("subpixel document stats", () => {
  it("summarizes active cells and per-slot intensity", () => {
    const stats = getSubpixDocumentStats(createFixtureDocument(), "RGB");

    expect(stats.totalCells).toBe(6);
    expect(stats.activeCells).toBe(4);
    expect(stats.coverage).toBeCloseTo(66.666, 2);
    expect(stats.slotActivities).toEqual([
      expect.objectContaining({
        activeCells: 1,
        averageIntensity: 127.5,
        channel: "R",
        maxIntensity: 255,
        slot: 0,
        totalIntensity: 255
      }),
      expect.objectContaining({
        activeCells: 1,
        averageIntensity: 32,
        channel: "G",
        maxIntensity: 64,
        slot: 1,
        totalIntensity: 64
      }),
      expect.objectContaining({
        activeCells: 2,
        averageIntensity: 191.5,
        channel: "B",
        maxIntensity: 255,
        slot: 2,
        totalIntensity: 383
      })
    ]);
  });

  it("remaps slot labels for BGR display order", () => {
    const stats = getSubpixDocumentStats(createFixtureDocument(), "BGR");

    expect(stats.slotActivities.map((activity) => activity.channel)).toEqual(["B", "G", "R"]);
  });
});

describe("packed PNG channel mapping", () => {
  it("packs logical slots into RGB pixels", () => {
    expect(Array.from(packSubpixToRgba(createFixtureDocument(), "RGB"))).toEqual([
      255, 0, 128, 255,
      0, 64, 255, 255
    ]);
  });

  it("packs logical slots into BGR-remapped RGB pixels", () => {
    expect(Array.from(packSubpixToRgba(createFixtureDocument(), "BGR"))).toEqual([
      128, 0, 255, 255,
      255, 64, 0, 255
    ]);
  });
});

describe("subpix validation", () => {
  it("rejects unsupported document dimensions", () => {
    const invalidDocument = createSubpixDocument({ widthPixels: 2, heightPixels: 1 });
    invalidDocument.document.widthPixels = 0;

    const result = validateSubpix(invalidDocument);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("document.widthPixels must be a whole number from 1 to 512.");
  });

  it("rejects a default order that is not in the compatible order list", () => {
    const invalidDocument = createSubpixDocument({ widthPixels: 2, heightPixels: 1 });
    invalidDocument.architecture.compatibleOrders = ["RGB"];
    invalidDocument.architecture.defaultOrder = "BGR";

    const result = validateSubpix(invalidDocument);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("architecture.defaultOrder must be included in architecture.compatibleOrders.");
  });
});
