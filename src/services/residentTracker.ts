/* =====================================================================
   COGNICOPIA RESIDENT TRACKING RECORD
   One small record for each saved resident, kept in this browser only,
   that the Roster, the staff pages and the Shift board all read:

     - the care team's stage for them (GDS 1 to 7), with the date it was set;
     - today's schedule: morning, afternoon and evening, each still to do,
       packet made, done, or "chose another time";
     - what they took part in and how they were (the same four ways of
       taking part and the same moods as the Shift board), the last 90 days;
     - the packets made for them, by day and part of the day.

   From the record it can SUGGEST a support tier. A suggestion is for the
   care team to read and accept or ignore; nothing here assesses anyone,
   and nothing changes a resident's tier by itself. A mood is what staff
   saw, never a finding.

   Notes keep names out: the record already belongs to one resident, so a
   note that names them (or anyone) is refused and says why.

   This service holds and checks the record; it stores nothing itself.
   The Packet Builder writes it into the encrypted store (secureStore.ts)
   under STORE_PREFIX, next to the resident's profile.

   Built into assets/services/residentTracker.js (globalThis.CogniTracker)
   by scripts/build-services.mjs.
   @global CogniTracker
   ===================================================================== */

export const VERSION = "1.0.0";
export const SCHEMA = "cognicopia.residentTrack";
export const STORE_PREFIX = "cognicopia_track_";
export const LIMITS = { LOG_MAX: 400, PACKETS_MAX: 200, KEEP_DAYS: 90, ACTIVITY_CHARS: 60, NOTE_CHARS: 160, SLOT_TEXT_CHARS: 60 } as const;

export type Tier = 1 | 2 | 3;
export type Stage = "" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
/* The mapping the clinical matrix already uses: GDS 3 to 4 is Tier 1, 5 is Tier 2, 6 to 7 is Tier 3 (1 and 2 read as Tier 1). */
export const STAGES: readonly { code: Exclude<Stage, "">; label: string; tier: Tier }[] = [
  { code: "1", label: "GDS 1", tier: 1 }, { code: "2", label: "GDS 2", tier: 1 }, { code: "3", label: "GDS 3", tier: 1 }, { code: "4", label: "GDS 4", tier: 1 },
  { code: "5", label: "GDS 5", tier: 2 }, { code: "6", label: "GDS 6", tier: 3 }, { code: "7", label: "GDS 7", tier: 3 }
];
export const isStage = (v: unknown): v is Exclude<Stage, ""> => STAGES.some(s => s.code === v);
export const tierOfStage = (s: unknown): Tier | 0 => { const f = STAGES.filter(x => x.code === s)[0]; return f ? f.tier : 0; };
export const stageLabel = (s: unknown): string => { const f = STAGES.filter(x => x.code === s)[0]; return f ? f.label : "Not recorded"; };

export type SlotId = "morning" | "afternoon" | "evening";
export const SLOTS: readonly { id: SlotId; label: string }[] = [{ id: "morning", label: "Morning" }, { id: "afternoon", label: "Afternoon" }, { id: "evening", label: "Evening" }];
export type SlotState = "open" | "ready" | "done" | "skipped";
export const SLOT_STATES: readonly { id: SlotState; label: string }[] = [
  { id: "open", label: "Still to do" }, { id: "ready", label: "Packet made" }, { id: "done", label: "Done" }, { id: "skipped", label: "Chose another time" }
];
export const isSlot = (v: unknown): v is SlotId => v === "morning" || v === "afternoon" || v === "evening";
export const isSlotState = (v: unknown): v is SlotState => SLOT_STATES.some(s => s.id === v);

