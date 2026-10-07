import type { DementiaStage } from "@/lib/db/models";

/**
 * The three stages staff plan for, and how each maps to the planner's acuity tiers
 * (1 Mild Support, 2 Moderate Engagement, 3 Advanced Sensory: src/services/facilityPlanner.ts).
 * "Universal" is not a stage someone is in: it marks an activity that suits any of them.
 */
export const TRACK_STAGES = ["early", "middle", "late"] as const;
export type TrackStage = (typeof TRACK_STAGES)[number];

export interface StageInfo {
  id: TrackStage;
  label: string;
  acuity: 1 | 2 | 3;
  /** One plain sentence on what the stage means for planning. */
  blurb: string;
}

export const STAGES: readonly StageInfo[] = [
  { id: "early", label: "Early stage", acuity: 1, blurb: "Mostly independent. Enjoys challenge, choice and doing things for others." },
  { id: "middle", label: "Middle stage", acuity: 2, blurb: "Needs cues and simpler steps. Does best with one instruction at a time and familiar, hands-on tasks." },
  { id: "late", label: "Late stage", acuity: 3, blurb: "Responds to the senses: touch, music, scent, faces and voices. Short, calm, no wrong answers." },
];

export const isTrackStage = (value: unknown): value is TrackStage => (TRACK_STAGES as readonly unknown[]).includes(value);

export function stageLabel(stage: DementiaStage): string {
  return stage === "universal" ? "Any stage" : (STAGES.find((s) => s.id === stage)?.label ?? stage);
}

/** An item suits a stage when it is made for it, or for any stage. */
export const suitsStage = (itemStage: DementiaStage, wanted: TrackStage): boolean => itemStage === wanted || itemStage === "universal";

/**
 * The stage a calendar group is for. The generator names its groups for the stage ("early"), and a
 * group made some other way is read by its acuity tier (1 Mild Support, 2 Moderate Engagement,
 * 3 Advanced Sensory). A group that is neither, such as a universal group, has no stage: null.
 */
export function trackOf(group: { id: string; acuity: number }): TrackStage | null {
  if (isTrackStage(group.id)) return group.id;
  return STAGES.find((s) => s.acuity === group.acuity)?.id ?? null;
}
