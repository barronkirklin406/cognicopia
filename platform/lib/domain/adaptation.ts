import type { ActivityFormat } from "./formats";
import { STAGES, type TrackStage } from "./stages";

/**
 * The adaptation engine: how to run the same activity for a different stage of dementia.
 *
 * These are practice suggestions drawn from widely used person-centred approaches to
 * dementia activity (offer choices early; one step at a time in the middle; lead with the
 * senses and expect no performance late). They are not clinical prescriptions: staff know
 * the people in front of them, and a care plan comes first.
 *
 * Wording follows the rest of Cognicopia: dignity first, adult in tone, never a quiz.
 */

export interface StageGuide {
  stage: TrackStage;
  headline: string;
  /** Minutes an activity usually holds attention, as a range. */
  minutes: readonly [number, number];
  groupSize: string;
  cueing: string;
  pace: string;
}

export const STAGE_GUIDES: Record<TrackStage, StageGuide> = {
  early: {
    stage: "early",
    headline: "Keep it adult, open and a little challenging",
    minutes: [20, 45],
    groupSize: "Groups of 6 to 10 work well; small teams for games.",
    cueing: "Give the whole instruction at once, and in writing too. Offer choices, and let people lead.",
    pace: "Let people set the pace. Ask for opinions and stories rather than right answers.",
  },
  middle: {
    stage: "middle",
    headline: "One step at a time, with something to see and hold",
    minutes: [15, 30],
    groupSize: "Groups of 4 to 8, seated so everyone can see the leader's face.",
    cueing: "Give one instruction at a time, shown as well as said. Hand over the first piece rather than describing it.",
    pace: "Slow and steady. Repeat kindly without correcting, and praise effort.",
  },
  late: {
    stage: "late",
    headline: "Lead with the senses; there are no wrong answers",
    minutes: [10, 20],
    groupSize: "One to one, or two to four people, with a rest in the middle.",
    cueing: "Few words in a calm voice, face to face. Show the object, put it in a hand, and let people respond in their own way.",
    pace: "Unhurried. A smile, a hum or a held hand is a full answer.",
  },
};

/** Two suggestions for each kind of activity at each stage. */
const FORMAT_TIPS: Record<ActivityFormat, Record<TrackStage, readonly [string, string]>> = {
  reminiscence: {
    early: ["Ask open questions such as \"What was it like?\" and let the stories wander.", "Invite people to bring a photograph or an object from their own life."],
    middle: ["Use one prompt, then a choice: \"Was it more this or that?\"", "Bring a real object or a song from the time to hold the thread."],
    late: ["Skip the questions: make a warm comment and wait.", "Use a scent, a fabric or a tune from the time, and watch for a smile or a hum."],
  },
  games: {
    early: ["Add a second round, or a friendly timer, for those who like it.", "Let a participant read the rules aloud."],
    middle: ["Cut it to one rule and four to six pieces; show it once.", "Keep score loosely, or not at all."],
    late: ["Choose a hands-on version with no rules: sorting, stacking or matching large pieces.", "Sit beside the person and take the first turn together."],
  },
  trivia: {
    early: ["Mix easy and harder questions, and accept \"close enough\".", "Ask \"What made you think of that?\" after an answer."],
    middle: ["Offer two choices for every question.", "Read each question slowly, twice, and celebrate every answer."],
    late: ["Turn it into finish-the-line: say the start of a familiar saying or lyric and let them join in.", "Keep it to two or three, and stop on a success."],
  },
  printable: {
    early: ["Offer the standard sheet and a harder one, and let people choose.", "Use a thick pen and set the sheet at a comfortable angle."],
    middle: ["Give one sheet at a time, started for them: the first answer or color already in.", "Use a thick marker or crayon, and clear everything else from the table."],
    late: ["Choose tracing or large coloring; guide a hand only if invited.", "Praise the doing, not the result, and never ask what it is."],
  },
  active: {
    early: ["Add a pattern or a second task, such as clapping and counting.", "Let a participant lead a round."],
    middle: ["Face the group and mirror: one movement at a time, to music they know.", "Keep to a steady, predictable pattern."],
    late: ["Keep it seated, slow and gentle, and mirror their movements back to them.", "Music from their young years often brings people in."],
  },
  sensory: {
    early: ["Invite people to describe what they feel, smell or hear, and what it brings to mind.", "Let those who wish prepare the materials."],
    middle: ["Offer one sense at a time, with a pause between.", "Name the object simply and let people take it from there."],
    late: ["Offer one sensation and give it time; watch the face for comfort or discomfort.", "Stop at the first sign of distress, and keep the same few favorites to hand."],
  },
};

/** A one-line cue short enough for a calendar's note (140 characters at most). */
export function quickTip(format: ActivityFormat, stage: TrackStage): string {
  return FORMAT_TIPS[format][stage][0].slice(0, 140);
}

export interface Adaptation {
  stage: TrackStage;
  stageLabel: string;
  headline: string;
  /** The activity's usual length, brought into the range that suits the stage. */
  minutes: number;
  groupSize: string;
  tips: string[];
}

const clamp = (value: number, [low, high]: readonly [number, number]): number => Math.min(Math.max(value, low), high);

/** How to run this activity for this stage: length, group size, and what to do differently. */
export function adaptActivity(item: { minutes?: number; formats: readonly ActivityFormat[] }, stage: TrackStage): Adaptation {
  const guide = STAGE_GUIDES[stage];
  const tips = [guide.cueing, ...item.formats.slice(0, 2).flatMap((format) => FORMAT_TIPS[format][stage]), guide.pace];
  return {
    stage,
    stageLabel: STAGES.find((s) => s.id === stage)?.label ?? stage,
    headline: guide.headline,
    minutes: clamp(item.minutes ?? guide.minutes[0], guide.minutes),
    groupSize: guide.groupSize,
    tips: [...new Set(tips)],
  };
}
