export const SUBPIX_FORMAT = "SUBPIX";
export const SUBPIX_VERSION = 1;
export const SUBPIX_EXTENSION = ".subpix";
export const SUBPIX_INTERNAL_MIME = "image/x-subpix";
export const DEFAULT_DOCUMENT_FILE_NAME = "Untitled.subpix";
export const DEFAULT_DOCUMENT_NAME = "Untitled";
export const DEFAULT_WIDTH_PIXELS = 32;
export const DEFAULT_HEIGHT_PIXELS = 32;
export const MIN_DOCUMENT_PIXELS = 1;
export const MAX_DOCUMENT_PIXELS = 512;

export type SubpixOrder = "RGB" | "BGR";
export type Tool = "brush" | "eraser";
export type DisplayProfileId = "rgb-horizontal" | "bgr-horizontal" | "incompatible";

export interface SubpixArchitecture {
  geometry: "horizontal-stripe";
  slotsPerPixel: [3, 1];
  compatibleOrders: SubpixOrder[];
  defaultOrder: SubpixOrder;
  lossyFallbackAllowed: boolean;
}

export interface SubpixLayer {
  name: string;
  visible: boolean;
  opacity: number;
  widthSubpixels: number;
  heightSubpixels: number;
  dataEncoding: "array";
  data: number[];
}

export interface SubpixDocument {
  format: typeof SUBPIX_FORMAT;
  version: typeof SUBPIX_VERSION;
  document: {
    name: string;
    widthPixels: number;
    heightPixels: number;
  };
  architecture: SubpixArchitecture;
  layers: SubpixLayer[];
}

export interface CreateSubpixDocumentOptions {
  name?: string;
  widthPixels?: number;
  heightPixels?: number;
}

export interface DisplayProfile {
  id: DisplayProfileId;
  label: string;
  order: SubpixOrder | null;
}

export const HORIZONTAL_STRIPE_ARCHITECTURE: SubpixArchitecture = {
  geometry: "horizontal-stripe",
  slotsPerPixel: [3, 1],
  compatibleOrders: ["RGB", "BGR"],
  defaultOrder: "RGB",
  lossyFallbackAllowed: false
};

export const DISPLAY_PROFILES: DisplayProfile[] = [
  { id: "rgb-horizontal", label: "RGB horizontal stripe", order: "RGB" },
  { id: "bgr-horizontal", label: "BGR horizontal stripe", order: "BGR" },
  { id: "incompatible", label: "Incompatible / simulated only", order: null }
];

export function getWidthSubpixels(document: SubpixDocument): number {
  return document.document.widthPixels * document.architecture.slotsPerPixel[0];
}

export function getHeightSubpixels(document: SubpixDocument): number {
  return document.document.heightPixels * document.architecture.slotsPerPixel[1];
}

export function getExpectedDataLength(document: SubpixDocument): number {
  return getWidthSubpixels(document) * getHeightSubpixels(document);
}

export function isSupportedDocumentDimension(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= MIN_DOCUMENT_PIXELS && Number(value) <= MAX_DOCUMENT_PIXELS;
}

export function normalizeDocumentName(name: string | undefined): string {
  const trimmedName = name?.trim() ?? "";
  return trimmedName.length > 0 ? trimmedName : DEFAULT_DOCUMENT_NAME;
}

export function createSubpixDocument(options: CreateSubpixDocumentOptions = {}): SubpixDocument {
  const widthPixels = options.widthPixels ?? DEFAULT_WIDTH_PIXELS;
  const heightPixels = options.heightPixels ?? DEFAULT_HEIGHT_PIXELS;

  if (!isSupportedDocumentDimension(widthPixels) || !isSupportedDocumentDimension(heightPixels)) {
    throw new Error(`Document dimensions must be whole pixels from ${MIN_DOCUMENT_PIXELS} to ${MAX_DOCUMENT_PIXELS}.`);
  }

  const widthSubpixels = widthPixels * HORIZONTAL_STRIPE_ARCHITECTURE.slotsPerPixel[0];
  const heightSubpixels = heightPixels * HORIZONTAL_STRIPE_ARCHITECTURE.slotsPerPixel[1];

  return {
    format: SUBPIX_FORMAT,
    version: SUBPIX_VERSION,
    document: {
      name: normalizeDocumentName(options.name),
      widthPixels,
      heightPixels
    },
    architecture: { ...HORIZONTAL_STRIPE_ARCHITECTURE },
    layers: [
      {
        name: "Layer 1",
        visible: true,
        opacity: 1,
        widthSubpixels,
        heightSubpixels,
        dataEncoding: "array",
        data: new Array(widthSubpixels * heightSubpixels).fill(0)
      }
    ]
  };
}

export function createDefaultSubpixDocument(name = DEFAULT_DOCUMENT_NAME): SubpixDocument {
  return createSubpixDocument({ name });
}

export function cloneSubpixDocument(document: SubpixDocument): SubpixDocument {
  return {
    ...document,
    document: { ...document.document },
    architecture: {
      ...document.architecture,
      slotsPerPixel: [...document.architecture.slotsPerPixel],
      compatibleOrders: [...document.architecture.compatibleOrders]
    },
    layers: document.layers.map((layer) => ({
      ...layer,
      data: [...layer.data]
    }))
  };
}

export function displayProfileToOrder(profileId: DisplayProfileId): SubpixOrder | null {
  return DISPLAY_PROFILES.find((profile) => profile.id === profileId)?.order ?? null;
}

export function getDisplayProfileLabel(profileId: DisplayProfileId): string {
  return DISPLAY_PROFILES.find((profile) => profile.id === profileId)?.label ?? "Unknown";
}

export function getCompatibilityMessage(document: SubpixDocument, profileId: DisplayProfileId): string {
  const order = displayProfileToOrder(profileId);
  const architectureName = `horizontal ${document.architecture.slotsPerPixel[0]}x${document.architecture.slotsPerPixel[1]} stripe`;

  if (order === "RGB") {
    return `This file uses ${architectureName} subpixels. Your selected display profile is RGB horizontal stripe, so PNG export is supported.`;
  }

  if (order === "BGR") {
    return `This file uses ${architectureName} subpixels. Your selected display profile is BGR horizontal stripe, so PNG export remaps the artwork.`;
  }

  return `This file requires ${architectureName} subpixels. Your selected display profile is incompatible. Use simulated preview instead.`;
}

export function canUsePackedPreview(document: SubpixDocument, profileId: DisplayProfileId): boolean {
  const order = displayProfileToOrder(profileId);
  return Boolean(order && document.architecture.compatibleOrders.includes(order));
}

export function getRenderOrder(document: SubpixDocument, profileId: DisplayProfileId): SubpixOrder {
  return displayProfileToOrder(profileId) ?? document.architecture.defaultOrder;
}
