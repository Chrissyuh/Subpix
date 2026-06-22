import { describe, expect, it } from "vitest";
import { getExportReadiness } from "@/format/exportReadiness";
import { createSubpixDocument } from "@/format/subpixTypes";

describe("export readiness", () => {
  it("reports RGB profiles as directly exportable", () => {
    const document = createSubpixDocument({ widthPixels: 4, heightPixels: 2 });
    const readiness = getExportReadiness(document, "rgb-horizontal");

    expect(readiness).toEqual(
      expect.objectContaining({
        exportEnabled: true,
        outputByteCount: 32,
        outputChannels: "RGBA",
        outputHeightPixels: 2,
        outputPixelCount: 8,
        outputWidthPixels: 4,
        renderOrder: "RGB",
        status: "ready",
        statusLabel: "Ready",
        subpixelCellCount: 24
      })
    );
    expect(readiness.slotMappings).toEqual([
      { channel: "R", slot: 0 },
      { channel: "G", slot: 1 },
      { channel: "B", slot: 2 }
    ]);
  });

  it("reports BGR profiles as exportable with slot remapping", () => {
    const document = createSubpixDocument({ widthPixels: 2, heightPixels: 1 });
    const readiness = getExportReadiness(document, "bgr-horizontal");

    expect(readiness.exportEnabled).toBe(true);
    expect(readiness.renderOrder).toBe("BGR");
    expect(readiness.status).toBe("remapped");
    expect(readiness.slotMappings).toEqual([
      { channel: "B", slot: 0 },
      { channel: "G", slot: 1 },
      { channel: "R", slot: 2 }
    ]);
  });

  it("blocks packed export for incompatible display profiles", () => {
    const readiness = getExportReadiness(createSubpixDocument({ widthPixels: 2, heightPixels: 2 }), "incompatible");

    expect(readiness.exportEnabled).toBe(false);
    expect(readiness.renderOrder).toBe("RGB");
    expect(readiness.status).toBe("blocked");
    expect(readiness.statusLabel).toBe("Simulated only");
    expect(readiness.message).toContain("disabled");
  });
});