/* The same words as the Shift board (dailyOps.ts). */
export type Participation = "declined" | "watched" | "joined" | "engaged";
export const PARTICIPATION: readonly { id: Participation; label: string; level: number }[] = [
  { id: "declined", label: "Chose another time", level: 0 }, { id: "watched", label: "Watched or listened", level: 1 },
  { id: "joined", label: "Joined in", level: 2 }, { id: "engaged", label: "Fully engaged", level: 3 }
];
export type Mood = "happy" | "content" | "calm" | "tired" | "restless" | "anxious" | "sad" | "distracted" | "overstimulated";
export const MOODS: readonly { id: Mood; label: string; flag: boolean }[] = [
  { id: "happy", label: "Happy", flag: false }, { id: "content", label: "Content", flag: false }, { id: "calm", label: "Calm", flag: false },
  { id: "tired", label: "Tired", flag: false }, { id: "restless", label: "Restless", flag: true }, { id: "anxious", label: "Anxious or upset", flag: true },
  { id: "sad", label: "Sad or tearful", flag: true }, { id: "distracted", label: "Distracted", flag: true }, { id: "overstimulated", label: "Overstimulated", flag: true }
];
export const isParticipation = (v: unknown): v is Participation => PARTICIPATION.some(p => p.id === v);
export const isMood = (v: unknown): v is Mood => MOODS.some(m => m.id === v);
export const participationLabel = (v: string): string => (PARTICIPATION.filter(p => p.id === v)[0] || PARTICIPATION[2]).label;
export const moodLabel = (v: string): string => (MOODS.filter(m => m.id === v)[0] || { label: "" }).label;

export type Pillar = "coloring" | "numbers" | "words" | "letters" | "movement" | "music";
export const PILLARS: readonly { id: Pillar; label: string }[] = [
  { id: "coloring", label: "Coloring" }, { id: "numbers", label: "Numbers" }, { id: "words", label: "Words" },
  { id: "letters", label: "Letters" }, { id: "movement", label: "Movement" }, { id: "music", label: "Music" }
];
export const isPillar = (v: unknown): v is Pillar => PILLARS.some(p => p.id === v);
export const pillarLabel = (v: string): string => (PILLARS.filter(p => p.id === v)[0] || { label: "" }).label;

export type Source = "record" | "shift";
export interface Entry { id: string; day: string; slot: SlotId; activity: string; pillar: Pillar | ""; participation: Participation; mood: Mood | ""; note: string; source: Source; ref: string; at: string; }
export interface SlotPlan { state: SlotState; text: string; }
export interface DayPlan { morning: SlotPlan; afternoon: SlotPlan; evening: SlotPlan; }
export interface PacketMade { day: string; slot: SlotId; pillars: Pillar[]; names: string[]; minutes: number; at: string; }
export interface Track { schema: string; version: number; residentId: string; stage: Stage; stageDay: string; days: Record<string, DayPlan>; log: Entry[]; packets: PacketMade[]; updatedAt: string; }

/* ---------- small helpers ---------- */
const clean = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T12:00:00Z"));
export const dayOf = (d: Date): string => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const shiftDay = (day: string, by: number): string => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + by); return dayOf(d); };
const newId = (now: Date): string => "t" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 7);
/* "08:30" is morning, "13:00" afternoon, "18:00" evening. */
export function slotOfTime(time: unknown): SlotId {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || "")); const h = m ? +m[1] : 12;
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
export const blankDay = (): DayPlan => ({ morning: { state: "open", text: "" }, afternoon: { state: "open", text: "" }, evening: { state: "open", text: "" } });
export function blank(residentId: string): Track {
  return { schema: SCHEMA, version: 1, residentId: clean(residentId, 80), stage: "", stageDay: "", days: {}, log: [], packets: [], updatedAt: "" };
}

