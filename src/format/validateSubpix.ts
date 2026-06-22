import {
  SUBPIX_FORMAT,
  SUBPIX_VERSION,
  type SubpixArchitecture,
  type SubpixDocument,
  type SubpixLayer,
  type SubpixOrder
} from "@/format/subpixTypes";

export interface ValidationResult {
  ok: boolean;
  document?: SubpixDocument;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isOrder(value: unknown): value is SubpixOrder {
  return value === "RGB" || value === "BGR";
}

function validateArchitecture(value: unknown, errors: string[]): SubpixArchitecture | null {
  if (!isRecord(value)) {
    errors.push("architecture must be an object.");
    return null;
  }

  const slotsPerPixel = value.slotsPerPixel;
  const compatibleOrders = value.compatibleOrders;

  if (value.geometry !== "horizontal-stripe") {
    errors.push('architecture.geometry must be "horizontal-stripe".');
  }

  if (
    !Array.isArray(slotsPerPixel) ||
    slotsPerPixel.length !== 2 ||
    slotsPerPixel[0] !== 3 ||
    slotsPerPixel[1] !== 1
  ) {
    errors.push("architecture.slotsPerPixel must be [3, 1].");
  }

  if (!Array.isArray(compatibleOrders) || compatibleOrders.some((order) => !isOrder(order))) {
    errors.push('architecture.compatibleOrders must contain only "RGB" and/or "BGR".');
  }

  if (!isOrder(value.defaultOrder)) {
    errors.push('architecture.defaultOrder must be "RGB" or "BGR".');
  }

  if (typeof value.lossyFallbackAllowed !== "boolean") {
    errors.push("architecture.lossyFallbackAllowed must be a boolean.");
  }

  if (errors.length > 0) {
    return null;
  }

  return {
    geometry: "horizontal-stripe",
    slotsPerPixel: [3, 1],
    compatibleOrders: compatibleOrders as SubpixOrder[],
    defaultOrder: value.defaultOrder as SubpixOrder,
    lossyFallbackAllowed: value.lossyFallbackAllowed as boolean
  };
}

function validateLayer(
  value: unknown,
  index: number,
  widthSubpixels: number,
  heightSubpixels: number,
  errors: string[]
): SubpixLayer | null {
  if (!isRecord(value)) {
    errors.push(`layers[${index}] must be an object.`);
    return null;
  }

  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    errors.push(`layers[${index}].name must be a non-empty string.`);
  }

  if (typeof value.visible !== "boolean") {
    errors.push(`layers[${index}].visible must be a boolean.`);
  }

  if (typeof value.opacity !== "number" || value.opacity < 0 || value.opacity > 1) {
    errors.push(`layers[${index}].opacity must be a number from 0 to 1.`);
  }

  if (value.widthSubpixels !== widthSubpixels) {
    errors.push(`layers[${index}].widthSubpixels must be ${widthSubpixels}.`);
  }

  if (value.heightSubpixels !== heightSubpixels) {
    errors.push(`layers[${index}].heightSubpixels must be ${heightSubpixels}.`);
  }

  if (value.dataEncoding !== "array") {
    errors.push(`layers[${index}].dataEncoding must be "array".`);
  }

  if (!Array.isArray(value.data)) {
    errors.push(`layers[${index}].data must be an array.`);
  } else {
    const expectedLength = widthSubpixels * heightSubpixels;
    if (value.data.length !== expectedLength) {
      errors.push(`layers[${index}].data length must be ${expectedLength}.`);
    }

    const badValueIndex = value.data.findIndex(
      (cell) => !Number.isInteger(cell) || Number(cell) < 0 || Number(cell) > 255
    );
    if (badValueIndex !== -1) {
      errors.push(`layers[${index}].data[${badValueIndex}] must be an integer from 0 to 255.`);
    }
  }

  if (errors.length > 0) {
    return null;
  }

  return {
    name: value.name as string,
    visible: value.visible as boolean,
    opacity: value.opacity as number,
    widthSubpixels,
    heightSubpixels,
    dataEncoding: "array",
    data: [...(value.data as number[])]
  };
}

export function validateSubpix(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ["File must contain a JSON object."] };
  }

  if (input.format !== SUBPIX_FORMAT) {
    errors.push('format must be "SUBPIX".');
  }

  if (input.version !== SUBPIX_VERSION) {
    errors.push(`version must be ${SUBPIX_VERSION}.`);
  }

  const documentMeta = input.document;
  if (!isRecord(documentMeta)) {
    errors.push("document must be an object.");
  }

  const name = isRecord(documentMeta) && typeof documentMeta.name === "string" ? documentMeta.name : "";
  const widthPixels = isRecord(documentMeta) ? documentMeta.widthPixels : undefined;
  const heightPixels = isRecord(documentMeta) ? documentMeta.heightPixels : undefined;

  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push("document.name must be a non-empty string.");
  }

  if (!isPositiveInteger(widthPixels)) {
    errors.push("document.widthPixels must be a positive integer.");
  }

  if (!isPositiveInteger(heightPixels)) {
    errors.push("document.heightPixels must be a positive integer.");
  }

  const architectureErrors: string[] = [];
  const architecture = validateArchitecture(input.architecture, architectureErrors);
  errors.push(...architectureErrors);

  const widthSubpixels = isPositiveInteger(widthPixels) ? widthPixels * 3 : 0;
  const heightSubpixels = isPositiveInteger(heightPixels) ? heightPixels : 0;

  if (!Array.isArray(input.layers) || input.layers.length === 0) {
    errors.push("layers must be a non-empty array.");
  }

  const layerErrors: string[] = [];
  const layers =
    Array.isArray(input.layers) && widthSubpixels > 0 && heightSubpixels > 0
      ? input.layers
          .map((layer, index) => validateLayer(layer, index, widthSubpixels, heightSubpixels, layerErrors))
          .filter((layer): layer is SubpixLayer => Boolean(layer))
      : [];
  errors.push(...layerErrors);

  if (errors.length > 0 || !architecture || !isPositiveInteger(widthPixels) || !isPositiveInteger(heightPixels)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    document: {
      format: SUBPIX_FORMAT,
      version: SUBPIX_VERSION,
      document: {
        name,
        widthPixels,
        heightPixels
      },
      architecture,
      layers
    }
  };
}

