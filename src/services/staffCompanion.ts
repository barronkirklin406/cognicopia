/* =====================================================================
   COGNICOPIA STAFF COMPANION
   The pages a staff member keeps with a resident's activity packet, never
   mixed into it: the resident's own sheets carry a first name and no
   clinical words, and these carry the rest.

     1. Cover and session overview: the resident's alias, the date and
        time, the stage (GDS 1 to 7) and support tier, the main thing the
        packet exercises, and about how long it takes.
     2. Facilitation: four verbal cues for the support tier, validation
        in the spirit of Tom Kitwood's person-centred care (recognition,
        validation, collaboration, play), and errorless-learning steps, so
        the packet never feels like a test.
     3. If they become unsettled: what to do when someone grows restless,
        worried or distracted, including late in the day, how to orient
        them without quizzing, and calm things to offer instead.

   Pure content, built from what the caller passes in (no storage, no
   network, no clock). It never receives or prints a resident's name: the
   page says the alias. Every sentence is an invitation or a plain
   instruction, never a question with a right answer.

   Built into assets/services/staffCompanion.js (globalThis.CogniStaffCompanion)
   by scripts/build-services.mjs.
   @global CogniStaffCompanion
   ===================================================================== */

export const VERSION = "1.0.0";
export interface Activity { name: string; pillar: string; minutes: number; }
export interface PageNote { title: string; therapy: string; tip: string; answers: string; note: string; }
export interface Input { alias: string; day: string; time: string; stage: string; tier: number; activities: readonly Activity[]; avoid: readonly string[]; comforts: readonly string[]; facility: string; notes?: readonly PageNote[]; }
export interface Group { heading: string; items: string[]; }
export type PageKind = "cover" | "facilitation" | "calm" | "notes";
export interface Page { kind: PageKind; title: string; lead: string; facts: [string, string][]; groups: Group[]; foot: string; }

const clean = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const TIER_NAMES: Record<number, string> = { 1: "Full detail", 2: "Guided", 3: "Simplified" };
export const FOCUS: Record<string, string> = {
  coloring: "Visual and spatial", numbers: "Counting and sequencing", words: "Reminiscence and language",
  letters: "Reading and hand-eye work", movement: "Movement and coordination", music: "Listening and musical memory"
};

export function minutesOf(list: readonly Activity[]): number { return (list || []).reduce((n, a) => n + Math.max(0, Math.round(Number(a.minutes) || 0)), 0); }
/* The one or two areas the packet leans on most, by the minutes given to each. */
export function focusOf(list: readonly Activity[]): string {
  const by: Record<string, number> = {};
  (list || []).forEach(a => { if (FOCUS[a.pillar]) by[a.pillar] = (by[a.pillar] || 0) + Math.max(1, Math.round(Number(a.minutes) || 0)); });
  const top = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 2).map(k => FOCUS[k]);
  return top.length ? top.join(" and ") : "A mix of areas";
}
const longDay = (day: string): string => {
  const d = new Date(String(day) + "T12:00:00"); if (isNaN(d.getTime())) return clean(day, 20);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};
const clockTime = (t: string): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "")); if (!m) return clean(t, 12);
  const h = +m[1], ap = h >= 12 ? "PM" : "AM"; return ((h + 11) % 12 + 1) + ":" + m[2] + " " + ap;
};
const lateInDay = (t: string): boolean => { const m = /^(\d{1,2}):/.exec(String(t || "")); return !!m && +m[1] >= 15; };
const list = (xs: readonly string[]): string => xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

/* Verbal cues by support tier: invitations and choices, one step at a time. */
export const CUES: Record<number, string[]> = {
  1: ["“Would you like to try this one with me?”", "“Take all the time you like. There is no hurry.”", "“What does this bring to mind?” Offer it as an invitation, and let a quiet moment be."],
  2: ["“Here is a pencil. We can start right here.” Point as you say it, one step at a time.", "“Would you like the red or the blue?” Two choices at most.", "“That looks lovely. Shall we do the next one together?”"],
  3: ["“This one is for you.” Hand over the page and a bold marker, and sit beside them.", "Use short phrases and a warm tone: how you say it carries more than the words.", "Say what you see, not what you hope for: “You’re following the long curve.”"]
};
export const VALIDATION: string[] = [
  "Recognition: greet them by the name they like, and say who you are.",
  "Validation: accept what they say and how they feel. “That sounds like it meant a lot to you.” Do not correct.",
  "Collaboration: do it with them, not for them. Offer your hand over theirs only if they welcome it.",
  "Play: let it be enjoyable. A joke, a hum or a pause is part of the activity."
];
export const ERRORLESS: string[] = [
  "Set the page so every choice is a right one: put out only what you want used, and nothing that could confuse.",
  "If they hesitate, step in early and gently: do the next part with them, then hand it back.",
  "Make comments and offer choices instead of asking questions that have a right answer. Leave out any word that judges the result.",
  "Praise the effort and the colors, not the result. Stop when they stop: finishing early is a good session."
];

