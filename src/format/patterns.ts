import { cloneSubpixDocument, getHeightSubpixels, getWidthSubpixels, type SubpixDocument } from "@/format/subpixTypes";

export type SubpixPatternId = "calibration-bars" | "slot-sweep";

export interface SubpixPatternDefinition {
  id: SubpixPatternId;
  label: string;
  summary: string;
}

export const SUBPIX_PATTERNS: SubpixPatternDefinition[] = [
  {
    id: "calibration-bars",
    label: "Calibration bars",
    summary: "RGB slot bars with an exported-pixel checker band."
  },
  {
    id: "slot-sweep",
    label: "Slot sweep",
    summary: "Diagonal subpixel lanes with low-intensity ramp fill."
  }
];

export function getSubpixPattern(patternId: SubpixPatternId): SubpixPatternDefinition {
  return SUBPIX_PATTERNS.find((pattern) => pattern.id === patternId) ?? SUBPIX_PATTERNS[0];
}

function setLogicalPixel(
  data: number[],
  widthSubpixels: number,
  xPixel: number,
  y: number,
  values: [number, number, number]
): void {
  const baseIndex = y * widthSubpixels + xPixel * 3;
  data[baseIndex] = values[0];
  data[baseIndex + 1] = values[1];
  data[baseIndex + 2] = values[2];
}

function createCalibrationBars(document: SubpixDocument): number[] {
  const widthSubpixels = getWidthSubpixels(document);
  const heightSubpixels = getHeightSubpixels(document);
  const widthPixels = document.document.widthPixels;
  const barHeight = Math.max(1, Math.floor(heightSubpixels * 0.7));
  const data = new Array(widthSubpixels * heightSubpixels).fill(0);

  for (let y = 0; y < heightSubpixels; y += 1) {
    for (let xPixel = 0; xPixel < widthPixels; xPixel += 1) {
      if (y < barHeight) {
        const slot = Math.min(2, Math.floor((xPixel * 3) / widthPixels));
        setLogicalPixel(data, widthSubpixels, xPixel, y, [
          slot === 0 ? 255 : 0,
          slot === 1 ? 255 : 0,
          slot === 2 ? 255 : 0
        ]);
        continue;
      }

      const checkerValue = (xPixel + y) % 2 === 0 ? 255 : 0;
      setLogicalPixel(data, widthSubpixels, xPixel, y, [checkerValue, checkerValue, checkerValue]);
    }
  }

  return data;
}

function createSlotSweep(document: SubpixDocument): number[] {
  const widthSubpixels = getWidthSubpixels(document);
  const heightSubpixels = getHeightSubpixels(document);
  const widthPixels = document.document.widthPixels;
  const rampDenominator = Math.max(1, widthPixels - 1);
  const data = new Array(widthSubpixels * heightSubpixels).fill(0);

  for (let y = 0; y < heightSubpixels; y += 1) {
    for (let xPixel = 0; xPixel < widthPixels; xPixel += 1) {
      const primarySlot = (xPixel + y) % 3;
      const rampIntensity = Math.round((xPixel / rampDenominator) * 255);
      const fillIntensity = Math.floor(rampIntensity / 3);

      setLogicalPixel(data, widthSubpixels, xPixel, y, [
        primarySlot === 0 ? 255 : fillIntensity,
        primarySlot === 1 ? 255 : fillIntensity,
        primarySlot === 2 ? 255 : fillIntensity
      ]);
    }
  }

  return data;
}

export function applySubpixPattern(document: SubpixDocument, patternId: SubpixPatternId): SubpixDocument {
  const nextDocument = cloneSubpixDocument(document);
  const layer = nextDocument.layers[0];

  if (!layer) {
    return nextDocument;
  }

  layer.data = patternId === "slot-sweep" ? createSlotSweep(nextDocument) : createCalibrationBars(nextDocument);

  return nextDocument;
}
