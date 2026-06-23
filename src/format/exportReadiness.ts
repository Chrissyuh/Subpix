import { channelIndexForSlot } from "@/format/exportPng";
import {
  canUsePackedPreview,
  displayProfileToOrder,
  getRenderOrder,
  getWidthSubpixels,
  type DisplayProfileId,
  type SubpixDocument,
  type SubpixOrder
} from "@/format/subpixTypes";

export type ExportReadinessStatus = "ready" | "remapped" | "blocked";
export type ExportChannel = "R" | "G" | "B";

export interface ExportSlotMapping {
  channel: ExportChannel;
  slot: number;
}

export interface ExportReadiness {
  exportEnabled: boolean;
  message: string;
  outputByteCount: number;
  outputChannels: "RGBA";
  outputHeightPixels: number;
  outputPixelCount: number;
  outputWidthPixels: number;
  renderOrder: SubpixOrder;
  slotMappings: ExportSlotMapping[];
  status: ExportReadinessStatus;
  statusLabel: string;
  subpixelCellCount: number;
}

const CHANNELS: ExportChannel[] = ["R", "G", "B"];

function channelForSlot(slot: number, order: SubpixOrder): ExportChannel {
  return CHANNELS[channelIndexForSlot(slot, order)] ?? "R";
}

function getStatus(displayOrder: SubpixOrder | null, exportEnabled: boolean): ExportReadinessStatus {
  if (!exportEnabled) {
    return "blocked";
  }

  return displayOrder === "BGR" ? "remapped" : "ready";
}

function getStatusLabel(status: ExportReadinessStatus): string {
  if (status === "blocked") {
    return "Simulated only";
  }

  return status === "remapped" ? "BGR remap" : "Ready";
}

function getMessage(status: ExportReadinessStatus): string {
  if (status === "blocked") {
    return "PNG export is disabled for the selected display profile.";
  }

  if (status === "remapped") {
    return "Export will remap logical slots into BGR channel order.";
  }

  return "Export will pack logical slots directly into RGB channel order.";
}

export function getExportReadiness(document: SubpixDocument, displayProfile: DisplayProfileId): ExportReadiness {
  const displayOrder = displayProfileToOrder(displayProfile);
  const exportEnabled = canUsePackedPreview(document, displayProfile);
  const renderOrder = getRenderOrder(document, displayProfile);
  const outputPixelCount = document.document.widthPixels * document.document.heightPixels;
  const status = getStatus(displayOrder, exportEnabled);

  return {
    exportEnabled,
    message: getMessage(status),
    outputByteCount: outputPixelCount * 4,
    outputChannels: "RGBA",
    outputHeightPixels: document.document.heightPixels,
    outputPixelCount,
    outputWidthPixels: document.document.widthPixels,
    renderOrder,
    slotMappings: [0, 1, 2].map((slot) => ({
      channel: channelForSlot(slot, renderOrder),
      slot
    })),
    status,
    statusLabel: getStatusLabel(status),
    subpixelCellCount: getWidthSubpixels(document) * document.document.heightPixels
  };
}
