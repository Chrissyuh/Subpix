import type { SubpixDocument } from "@/format/subpixTypes";

export function saveSubpix(document: SubpixDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

