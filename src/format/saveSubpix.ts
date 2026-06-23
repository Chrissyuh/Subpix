import type { SubpixDocument } from "@/format/subpixTypes";
import { validateSubpix } from "@/format/validateSubpix";

export class SubpixSaveError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "SubpixSaveError";
  }
}

export function saveSubpix(document: SubpixDocument): string {
  const result = validateSubpix(document);
  if (!result.ok || !result.document) {
    throw new SubpixSaveError(result.errors);
  }

  return `${JSON.stringify(result.document, null, 2)}\n`;
}
