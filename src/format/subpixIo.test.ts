import { describe, expect, it } from "vitest";
import { loadSubpix, SubpixLoadError } from "@/format/loadSubpix";
import { saveSubpix, SubpixSaveError } from "@/format/saveSubpix";
import { createSubpixDocument } from "@/format/subpixTypes";

describe("subpix load/save", () => {
  it("loads UTF-8 BOM prefixed JSON files", () => {
    const document = createSubpixDocument({ name: "BOM Fixture", widthPixels: 2, heightPixels: 1 });

    expect(loadSubpix(`\uFEFF${saveSubpix(document)}`).document.name).toBe("BOM Fixture");
  });

  it("reports empty files clearly", () => {
    expect(() => loadSubpix(" \n\t ")).toThrow(SubpixLoadError);

    try {
      loadSubpix("");
    } catch (error) {
      expect(error).toBeInstanceOf(SubpixLoadError);
      expect((error as SubpixLoadError).errors).toEqual(["File is empty."]);
    }
  });

  it("validates documents before saving", () => {
    const document = createSubpixDocument({ widthPixels: 2, heightPixels: 1 });
    document.layers[0].data.pop();

    expect(() => saveSubpix(document)).toThrow(SubpixSaveError);

    try {
      saveSubpix(document);
    } catch (error) {
      expect(error).toBeInstanceOf(SubpixSaveError);
      expect((error as SubpixSaveError).errors).toContain("layers[0].data length must be 6.");
    }
  });

  it("saves canonical documents without extra ad hoc fields", () => {
    const document = createSubpixDocument({ widthPixels: 1, heightPixels: 1 }) as ReturnType<
      typeof createSubpixDocument
    > & { scratch?: string };
    document.scratch = "not part of the file format";

    expect(JSON.parse(saveSubpix(document))).not.toHaveProperty("scratch");
  });
});
