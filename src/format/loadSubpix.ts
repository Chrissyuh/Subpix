import { validateSubpix } from "@/format/validateSubpix";
import type { SubpixDocument } from "@/format/subpixTypes";

export class SubpixLoadError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "SubpixLoadError";
  }
}

function normalizeSerializedSubpix(serialized: string): string {
  return serialized.replace(/^\uFEFF/, "");
}

export function loadSubpix(serialized: string): SubpixDocument {
  let parsed: unknown;
  const content = normalizeSerializedSubpix(serialized);

  if (content.trim().length === 0) {
    throw new SubpixLoadError(["File is empty."]);
  }

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new SubpixLoadError([`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
  }

  const result = validateSubpix(parsed);
  if (!result.ok || !result.document) {
    throw new SubpixLoadError(result.errors);
  }

  return result.document;
}
