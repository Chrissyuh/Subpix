import { validateSubpix } from "@/format/validateSubpix";
import type { SubpixDocument } from "@/format/subpixTypes";

export class SubpixLoadError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "SubpixLoadError";
  }
}

export function loadSubpix(serialized: string): SubpixDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new SubpixLoadError([`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
  }

  const result = validateSubpix(parsed);
  if (!result.ok || !result.document) {
    throw new SubpixLoadError(result.errors);
  }

  return result.document;
}