/* ---------- reading what is stored (a damaged or foreign record becomes a clean one, never an error) ---------- */
export function normalize(raw: unknown, residentId: string, today: string = dayOf(new Date())): Track {
  const t = blank(residentId), r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.schema !== SCHEMA) return t;
  if (isStage(r.stage)) { t.stage = r.stage; t.stageDay = isDay(r.stageDay) ? r.stageDay : ""; }
  const days = (r.days && typeof r.days === "object" ? r.days : {}) as Record<string, Record<string, Record<string, unknown>>>;
  Object.keys(days).forEach(day => {
    if (!isDay(day)) return;
    const p = blankDay();
    SLOTS.forEach(s => { const x = days[day] && days[day][s.id]; if (x) p[s.id] = { state: isSlotState(x.state) ? x.state : "open", text: clean(x.text, LIMITS.SLOT_TEXT_CHARS) }; });
    t.days[day] = p;
  });
  (Array.isArray(r.log) ? r.log : []).forEach((e: Record<string, unknown>) => {
    if (!e || !isDay(e.day) || !isSlot(e.slot) || !isParticipation(e.participation)) return;
    t.log.push({ id: clean(e.id, 40) || newId(new Date()), day: e.day, slot: e.slot, activity: clean(e.activity, LIMITS.ACTIVITY_CHARS), pillar: isPillar(e.pillar) ? e.pillar : "",
      participation: e.participation, mood: isMood(e.mood) ? e.mood : "", note: clean(e.note, LIMITS.NOTE_CHARS), source: e.source === "shift" ? "shift" : "record", ref: clean(e.ref, 60), at: clean(e.at, 30) });
  });
  (Array.isArray(r.packets) ? r.packets : []).forEach((p: Record<string, unknown>) => {
    if (!p || !isDay(p.day) || !isSlot(p.slot)) return;
    t.packets.push({ day: p.day, slot: p.slot, pillars: (Array.isArray(p.pillars) ? p.pillars : []).filter(isPillar).slice(0, 6) as Pillar[],
      names: (Array.isArray(p.names) ? p.names : []).map(n => clean(n, LIMITS.ACTIVITY_CHARS)).filter(Boolean).slice(0, 12), minutes: Math.max(0, Math.min(600, Math.round(Number(p.minutes) || 0))), at: clean(p.at, 30) });
  });
  t.updatedAt = clean(r.updatedAt, 30);
  return prune(t, today);
}

/* Older than 90 days goes, and the log and packet list are capped, newest kept. */
export function prune(t: Track, today: string): Track {
  const keep = shiftDay(today, -LIMITS.KEEP_DAYS);
  Object.keys(t.days).forEach(d => { if (d < keep) delete t.days[d]; });
  t.log = t.log.filter(e => e.day >= keep).sort((a, b) => (a.day + a.at < b.day + b.at ? -1 : 1)).slice(-LIMITS.LOG_MAX);
  t.packets = t.packets.filter(p => p.day >= keep).slice(-LIMITS.PACKETS_MAX);
  return t;
}

/* ---------- changing the record (each returns the record, never a half-changed one) ---------- */
const touch = (t: Track, now: Date): Track => { t.updatedAt = now.toISOString(); return t; };
export function setStage(t: Track, stage: unknown, now: Date = new Date()): Track {
  if (stage === "" || stage == null) { t.stage = ""; t.stageDay = ""; } else if (isStage(stage)) { t.stage = stage; t.stageDay = dayOf(now); }
  return touch(t, now);
}
function plan(t: Track, day: string): DayPlan { return t.days[day] || (t.days[day] = blankDay()); }
export function setSlot(t: Track, day: string, slot: string, state: string, text: string, now: Date = new Date()): Track {
  if (!isDay(day) || !isSlot(slot) || !isSlotState(state)) return t;
  plan(t, day)[slot] = { state, text: clean(text, LIMITS.SLOT_TEXT_CHARS) };
  return touch(t, now);
}

/* A note must not name anyone: the record belongs to one resident already. `names` are the words to refuse (the resident's names, for one). */
export function noteProblem(text: string, names: readonly string[]): string {
  const low = " " + String(text || "").toLowerCase().replace(/['’]s\b/g, "").replace(/[^\p{L}\p{N}' -]+/gu, " ") + " ";
  for (const n of names || []) {
    const k = String(n || "").trim().toLowerCase();
    if (k.length >= 2 && low.indexOf(" " + k + " ") >= 0) return "That note has a name in it. Leave names out and say “they”: this record already belongs to one resident.";
  }
  return "";
}

