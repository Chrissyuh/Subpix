import { channelIndexForSlot, getCompositeSubpixelIntensities } from "@/format/exportPng";
import {
  getExpectedDataLength,
  getHeightSubpixels,
  getWidthSubpixels,
  type SubpixDocument,
  type SubpixOrder
} from "@/format/subpixTypes";

const CHANNEL_LABELS = ["R", "G", "B"] as const;

export interface SlotActivity {
  activeCells: number;
  averageIntensity: number;
  channel: "R" | "G" | "B";
  coverage: number;
  maxIntensity: number;
  normalizedIntensity: number;
  slot: 0 | 1 | 2;
  totalCells: number;
  totalIntensity: number;
}

export interface SubpixDocumentStats {
  activeCells: number;
  coverage: number;
  heightSubpixels: number;
  slotActivities: SlotActivity[];
  totalCells: number;
  widthSubpixels: number;
}

export function channelLabelForSlot(slot: number, order: SubpixOrder): "R" | "G" | "B" {
  return CHANNEL_LABELS[channelIndexForSlot(slot, order)] ?? "R";
}

export function getSubpixDocumentStats(document: SubpixDocument, order: SubpixOrder): SubpixDocumentStats {
  const widthSubpixels = getWidthSubpixels(document);
  const heightSubpixels = getHeightSubpixels(document);
  const totalCells = getExpectedDataLength(document);
  const composite = getCompositeSubpixelIntensities(document);
  const slotCells = document.document.widthPixels * document.document.heightPixels;
  const slotActivities: SlotActivity[] = [0, 1, 2].map((slot) => ({
    activeCells: 0,
    averageIntensity: 0,
    channel: channelLabelForSlot(slot, order),
    coverage: 0,
    maxIntensity: 0,
    normalizedIntensity: 0,
    slot: slot as 0 | 1 | 2,
    totalCells: slotCells,
    totalIntensity: 0
  }));

  let activeCells = 0;

  for (let index = 0; index < totalCells; index += 1) {
    const intensity = composite[index] ?? 0;
    const x = index % widthSubpixels;
    const slot = x % 3;
    const activity = slotActivities[slot];

    activity.totalIntensity += intensity;
    activity.maxIntensity = Math.max(activity.maxIntensity, intensity);

    if (intensity > 0) {
      activeCells += 1;
      activity.activeCells += 1;
    }
  }

  for (const activity of slotActivities) {
    activity.averageIntensity = activity.totalCells > 0 ? activity.totalIntensity / activity.totalCells : 0;
    activity.coverage = activity.totalCells > 0 ? (activity.activeCells / activity.totalCells) * 100 : 0;
    activity.normalizedIntensity =
      activity.totalCells > 0 ? activity.totalIntensity / (activity.totalCells * 255) : 0;
  }

  return {
    activeCells,
    coverage: totalCells > 0 ? (activeCells / totalCells) * 100 : 0,
    heightSubpixels,
    slotActivities,
    totalCells,
    widthSubpixels
  };
}
