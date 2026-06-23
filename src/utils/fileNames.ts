import { DEFAULT_DOCUMENT_FILE_NAME, DEFAULT_DOCUMENT_NAME, SUBPIX_EXTENSION } from "@/format/subpixTypes";

export function baseNameFromPath(filePath: string | null): string {
  if (!filePath) {
    return "";
  }

  const normalized = filePath.replaceAll("\\", "/");
  const fileName = normalized.split("/").pop() ?? "Untitled";
  return fileName.replace(/\.[^/.]+$/, "");
}

function normalizeFileNameCandidate(name: string, fallbackName: string): string {
  const trimmedName = name.trim();
  return trimmedName.length > 0 ? trimmedName : fallbackName;
}

export function ensureSubpixFileName(name: string): string {
  const fileName = normalizeFileNameCandidate(name, DEFAULT_DOCUMENT_FILE_NAME);
  return fileName.toLowerCase().endsWith(SUBPIX_EXTENSION) ? fileName : `${fileName}${SUBPIX_EXTENSION}`;
}

export function ensurePngFileName(name: string): string {
  const fileName = normalizeFileNameCandidate(name, DEFAULT_DOCUMENT_NAME);
  return fileName.toLowerCase().endsWith(".png") ? fileName : `${fileName}.png`;
}