export interface EntryInput { day?: string; slot?: string; time?: string; activity?: string; pillar?: string; participation?: string; mood?: string; note?: string; source?: string; ref?: string; }
export function makeEntry(input: EntryInput, now: Date = new Date(), names: readonly string[] = []): { entry: Entry | null; problems: string[] } {
  const problems: string[] = [], day = isDay(input.day) ? input.day : dayOf(now);
  const slot: SlotId = isSlot(input.slot) ? input.slot : slotOfTime(input.time || now.toTimeString().slice(0, 5));
  const activity = clean(input.activity, LIMITS.ACTIVITY_CHARS), note = clean(input.note, LIMITS.NOTE_CHARS);
  if (!activity) problems.push("Say what the activity was, in a few words.");
  if (!isParticipation(input.participation)) problems.push("Choose how they took part.");
  const np = noteProblem(note + " " + activity, names); if (np) problems.push(np);
  if (problems.length) return { entry: null, problems };
  return { entry: { id: newId(now), day, slot, activity, pillar: isPillar(input.pillar) ? input.pillar : "", participation: input.participation as Participation,
    mood: isMood(input.mood) ? input.mood : "", note, source: input.source === "shift" ? "shift" : "record", ref: clean(input.ref, 60), at: now.toISOString() }, problems };
}
/* Adding an entry also settles that part of the day: taking part is "done", choosing another time is "chose another time". */
export function addEntry(t: Track, input: EntryInput, now: Date = new Date(), names: readonly string[] = []): { track: Track; entry: Entry | null; problems: string[] } {
  const made = makeEntry(input, now, names);
  if (!made.entry) return { track: t, entry: null, problems: made.problems };
  const e = made.entry;
  if (e.ref && t.log.some(x => x.ref === e.ref)) return { track: t, entry: null, problems: [] };   // the same Shift board entry twice
  t.log.push(e);
  plan(t, e.day)[e.slot] = { state: e.participation === "declined" ? "skipped" : "done", text: e.activity };
  prune(t, dayOf(now));
  return { track: touch(t, now), entry: e, problems: [] };
}
export function removeEntry(t: Track, id: string, now: Date = new Date()): Track {
  t.log = t.log.filter(e => e.id !== id);
  return touch(t, now);
}
/* A Shift board entry about this resident, kept once (by its id) in the record. */
export function fromShift(t: Track, eng: { id?: string; day?: string; time?: string; activity?: string; participation?: string; mood?: string; note?: string }, now: Date = new Date(), names: readonly string[] = []): Track {
  const r = addEntry(t, { day: eng.day, time: eng.time, activity: eng.activity, participation: eng.participation, mood: eng.mood, note: eng.note, source: "shift", ref: "shift:" + clean(eng.id, 40) }, now, names);
  return r.track;
}
/* A packet made for this resident: noted by day and part of the day, and that part of the day reads "Packet made" unless it is already settled. */
export function notePacket(t: Track, info: { pillars?: readonly string[]; names?: readonly string[]; minutes?: number }, now: Date = new Date()): Track {
  const day = dayOf(now), slot = slotOfTime(now.toTimeString().slice(0, 5));
  const pillars = Array.from(new Set((info.pillars || []).filter(isPillar))) as Pillar[], names = (info.names || []).map(n => clean(n, LIMITS.ACTIVITY_CHARS)).filter(Boolean);
  t.packets.push({ day, slot, pillars, names: names.slice(0, 12), minutes: Math.max(0, Math.min(600, Math.round(Number(info.minutes) || 0))), at: now.toISOString() });
  const p = plan(t, day), cur = p[slot];
  if (cur.state === "open") p[slot] = { state: "ready", text: names.slice(0, 2).join(", ").slice(0, LIMITS.SLOT_TEXT_CHARS) };
  prune(t, day);
  return touch(t, now);
}

