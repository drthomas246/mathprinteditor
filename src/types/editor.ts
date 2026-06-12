import type { BlockType } from "./lessonPrint";

export interface BlockPreset {
  type: BlockType;
  label: string;
  description: string;
}
