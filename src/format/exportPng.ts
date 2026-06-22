import {
  getExpectedDataLength,
  getWidthSubpixels,
  type SubpixDocument,
  type SubpixOrder
} from "@/format/subpixTypes";

export function clampIntensity(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function getCompositeSubpixelIntensities(document: SubpixDocument): Uint8ClampedArray {
  const expectedLength = getExpectedDataLength(document);
  const composite = new Float32Array(expectedLength);

  for (const layer of document.layers) {
    if (!layer.visible) {
      continue;
    }

    const opacity = Math.max(0, Math.min(1, layer.opacity));
    for (let index = 0; index < expectedLength; index += 1) {
      const nextValue = clampIntensity(layer.data[index] ?? 0);
      composite[index] = composite[index] * (1 - opacity) + nextValue * opacity;
    }
  }

  return Uint8ClampedArray.from(composite, clampIntensity);
}

export function channelIndexForSlot(slot: number, order: SubpixOrder): number {
  if (order === "BGR") {
    return [2, 1, 0][slot] ?? 0;
  }

  return [0, 1, 2][slot] ?? 0;
}

export function packSubpixToRgba(document: SubpixDocument, order: SubpixOrder): Uint8ClampedArray {
  const { widthPixels, heightPixels } = document.document;
  const widthSubpixels = getWidthSubpixels(document);
  const composite = getCompositeSubpixelIntensities(document);
  const rgba = new Uint8ClampedArray(widthPixels * heightPixels * 4);

  for (let y = 0; y < heightPixels; y += 1) {
    for (let x = 0; x < widthPixels; x += 1) {
      const pixelBase = (y * widthPixels + x) * 4;
      rgba[pixelBase + 3] = 255;

      for (let slot = 0; slot < 3; slot += 1) {
        const subpixelIndex = y * widthSubpixels + x * 3 + slot;
        rgba[pixelBase + channelIndexForSlot(slot, order)] = composite[subpixelIndex] ?? 0;
      }
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