/* ---------- reading the record ---------- */
export function daySummary(t: Track, day: string): { slot: SlotId; label: string; state: SlotState; stateLabel: string; text: string }[] {
  const p = t.days[day] || blankDay();
  return SLOTS.map(s => ({ slot: s.id, label: s.label, state: p[s.id].state, stateLabel: (SLOT_STATES.filter(x => x.id === p[s.id].state)[0] || SLOT_STATES[0]).label, text: p[s.id].text }));
}
export function daySentence(t: Track, day: string): string {
  const parts = daySummary(t, day).map(s => s.label + ": " + (s.state === "open" ? "still to do" : s.stateLabel.toLowerCase() + (s.text ? " (" + s.text + ")" : "")));
  return parts.join("; ") + ".";
}
export function recentEntries(t: Track, today: string, days: number): Entry[] {
  const from = shiftDay(today, -Math.max(1, days) + 1);
  return t.log.filter(e => e.day >= from && e.day <= today);
}
export function pillarsDone(t: Track, today: string, days = 7): { id: Pillar; label: string; count: number }[] {
  const seen: Record<string, number> = {};
  recentEntries(t, today, days).forEach(e => { if (e.pillar && e.participation !== "declined") seen[e.pillar] = (seen[e.pillar] || 0) + 1; });
  return PILLARS.map(p => ({ id: p.id, label: p.label, count: seen[p.id] || 0 }));
}

/* ---------- a suggested support tier ----------
   From the stage when one is set (otherwise the tier on the profile), moved by at most one step by how the last two weeks have gone:
     more support:  half or more of at least four recent sessions were restless, anxious, distracted or overstimulated, or most were
                    watched or declined rather than joined;
     more detail:   most of at least five recent sessions were fully engaged and none was unsettled.
   Always a suggestion, with its reasons in plain words. */
export interface Suggestion { tier: Tier; current: Tier; base: Tier; stage: Stage; changed: boolean; reasons: string[]; sessions: number; note: string; }
export const SUGGESTION_NOTE = "A suggestion for the care team to read. It never changes anything by itself, and your own judgment decides.";
const many = (n: number): string => (n === 1 ? "one session" : n + " sessions");
export function suggestTier(t: Track, profileTier: unknown, today: string = dayOf(new Date())): Suggestion {
  const current = (Math.min(3, Math.max(1, Math.round(Number(profileTier)) || 2)) as Tier);
  const staged = tierOfStage(t.stage), base = (staged || current) as Tier;
  const recent = recentEntries(t, today, 14).slice(-12), n = recent.length;
  const flagged = recent.filter(e => e.mood && (MOODS.filter(m => m.id === e.mood)[0] || { flag: false }).flag).length;
  const low = recent.filter(e => e.participation === "declined" || e.participation === "watched").length;
  const strong = recent.filter(e => e.participation === "engaged" && !(e.mood && (MOODS.filter(m => m.id === e.mood)[0] || { flag: false }).flag)).length;
  const reasons: string[] = [];
  if (staged) reasons.push(stageLabel(t.stage) + " is recorded for them, which reads as Tier " + staged + ".");
  else reasons.push("No stage is recorded, so this starts from the tier on their profile (Tier " + current + ").");
  let tier: Tier = base;
  if (n >= 4 && (flagged / n >= 0.5 || low / n >= 0.6)) {
    if (base < 3) tier = (base + 1) as Tier;
    if (flagged / n >= 0.5) reasons.push("In " + many(flagged) + " of the last " + n + ", staff noted restlessness, worry, distraction or too much going on: simpler pages and a calmer pace may suit them better right now.");
    if (low / n >= 0.6) reasons.push("In " + many(low) + " of the last " + n + ", they watched or chose another time rather than joining in: one thing at a time may help.");
    if (base === 3) reasons.push("They are already at the most supported tier, so the pages stay as they are; the calming steps on the staff page are the next thing to try.");
  } else if (n >= 5 && strong / n >= 0.7 && flagged === 0 && base > 1) {
    tier = (base - 1) as Tier;
    reasons.push("In " + many(strong) + " of the last " + n + ", they were fully engaged and none was unsettled: a little more detail may be welcome.");
  } else if (n >= 4) {
    reasons.push("The last " + n + " sessions give no reason to change the tier.");
  } else {
    reasons.push(n ? "Only " + many(n) + " recorded in the last two weeks: too few to suggest a change." : "Nothing has been recorded in the last two weeks.");
  }
  return { tier, current, base, stage: t.stage, changed: tier !== current, reasons, sessions: n, note: SUGGESTION_NOTE };
}