export function build(input: Input): Page[] {
  const alias = clean(input.alias, 40) || "Resident", tier = Math.min(3, Math.max(1, Math.round(Number(input.tier)) || 2));
  const stage = /^[1-7]$/.test(String(input.stage)) ? "GDS " + input.stage : "", acts = (input.activities || []).filter(a => a && a.name);
  const minutes = minutesOf(acts), avoid = (input.avoid || []).map(a => clean(a, 40)).filter(Boolean), comforts = (input.comforts || []).map(a => clean(a, 60)).filter(Boolean);
  const foot = (clean(input.facility, 60) ? clean(input.facility, 60) + " · " : "") + "For staff. This page holds no resident name.";
  const late = lateInDay(input.time);

  const cover: Page = { kind: "cover", title: "Session overview", lead: "Keep this with the packet. The resident’s own pages carry a first name and no clinical words; the staff pages that follow carry the rest.", foot,
    facts: [["Resident", alias], ["Date", longDay(input.day)], ["Time", clockTime(input.time)],
      ["Stage and support", (stage ? stage : "Stage not recorded") + " · Tier " + tier + " (" + TIER_NAMES[tier].toLowerCase() + ")" + (stage ? "" : ", from the profile")],
      ["Main focus", focusOf(acts)], ["About how long", minutes ? "About " + minutes + " minutes" : "Not set"]],
    groups: [{ heading: "In this packet", items: acts.length ? acts.map(a => a.name + (a.minutes ? " (about " + Math.round(a.minutes) + " minutes)" : "")) : ["No pages chosen yet."] },
      { heading: "Before you begin", items: ["Sit beside them, not across, and tell them what you are going to do together.", "Have everything on the table first, and nothing else.", late ? "It is late in the day: keep the lights even and the room quiet, and have the calming page ready." : "Choose a time when they are rested and the room is quiet."] }] };

  const facilitation: Page = { kind: "facilitation", title: "Facilitation and care tips", lead: "A few words to keep to hand. Everything here is an invitation, so the packet never feels like a test.", foot, facts: [],
    groups: [{ heading: "Four things to say (Tier " + tier + ")", items: CUES[tier].concat(["Begin where they can succeed: point to the first spot and offer the pencil."]) },
      { heading: "Person-centred care: what to bring", items: VALIDATION }, { heading: "Errorless learning: so it always goes well", items: ERRORLESS }] };

  const steer = avoid.length ? ["Steer around, for them: " + list(avoid) + ". Move gently to something else if it comes up."] : ["Their profile lists nothing to steer around."];
  const calmIdeas = ["One bold picture to color, with the marker in their hand.", "A slow line to trace, at their pace.", "Something soft to hold, or a warm drink if they would like one."];
  if (comforts.length) calmIdeas.unshift("From their profile: " + list(comforts.slice(0, 4)) + ".");
  const calm: Page = { kind: "calm", title: "If they become unsettled", lead: "Restless, worried or distracted is how someone says something is not right yet: it is not bad behavior. Slow down and look for the cause.", foot, facts: [],
    groups: [{ heading: "First, slow everything down", items: ["Stop asking. Lower your voice and speak slowly.", "Sit beside them at eye level, not standing over them.", "Let a silence be. Your calm helps theirs."] },
      { heading: "Ease what is around them", items: ["Turn off the television or radio, and soften glare and noise.", "Move to a quieter corner or by a window if they are willing.", "Look for a need: thirsty, hungry, the bathroom, pain, too warm or cold, or tired."] },
      { heading: "Orient without testing", items: ["Say it for them: “I’m with you. It’s " + (late ? "evening" : "daytime") + ", and you’re safe here.”", "Keep to the same face, the same words and the same place."] },
      { heading: late || tier === 3 ? "Late in the day, and at the most supported tier" : "If it is late in the day", items: ["Even, warm lighting before dusk, and no new activities after supper.", "Keep to their usual routine. Offer calm, low-stimulation things from the next list."] },
      { heading: "Calm things to offer", items: calmIdeas }, { heading: "For this resident", items: steer },
      { heading: "Afterward", items: ["Write what helped on the Shift board, so the next shift can use it.", "If anyone may be unsafe, follow your facility’s protocol and call the nurse."] }] };
  const out: Page[] = [cover, facilitation, calm];
  /* what is for staff on each of the resident's pages (the therapy and stage line, the clinical tip, the answers, a note), kept here instead of on the page */
  const notes = (input.notes || []).filter(n => n && (n.therapy || n.tip || n.answers || n.note));
  for (let i = 0; i < notes.length && out.length < 7; i += 4) {
    out.push({ kind: "notes", title: "Notes for each page" + (notes.length > 4 ? " (" + (i / 4 + 1) + ")" : ""), lead: "What is for staff on the resident’s pages. Their own pages carry none of it.", foot, facts: [],
      groups: notes.slice(i, i + 4).map((n, k) => ({ heading: (i + k + 1) + ". " + clean(n.title, 60), items: [n.therapy ? "Approach: " + clean(n.therapy, 120) : "", n.tip ? clean(n.tip, 220) : "", n.answers ? "Answers: " + clean(n.answers, 200) : "", n.note ? "Note: " + clean(n.note, 200) : ""].filter(Boolean) })) });
  }
  return out;
}

/* Every sentence on the pages, for a dignity check. */
export function sentences(pages: readonly Page[]): string[] {
  const out: string[] = [];
  pages.forEach(p => { out.push(p.title, p.lead); p.groups.forEach(g => { out.push(g.heading); g.items.forEach(i => out.push(i)); }); });
  return out;
}
