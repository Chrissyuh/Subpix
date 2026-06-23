import {
  DISPLAY_PROFILES,
  type DisplayProfileId,
  type Tool
} from "@/format/subpixTypes";

const APP_PREFERENCES_KEY = "subpix.preferences.v1";

export const MIN_ZOOM = 3;
export const MAX_ZOOM = 40;
export const ZOOM_STEP = 2;

export interface AppPreferences {
  displayProfile: DisplayProfileId;
  ignoreColor: boolean;
  showGrid: boolean;
  showPixelBoundaries: boolean;
  tool: Tool;
  zoom: number;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  displayProfile: "rgb-horizontal",
  ignoreColor: false,
  showGrid: true,
  showPixelBoundaries: true,
  tool: "brush",
  zoom: 12
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTool(value: unknown): value is Tool {
  return (
    value === "brush" ||
    value === "eraser" ||
    value === "box-eraser" ||
    value === "line" ||
    value === "rect-outline" ||
    value === "rect-fill" ||
    value === "ellipse-outline" ||
    value === "ellipse-fill"
  );
}

function isDisplayProfileId(value: unknown): value is DisplayProfileId {
  return typeof value === "string" && DISPLAY_PROFILES.some((profile) => profile.id === value);
}

export function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value)));
}

export function sanitizeAppPreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) {
    return DEFAULT_APP_PREFERENCES;
  }

  return {
    displayProfile: isDisplayProfileId(value.displayProfile)
      ? value.displayProfile
      : DEFAULT_APP_PREFERENCES.displayProfile,
    ignoreColor: typeof value.ignoreColor === "boolean" ? value.ignoreColor : DEFAULT_APP_PREFERENCES.ignoreColor,
    showGrid: typeof value.showGrid === "boolean" ? value.showGrid : DEFAULT_APP_PREFERENCES.showGrid,
    showPixelBoundaries:
      typeof value.showPixelBoundaries === "boolean"
        ? value.showPixelBoundaries
        : DEFAULT_APP_PREFERENCES.showPixelBoundaries,
    tool: isTool(value.tool) ? value.tool : DEFAULT_APP_PREFERENCES.tool,
    zoom: typeof value.zoom === "number" && Number.isFinite(value.zoom)
      ? clampZoom(value.zoom)
      : DEFAULT_APP_PREFERENCES.zoom
  };
}

export function readAppPreferences(): AppPreferences {
  try {
    const serializedPreferences = window.localStorage.getItem(APP_PREFERENCES_KEY);
    if (!serializedPreferences) {
      return DEFAULT_APP_PREFERENCES;
    }

    return sanitizeAppPreferences(JSON.parse(serializedPreferences));
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export function writeAppPreferences(preferences: AppPreferences): void {
  try {
    window.localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(sanitizeAppPreferences(preferences)));
  } catch {
    // Storage can be unavailable in restricted browser contexts; preferences are optional.
  }
}
