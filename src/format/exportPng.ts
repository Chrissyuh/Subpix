import {
  getExpectedDataLength,
  getWidthSubpixels,
  type SubpixDocument,
  type SubpixOrder
} from "@/format/subpixTypes";

export function clampIntensity(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampOpacity(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getCompositeSubpixelIntensities(document: SubpixDocument): Uint8ClampedArray {
  const expectedLength = getExpectedDataLength(document);
  const composite = new Float32Array(expectedLength);

  for (const layer of document.layers) {
    if (!layer.visible) {
      continue;
    }

    const opacity = clampOpacity(layer.opacity);
    if (opacity === 0) {
      continue;
    }

    if (opacity === 1) {
      for (let index = 0; index < expectedLength; index += 1) {
        composite[index] = clampIntensity(layer.data[index] ?? 0);
      }
      continue;
    }

    for (let index = 0; index < expectedLength; index += 1) {
      const nextValue = clampIntensity(layer.data[index] ?? 0);
      composite[index] = composite[index] * (1 - opacity) + nextValue * opacity;
    }
  }

  const output = new Uint8ClampedArray(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    output[index] = clampIntensity(composite[index]);
  }

  return output;
}

export function channelIndexForSlot(slot: number, order: SubpixOrder): number {
  if (order === "BGR") {
    return slot === 0 ? 2 : slot === 1 ? 1 : 0;
  }

  return slot === 0 ? 0 : slot === 1 ? 1 : 2;
}

export function packSubpixToRgba(document: SubpixDocument, order: SubpixOrder): Uint8ClampedArray {
  const { widthPixels, heightPixels } = document.document;
  const widthSubpixels = getWidthSubpixels(document);
  const composite = getCompositeSubpixelIntensities(document);
  const rgba = new Uint8ClampedArray(widthPixels * heightPixels * 4);
  const slot0Channel = channelIndexForSlot(0, order);
  const slot1Channel = channelIndexForSlot(1, order);
  const slot2Channel = channelIndexForSlot(2, order);

  for (let y = 0; y < heightPixels; y += 1) {
    const subpixelRow = y * widthSubpixels;
    const pixelRow = y * widthPixels;
    for (let x = 0; x < widthPixels; x += 1) {
      const pixelBase = (pixelRow + x) * 4;
      const subpixelBase = subpixelRow + x * 3;
      rgba[pixelBase + slot0Channel] = composite[subpixelBase] ?? 0;
      rgba[pixelBase + slot1Channel] = composite[subpixelBase + 1] ?? 0;
      rgba[pixelBase + slot2Channel] = composite[subpixelBase + 2] ?? 0;
      rgba[pixelBase + 3] = 255;
    }
  }

  return rgba;
}

export async function createPackedPngBytes(document: SubpixDocument, order: SubpixOrder): Promise<number[]> {
  const canvas = window.document.createElement("canvas");
  canvas.width = document.document.widthPixels;
  canvas.height = document.document.heightPixels;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a canvas context for PNG export.");
  }

  const rgba = packSubpixToRgba(document, order);
  const imageDataArray: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(new ArrayBuffer(rgba.length));
  imageDataArray.set(rgba);
  const imageData = new ImageData(imageDataArray, document.document.widthPixels, document.document.heightPixels);
  context.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
      } else {
        reject(new Error("Could not encode PNG data."));
      }
    }, "image/png");
  });

  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
