export function baseNameFromPath(filePath: string | null): string {
  if (!filePath) {
    return "";
  }

  const normalized = filePath.replaceAll("\\", "/");
  const fileName = normalized.split("/").pop() ?? "Untitled";
  return fileName.replace(/\.[^/.]+$/, "");
}

export function ensureSubpixFileName(name: string): string {
  return name.toLowerCase().endsWith(".subpix") ? name : `${name}.subpix`;
}

export function ensurePngFileName(name: string): string {
  return name.toLowerCase().endsWith(".png") ? name : `${name}.png`;
}
