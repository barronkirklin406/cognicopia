/* =====================================================================
   COGNICOPIA FACILITY PLANNER
   The data model and the logic behind the Facility Portal (the Packet
   Builder's #/facility): an Activity Director's view of a whole
   community, wing by wing.

     - Wings ("Memory Care West", "Assisted Living East"), each with
       resident groups, and each group with an acuity tier:
            Tier 1  Mild Support         prints at the early-stage level
            Tier 2  Moderate Engagement  moderate-stage level
            Tier 3  Advanced Sensory     advanced-stage level, sensory first
            Tier 4  Universal Group      mixed-ability groups a facilitator leads
     - The six pillars (Coloring, Numbers, Words, Letters, Movement,
       Music), each a Packet Builder category, and which of its
       activities suit each tier: the generator's recommendations.
     - A month scheduler: one click fills every day of a month for every
       group, balanced across the six pillars (each within one session
       of the others), never the same pillar twice in a day, the same
       activity not again within a week when another fits, energizing
       pillars in the morning and calming ones late in the day. Locked
       sessions stay where staff put them.
     - Moving and swapping sessions, balance and coverage figures, the
       week's packets per group, and exports (CSV and iCalendar).
     - Team roles, simulated on this computer: an Activity Director
       (everything), Wing Coordinators (their wings' groups and
       schedules) and Care Staff (see and print their wings). They are
       views, not logins; every change is written to a short audit trail.

   Everything is stored sealed in the encrypted store (secureStore.ts):
   the facility under "cognicopia_facility", each wing's month under
   "cognicopia_facility_sched_<wing id>_<YYYY-MM>". This service stores
   nothing itself, and makes no network requests.

   Built into assets/services/facilityPlanner.js (globalThis.
   CogniFacility) by scripts/build-services.mjs.
   @global CogniFacility
   ===================================================================== */

export const VERSION = "1.0.0";
export const STORE_KEY = "cognicopia_facility";
export const PLAN_PREFIX = "cognicopia_facility_sched_";
export const planKey = (wingId: string, month: string): string => PLAN_PREFIX + wingId + "_" + month;

/* ---------- 1. Acuity tiers ---------- */
export type Acuity = 1 | 2 | 3 | 4;
export type Difficulty = "early" | "moderate" | "advanced";
export interface AcuityTier { tier: Acuity; name: string; label: string; difficulty: Difficulty; supportTier: 1 | 2 | 3; who: string; approach: string; }
export const ACUITY: readonly AcuityTier[] = [
  { tier: 1, name: "Mild Support", label: "Tier 1 · Mild Support", difficulty: "early", supportTier: 1,
    who: "Residents who work mostly on their own, with light cues.",
    approach: "Full-detail pages: multi-step puzzles, open questions, finer lines." },
  { tier: 2, name: "Moderate Engagement", label: "Tier 2 · Moderate Engagement", difficulty: "moderate", supportTier: 2,
    who: "Residents who join in best with a guide beside them.",
    approach: "Guided pages: fewer, larger elements, one step at a time, cues offered early." },
  { tier: 3, name: "Advanced Sensory", label: "Tier 3 · Advanced Sensory", difficulty: "advanced", supportTier: 3,
    who: "Residents who connect most through music, movement and touch.",
    approach: "Sensory first: sing-alongs, seated movement, tracing and single-focus pictures; comments and choices instead of questions." },
  { tier: 4, name: "Universal Group", label: "Tier 4 · Universal Group", difficulty: "moderate", supportTier: 2,
    who: "Mixed-ability groups a facilitator leads together.",
    approach: "Group programs everyone can join: call-and-response, sing-alongs, seated movement and large print." }
];
/* Any value that is not a tier reads as Tier 2, the same default a new group gets. */
export const acuityOf = (t: unknown): AcuityTier => { const n = Math.round(Number(t)); return ACUITY[(n >= 1 && n <= 4 ? n : 2) - 1]; };

/* ---------- 2. The six pillars and what suits each tier ---------- */
export type Pillar = "coloring" | "numbers" | "words" | "letters" | "movement" | "music";
export interface PillarDef { id: Pillar; name: string; category: string; blurb: string; }
/* Fixed order: it is also the order of the pillar colors (never cycled). */
export const PILLARS: readonly PillarDef[] = [
  { id: "coloring", name: "Coloring", category: "cognicore", blurb: "Coloring and visual art" },
  { id: "numbers", name: "Numbers", category: "numbers", blurb: "Counting, coins and number puzzles" },
  { id: "words", name: "Words", category: "word", blurb: "Words, sayings and conversation" },
  { id: "letters", name: "Letters", category: "letters", blurb: "Letters, spelling and tracing" },
  { id: "movement", name: "Movement", category: "movement", blurb: "Seated movement and fine motor" },
  { id: "music", name: "Music", category: "music", blurb: "Sing-alongs and musical memory" }
];
export const pillarOf = (id: string): PillarDef | null => PILLARS.filter(p => p.id === id)[0] || null;
export interface ActivityFit { id: string; name: string; pillar: Pillar; tiers: readonly Acuity[]; best: readonly Acuity[]; group: boolean; sensory: boolean; minutes: number; why: string; }
/* The Packet Builder's activities (with a short name for calendars), and the tiers each is calibrated for. */
export const CATALOG: readonly ActivityFit[] = [
  { id: "cognicore-coloring", name: "Coloring page", pillar: "coloring", tiers: [1, 2, 3, 4], best: [3, 4], group: true, sensory: true, minutes: 30, why: "Bold adult line art; the picture's detail follows the tier." },
  { id: "silhouette-match", name: "Shadow matching", pillar: "coloring", tiers: [2, 3], best: [3], group: false, sensory: true, minutes: 15, why: "Bold pictures matched to their shadows: visual, calm, no reading." },
  { id: "number-ladder", name: "Number ladders", pillar: "numbers", tiers: [1, 2], best: [1], group: false, sensory: false, minutes: 15, why: "Counting on by 1s, 2s, 5s and 10s." },
  { id: "money-count", name: "Money counting", pillar: "numbers", tiers: [1, 2, 4], best: [4], group: true, sensory: false, minutes: 20, why: "Coins at true size with old-time prices: a ready group conversation." },
  { id: "mini-sudoku", name: "Large-print sudoku", pillar: "numbers", tiers: [1, 2], best: [1], group: false, sensory: false, minutes: 20, why: "4x4 and 6x6 puzzles with one solution each." },
  { id: "number-tracing", name: "Number tracing", pillar: "numbers", tiers: [2, 3], best: [3], group: false, sensory: true, minutes: 15, why: "Extra-large digits to trace, with dots to count." },
  { id: "word-search", name: "Word search", pillar: "words", tiers: [1, 2], best: [1], group: false, sensory: false, minutes: 20, why: "Visual search; the grid shrinks at the moderate level." },
  { id: "finish-saying", name: "Finish the saying", pillar: "words", tiers: [1, 2, 3, 4], best: [2, 4], group: true, sensory: false, minutes: 15, why: "Familiar sayings to finish aloud, together." },
  { id: "scramble", name: "Word scramble", pillar: "words", tiers: [1, 2], best: [1], group: false, sensory: false, minutes: 15, why: "Themed words with the letters mixed up." },
  { id: "name-three", name: "Name three", pillar: "words", tiers: [1, 2, 3, 4], best: [4], group: true, sensory: false, minutes: 15, why: "Naming prompts; one answer is plenty at the advanced level." },
  { id: "goes-together", name: "Goes together", pillar: "words", tiers: [1, 2, 3, 4], best: [3], group: true, sensory: false, minutes: 15, why: "Everyday pairs, fewer and larger at the advanced level." },
  { id: "memory-lane", name: "Memory lane", pillar: "words", tiers: [1, 2, 3, 4], best: [4], group: true, sensory: false, minutes: 30, why: "Reminiscence prompts with no right or wrong answers." },
  { id: "orientation-board", name: "Orientation board", pillar: "words", tiers: [2, 3, 4], best: [3, 4], group: true, sensory: true, minutes: 10, why: "A giant-type board for the day, the date and the weather." },
  { id: "letter-scramble", name: "Letter scramble", pillar: "letters", tiers: [1, 2], best: [1], group: false, sensory: false, minutes: 15, why: "Short words in big letter tiles, with a clue." },
  { id: "missing-letters", name: "Missing letters", pillar: "letters", tiers: [1, 2, 3], best: [2], group: false, sensory: false, minutes: 15, why: "Familiar words with a letter or two to fill." },
  { id: "alphabet-sweep", name: "Alphabet sweep", pillar: "letters", tiers: [1, 2, 4], best: [4], group: true, sensory: false, minutes: 20, why: "One theme, A to Z: a natural group brainstorm." },
  { id: "letter-tracing", name: "Letter tracing", pillar: "letters", tiers: [2, 3], best: [3], group: false, sensory: true, minutes: 15, why: "Very large letters to trace: tactile and calm." },
  { id: "chair-yoga", name: "Chair yoga", pillar: "movement", tiers: [1, 2, 3, 4], best: [3, 4], group: true, sensory: true, minutes: 20, why: "Gentle seated stretches, led from the front of the room." },
  { id: "line-tracing", name: "Line tracing", pillar: "movement", tiers: [2, 3], best: [3], group: false, sensory: true, minutes: 15, why: "Thick paths to trace: fine motor, one at a time." },
  { id: "beanbag-target", name: "Beanbag targets", pillar: "movement", tiers: [1, 2, 3, 4], best: [3, 4], group: true, sensory: true, minutes: 20, why: "Seated tosses at a tabletop target, with scores to add." },
  { id: "seated-rhythm", name: "Seated rhythm", pillar: "movement", tiers: [1, 2, 3, 4], best: [4], group: true, sensory: true, minutes: 15, why: "Clap and tap patterns everyone follows in time." },
  { id: "lyric-sheet", name: "Sing-along", pillar: "music", tiers: [1, 2, 3, 4], best: [3, 4], group: true, sensory: true, minutes: 20, why: "Public-domain classics in very large type to sing together." },
  { id: "finish-song", name: "Finish the song", pillar: "music", tiers: [1, 2, 4], best: [4], group: true, sensory: false, minutes: 15, why: "Famous song titles to finish, called out as a group." },
  { id: "singer-match", name: "Singer and song match", pillar: "music", tiers: [1, 2], best: [1], group: false, sensory: false, minutes: 15, why: "Match singers to their songs, or songs to their years." }
];
export const fitOf = (id: string): ActivityFit | null => CATALOG.filter(a => a.id === id)[0] || null;
export const fitsTier = (id: string, tier: number): boolean => { const f = fitOf(id); return !!f && f.tiers.indexOf(tier as Acuity) >= 0; };
/* What the generator recommends for a tier, pillar by pillar: best fits
   first, then (Tier 4) group activities or (Tier 3) sensory ones. The
   rest are listed as "not calibrated for this tier", with the tiers
   they suit. Only activities this build has are offered. */
export type Pacing = "any" | "morning" | "late";
export interface Recommendation { pillar: PillarDef; recommended: ActivityFit[]; other: ActivityFit[]; }
export function recommend(tier: Acuity, available?: readonly string[], pacing: Pacing = "any"): Recommendation[] {
  const have = (a: ActivityFit): boolean => !available || available.indexOf(a.id) >= 0;
  const score = (a: ActivityFit): number => {
    const tierFit = (a.best.indexOf(tier) >= 0 ? 0 : 10) + (tier === 4 && !a.group ? 5 : 0) + (tier === 3 && !a.sensory ? 5 : 0);
    const loadFit = pacing === "morning"
      ? (a.sensory ? 6 : 0) + (a.minutes < 15 ? 2 : 0)
      : pacing === "late" ? (a.sensory ? 0 : 6) + (a.minutes > 20 ? 3 : 0) : 0;
    return tierFit * 10 + loadFit;
  };
  const result = PILLARS.map(p => {
    const all = CATALOG.filter(a => a.pillar === p.id && have(a));
    return { pillar: p, recommended: all.filter(a => a.tiers.indexOf(tier) >= 0).sort((x, y) => score(x) - score(y)), other: all.filter(a => a.tiers.indexOf(tier) < 0) };
  });
  return pacing === "any" ? result : result.sort((a, b) => PREFER[a.pillar.id][pacing] - PREFER[b.pillar.id][pacing]);
}

/* ---------- 3. Wings, groups, team ---------- */
export type Role = "director" | "coordinator" | "staff";
export const ROLES: Readonly<Record<Role, { label: string; summary: string }>> = {
  director: { label: "Activity Director", summary: "Every wing: groups, schedules, wings and the team." },
  coordinator: { label: "Wing Coordinator", summary: "Their wings: groups and schedules, and printing." },
  staff: { label: "Care Staff", summary: "Their wings: the calendar and printing packets." }
};
export interface Cadence { weekday: string[]; weekend: string[]; }
export interface Group { id: string; name: string; acuity: Acuity; size: number; residents: string[]; notes: string; }
export interface Wing { id: string; name: string; groups: Group[]; cadence: Cadence; minutes: number; }
export interface Member { id: string; name: string; role: Role; wings: string[]; }
export interface AuditEntry { t: string; who: string; role: Role; action: string; detail: string; }
export interface Facility { v: 1; wings: Wing[]; team: Member[]; active: string; audit: AuditEntry[]; example: boolean; }
export const LIMITS = { wings: 24, groups: 12, team: 50, residents: 60, sessions: 4, audit: 300, slots: 4000 } as const;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const line = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const idOr = (v: unknown, prefix: string): string => typeof v === "string" && ID.test(v) ? v : newId(prefix);
export const newId = (prefix: string): string => prefix + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
export const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);
export const isTime = (t: unknown): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const times = (list: unknown, max: number): string[] => Array.from(new Set((Array.isArray(list) ? list : []).filter(isTime).filter(t => t >= "06:00" && t <= "21:00"))).sort().slice(0, max);
export const DEFAULT_CADENCE: Cadence = { weekday: ["10:00", "14:30"], weekend: ["10:30"] };
export function normalizeGroup(raw: unknown): Group {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const a = Number(o.acuity);
  return { id: idOr(o.id, "g-"), name: line(o.name, 60) || "New group", acuity: (a === 1 || a === 2 || a === 3 || a === 4 ? a : 2) as Acuity,
    size: Math.max(1, Math.min(60, Math.round(Number(o.size)) || 8)),
    residents: (Array.isArray(o.residents) ? o.residents : []).filter(x => typeof x === "string" && ID.test(x)).slice(0, LIMITS.residents) as string[],
    notes: line(o.notes, 300) };
}
export function normalizeWing(raw: unknown): Wing {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (o.cadence && typeof o.cadence === "object" ? o.cadence : {}) as Record<string, unknown>;
  const groups = (Array.isArray(o.groups) ? o.groups : []).slice(0, LIMITS.groups).map(normalizeGroup);
  const seen = new Set<string>(); groups.forEach(g => { while (seen.has(g.id)) g.id = idOr(null, "g-"); seen.add(g.id); });
  return { id: idOr(o.id, "w-"), name: line(o.name, 60) || "New wing", groups,
    cadence: { weekday: Array.isArray(c.weekday) ? times(c.weekday, LIMITS.sessions) : DEFAULT_CADENCE.weekday.slice(), weekend: Array.isArray(c.weekend) ? times(c.weekend, LIMITS.sessions) : DEFAULT_CADENCE.weekend.slice() },
    minutes: Math.max(15, Math.min(120, Math.round(Number(o.minutes)) || 45)) };
}
export function normalizeMember(raw: unknown): Member {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const role = o.role === "director" || o.role === "coordinator" || o.role === "staff" ? o.role : "staff";
  return { id: idOr(o.id, "m-"), name: line(o.name, 60) || ROLES[role].label, role, wings: (Array.isArray(o.wings) ? o.wings : []).filter(x => typeof x === "string" && ID.test(x)).slice(0, LIMITS.wings) as string[] };
}
export function normalizeFacility(raw: unknown): Facility {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const wings = (Array.isArray(o.wings) ? o.wings : []).slice(0, LIMITS.wings).map(normalizeWing);
  const ids = new Set<string>(); wings.forEach(w => { while (ids.has(w.id)) w.id = idOr(null, "w-"); ids.add(w.id); });
  const team = (Array.isArray(o.team) ? o.team : []).slice(0, LIMITS.team).map(normalizeMember).map(m => Object.assign(m, { wings: m.wings.filter(id => ids.has(id)) }));
  if (!team.some(m => m.role === "director")) team.unshift({ id: "m-director", name: "Activity Director", role: "director", wings: [] });
  const audit = (Array.isArray(o.audit) ? o.audit : []).slice(-LIMITS.audit).map(e => {
    const x = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    return { t: typeof x.t === "string" && !isNaN(Date.parse(x.t)) ? x.t : new Date(0).toISOString(), who: line(x.who, 60), role: (x.role === "director" || x.role === "coordinator" ? x.role : "staff") as Role, action: line(x.action, 60), detail: line(x.detail, 200) };
  });
  const active = typeof o.active === "string" && team.some(m => m.id === o.active) ? o.active : team.filter(m => m.role === "director")[0].id;
  return { v: 1, wings, team, active, audit, example: o.example === true };
}
export const activeMember = (f: Facility): Member => f.team.filter(m => m.id === f.active)[0] || f.team[0];
/* A two-wing starting point: every name, tier and time can be changed. */
export function demoFacility(): Facility {
  return normalizeFacility({
    wings: [
      { id: "w-mcw", name: "Memory Care West", groups: [
        { id: "g-sensory", name: "Sensory Room", acuity: 3, size: 6 }, { id: "g-garden", name: "Garden Room", acuity: 2, size: 8 }] },
      { id: "w-ale", name: "Assisted Living East", groups: [
        { id: "g-morning", name: "Morning Circle", acuity: 1, size: 10 }, { id: "g-hall", name: "Community Hall", acuity: 4, size: 18 }] }
    ],
    team: [
      { id: "m-director", name: "Activity Director", role: "director", wings: [] },
      { id: "m-coord-west", name: "Wing Coordinator, West", role: "coordinator", wings: ["w-mcw"] },
      { id: "m-staff-east", name: "Care Staff, East", role: "staff", wings: ["w-ale"] }
    ],
    active: "m-director", example: true
  });
}

/* ---------- 4. Permissions and the audit trail ---------- */
export type Action = "view" | "print" | "editSchedule" | "editGroups" | "manageWings" | "manageTeam";
export function can(m: Member | null | undefined, action: Action, wingId?: string): boolean {
  if (!m || m.role === "director") return true;
  const mine = !wingId || m.wings.indexOf(wingId) >= 0;
  if (action === "manageWings" || action === "manageTeam") return false;
  if (!mine) return false;
  if (m.role === "coordinator") return true;
  return action === "view" || action === "print";
}
export function visibleWings(f: Facility, m: Member): Wing[] { return m.role === "director" ? f.wings : f.wings.filter(w => m.wings.indexOf(w.id) >= 0); }
export function withAudit(f: Facility, action: string, detail: string, now: Date = new Date()): Facility {
  const m = activeMember(f);
  const entry: AuditEntry = { t: now.toISOString(), who: m.name, role: m.role, action: line(action, 60), detail: line(detail, 200) };
  return Object.assign({}, f, { audit: f.audit.concat([entry]).slice(-LIMITS.audit) });
}

/* ---------- 5. Dates ---------- */
export const isMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const pad = (n: number): string => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number): string => y + "-" + pad(m) + "-" + pad(d);
const utc = (date: string): Date => new Date(date + "T12:00:00Z");
export function monthDays(month: string): string[] {
  if (!isMonth(month)) return [];
  const [y, m] = month.split("-").map(Number), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => iso(y, m, i + 1));
}
export const weekday = (date: string): number => utc(date).getUTCDay();          // 0 Sunday
export const isWeekend = (date: string): boolean => { const d = weekday(date); return d === 0 || d === 6; };
export function addDays(date: string, n: number): string { const d = utc(date); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function shiftMonth(month: string, n: number): string { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }
/* The Monday-to-Sunday week holding a date. */
export function weekOf(date: string): { start: string; end: string; days: string[] } {
  const back = (weekday(date) + 6) % 7, start = addDays(date, -back);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { start, end: days[6], days };
}
/* The calendar grid for a month: whole weeks, Monday first, with the days outside the month marked. */
export function monthGrid(month: string): { date: string; inMonth: boolean }[][] {
  const days = monthDays(month); if (!days.length) return [];
  const first = weekOf(days[0]).start, weeks: { date: string; inMonth: boolean }[][] = [];
  for (let d = first; d <= days[days.length - 1] || weeks.length === 0 || weeks[weeks.length - 1].length < 7; ){
    if (!weeks.length || weeks[weeks.length - 1].length === 7) weeks.push([]);
    weeks[weeks.length - 1].push({ date: d, inMonth: d.slice(0, 7) === month });
    d = addDays(d, 1);
    if (weeks.length > 6) break;
  }
  return weeks;
}
export function fmtTime(t: string): string { if (!isTime(t)) return t; const [h, m] = t.split(":").map(Number); return (h % 12 || 12) + ":" + pad(m) + (h < 12 ? " AM" : " PM"); }
const partOfDay = (t: string): "morning" | "afternoon" | "late" => t < "12:00" ? "morning" : t < "16:00" ? "afternoon" : "late";

/* ---------- 6. Month plans ---------- */
export interface Slot { id: string; date: string; time: string; group: string; pillar: Pillar; activity: string; locked: boolean; note: string; }
export interface MonthPlan { v: 1; wing: string; month: string; slots: Slot[]; }
export function normalizePlan(raw: unknown, wing: string, month: string, groups?: readonly string[]): MonthPlan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const slots = (Array.isArray(o.slots) ? o.slots : []).slice(0, LIMITS.slots).map(s => {
    const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const fit = fitOf(String(x.activity));
    return { id: idOr(x.id, "s-"), date: String(x.date), time: String(x.time), group: String(x.group), pillar: (fit ? fit.pillar : "words") as Pillar,
      activity: fit ? fit.id : "", locked: x.locked === true, note: line(x.note, 140) };
  }).filter(s => s.activity && s.date.slice(0, 7) === month && monthDays(month).indexOf(s.date) >= 0 && isTime(s.time) && ID.test(s.group) && (!groups || groups.indexOf(s.group) >= 0))
    .filter(s => { const k = s.group + "|" + s.date + "|" + s.time; if (seen.has(k)) return false; seen.add(k); return true; });   // one session per group per time
  return { v: 1, wing, month, slots: sortSlots(slots) };
}
export const sortSlots = (s: Slot[]): Slot[] => s.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.time < b.time ? -1 : a.time > b.time ? 1 : a.group < b.group ? -1 : 1);
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: string): () => number {
  let a = hash(seed);
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* Energizing pillars suit the morning, calming ones the late afternoon (a
   gentle hand against sundowning); balance always comes first. */
const PREFER: Readonly<Record<Pillar, Record<"morning" | "afternoon" | "late", number>>> = {
  movement: { morning: 0, afternoon: 10, late: 25 }, numbers: { morning: 0, afternoon: 10, late: 25 },
  words: { morning: 0, afternoon: 0, late: 10 }, letters: { morning: 0, afternoon: 10, late: 25 },
  music: { morning: 10, afternoon: 0, late: 0 }, coloring: { morning: 10, afternoon: 0, late: 0 }
};
export interface FillOptions { groups?: string[]; seed?: string; available?: readonly string[]; }
/* The day's pillars in the order that best suits its times (at most 4 sessions: 24 orders to try). */
function arrange(ps: Pillar[], times: string[], cost: (p: Pillar, t: string) => number): Pillar[] {
  let best = ps.slice(), bestCost = Infinity;
  const perm = (rest: Pillar[], acc: Pillar[]): void => {
    if (!rest.length){ const c = acc.reduce((n, p, k) => n + cost(p, times[k]), 0); if (c < bestCost){ bestCost = c; best = acc; } return; }
    rest.forEach((p, i) => perm(rest.slice(0, i).concat(rest.slice(i + 1)), acc.concat([p])));
  };
  perm(ps, []);
  return best;
}
/* Fill the month for the wing's groups (or the ones named), keeping every
   locked session and replacing the rest. */
export function autoPopulate(plan: MonthPlan, wing: Wing, opt: FillOptions = {}): MonthPlan {
  const days = monthDays(plan.month), groups = wing.groups.filter(g => !opt.groups || opt.groups.indexOf(g.id) >= 0);
  const target = new Set(groups.map(g => g.id));
  const kept = plan.slots.filter(s => s.locked || !target.has(s.group));
  const out: Slot[] = kept.slice();
  for (const g of groups){
    const r = rng((opt.seed || "1") + "|" + wing.id + "|" + g.id + "|" + plan.month);
    const recs = recommend(g.acuity, opt.available), byPillar = new Map(recs.map(x => [x.pillar.id, x.recommended]));
    const pillars = PILLARS.map(p => p.id).filter(p => (byPillar.get(p) || []).length);
    const counts = new Map<Pillar, number>(pillars.map(p => [p, 0]));
    const used = new Map<string, number[]>();
    const use = (id: string, day: number): void => { const l = used.get(id); if (l) l.push(day); else used.set(id, [day]); };
    const gap = (id: string, day: number): number => (used.get(id) || []).reduce((m, d) => Math.min(m, Math.abs(day - d)), 99);   // days to its nearest use, before or after
    const mine = kept.filter(s => s.group === g.id);
    mine.forEach(s => { counts.set(s.pillar, (counts.get(s.pillar) || 0) + 1); use(s.activity, days.indexOf(s.date)); });
    let yesterday = new Map<string, Pillar>();            // time -> pillar, the day before
    days.forEach((d, di) => {
      const times = isWeekend(d) ? wing.cadence.weekend : wing.cadence.weekday;
      const fixed = mine.filter(s => s.date === d), today: Pillar[] = fixed.map(s => s.pillar);
      const free = times.filter(t => !fixed.some(s => s.time === t)), before = new Set(yesterday.values());
      // 1. Today's pillars: the least used so far (balance comes first), never one already on today,
      //    and on a tie not one from yesterday.
      const chosen: Pillar[] = [];
      free.forEach(() => {
        let best: Pillar = pillars[0], bestScore = Infinity;
        for (const p of pillars){
          const sc = (counts.get(p) || 0) * 100 + (today.indexOf(p) >= 0 || chosen.indexOf(p) >= 0 ? 1000 : 0) + (before.has(p) ? 20 : 0) + r();
          if (sc < bestScore){ best = p; bestScore = sc; }
        }
        chosen.push(best); counts.set(best, (counts.get(best) || 0) + 1);
      });
      // 2. Their times: energizing pillars earlier, calming ones late in the day, and not the
      //    same pillar at the same time as yesterday when another order is as good. The balance
      //    is already settled, so this only improves the day.
      const order = arrange(chosen, free, (p, t) => PREFER[p][partOfDay(t)] + (yesterday.get(t) === p ? 12 : 0));
      const todayAt = new Map<string, Pillar>(fixed.map(s => [s.time, s.pillar]));
      free.forEach((t, k) => {
        const best = order[k], options = byPillar.get(best) || [];
        let act = options[0], actScore = Infinity;
        options.forEach((a, rank) => {
          const since = gap(a.id, di);
          const sc = (since < 7 ? (7 - since) * 50 : 0) - Math.min(since, 60) + rank * 2 + r();   // not again within a week; longest-rested first; best fits lead
          if (sc < actScore){ act = a; actScore = sc; }
        });
        todayAt.set(t, best); use(act.id, di);
        out.push({ id: "s-" + hash(wing.id + g.id + d + t + (opt.seed || "")).toString(36) + Math.floor(r() * 1e6).toString(36), date: d, time: t, group: g.id, pillar: best, activity: act.id, locked: false, note: "" });
      });
      yesterday = todayAt;
    });
  }
  return { v: 1, wing: plan.wing, month: plan.month, slots: sortSlots(out) };
}
export function clearUnlocked(plan: MonthPlan, groups?: string[]): MonthPlan {
  return Object.assign({}, plan, { slots: plan.slots.filter(s => s.locked || (groups && groups.indexOf(s.group) < 0)) });
}
/* The group's other session at the same day and time, if there is one. */
export function clashOf(plan: MonthPlan, s: { id: string; group: string; date: string; time: string }): Slot | null {
  return plan.slots.filter(x => x.id !== s.id && x.group === s.group && x.date === s.date && x.time === s.time)[0] || null;
}
/* Move a session to another day (and time). When that group already has a
   session there, the two trade places. With lock, both stay where staff put
   them the next time the month is filled. */
export function moveSlot(plan: MonthPlan, slotId: string, toDate: string, toTime?: string, lock = false): { plan: MonthPlan; swapped: Slot | null; moved: Slot | null } {
  const s = plan.slots.filter(x => x.id === slotId)[0];
  if (!s || monthDays(plan.month).indexOf(toDate) < 0) return { plan, swapped: null, moved: null };
  const time = toTime && isTime(toTime) ? toTime : s.time;
  if (toDate === s.date && time === s.time) return { plan, swapped: null, moved: null };
  const other = clashOf(plan, { id: s.id, group: s.group, date: toDate, time });
  const moved: Slot = Object.assign({}, s, { date: toDate, time, locked: s.locked || lock });
  const swapped: Slot | null = other ? Object.assign({}, other, { date: s.date, time: s.time, locked: other.locked || lock }) : null;
  const slots = plan.slots.map(x => x.id === s.id ? moved : swapped && x.id === swapped.id ? swapped : x);
  return { plan: Object.assign({}, plan, { slots: sortSlots(slots) }), swapped, moved };
}
/* Add or change one session. Refused (the plan comes back unchanged) when the
   activity, day or time is not valid, or the group already has a session then. */
export function updateSlot(plan: MonthPlan, slot: Slot): MonthPlan {
  const fit = fitOf(slot.activity);
  if (!fit || !ID.test(slot.id) || !ID.test(slot.group) || !isTime(slot.time) || monthDays(plan.month).indexOf(slot.date) < 0 || clashOf(plan, slot)) return plan;
  const isNew = !plan.slots.some(x => x.id === slot.id);
  if (isNew && plan.slots.length >= LIMITS.slots) return plan;
  const clean: Slot = { id: slot.id, date: slot.date, time: slot.time, group: slot.group, pillar: fit.pillar, activity: fit.id, locked: slot.locked === true, note: line(slot.note, 140) };
  return Object.assign({}, plan, { slots: sortSlots(plan.slots.filter(x => x.id !== clean.id).concat([clean])) });
}
export const removeSlot = (plan: MonthPlan, id: string): MonthPlan => Object.assign({}, plan, { slots: plan.slots.filter(s => s.id !== id) });

/* Sessions worth a second look: an activity not calibrated for the group's
   tier (after the tier changed, say), or a pillar twice in a group's day. */
export interface Issue { slot: string; kind: "tier" | "repeat"; text: string; }
export function planIssues(plan: MonthPlan, wing: Wing): Issue[] {
  const out: Issue[] = [], tierOf = new Map(wing.groups.map(g => [g.id, g.acuity]));
  const seen = new Set<string>();
  plan.slots.forEach(s => {
    const t = tierOf.get(s.group); if (t == null) return;
    if (!fitsTier(s.activity, t)) out.push({ slot: s.id, kind: "tier", text: "Not calibrated for Tier " + t + " (" + acuityOf(t).name + ")" });
    const k = s.group + "|" + s.date + "|" + s.pillar;
    if (seen.has(k)) out.push({ slot: s.id, kind: "repeat", text: "A second " + (pillarOf(s.pillar) || { name: s.pillar }).name + " session this day" });
    seen.add(k);
  });
  return out;
}

/* After a tier changes: each unlocked session whose activity does not suit
   its group's tier takes one from the same pillar that does, the one used
   farthest away that month first. Days, times and pillars stay as they are,
   so the balance does too. Locked sessions are left for staff. */
export function recalibrate(plan: MonthPlan, wing: Wing, groups?: readonly string[], available?: readonly string[]): { plan: MonthPlan; changed: number } {
  const tierOf = new Map(wing.groups.map(g => [g.id, g.acuity])), days = monthDays(plan.month);
  const used = new Map<string, number[]>();            // group|activity -> day indexes
  const note = (s: Slot): void => { const k = s.group + "|" + s.activity, l = used.get(k); if (l) l.push(days.indexOf(s.date)); else used.set(k, [days.indexOf(s.date)]); };
  plan.slots.forEach(s => { const t = tierOf.get(s.group); if (t != null && fitsTier(s.activity, t)) note(s); });
  let changed = 0;
  const slots = sortSlots(plan.slots).map(s => {
    const t = tierOf.get(s.group);
    if (t == null || s.locked || (groups && groups.indexOf(s.group) < 0) || fitsTier(s.activity, t)) return s;
    const opts = (recommend(t, available).filter(r => r.pillar.id === s.pillar)[0] || { recommended: [] as ActivityFit[] }).recommended;
    if (!opts.length) return s;
    const di = days.indexOf(s.date), away = (id: string): number => (used.get(s.group + "|" + id) || []).reduce((m, d) => Math.min(m, Math.abs(di - d)), 99);
    let pick = opts[0], best = -1;
    opts.forEach(a => { const d = Math.min(away(a.id), 14); if (d > best){ best = d; pick = a; } });   // ties keep the best fit
    const out = Object.assign({}, s, { activity: pick.id });
    note(out); changed++;
    return out;
  });
  return { plan: Object.assign({}, plan, { slots }), changed };
}

/* ---------- 7. Balance, coverage, the week's packets ---------- */
export interface Balance { counts: Record<Pillar, number>; total: number; target: number; spread: number; days: number; covered: number; }
export function balance(plan: MonthPlan, groups?: readonly string[]): Balance {
  const slots = plan.slots.filter(s => !groups || groups.indexOf(s.group) >= 0);
  const counts = { coloring: 0, numbers: 0, words: 0, letters: 0, movement: 0, music: 0 } as Record<Pillar, number>;
  slots.forEach(s => { counts[s.pillar]++; });
  const vals = PILLARS.map(p => counts[p.id]), total = slots.length, days = monthDays(plan.month).length;
  return { counts, total, target: total / PILLARS.length, spread: total ? Math.max(...vals) - Math.min(...vals) : 0, days, covered: new Set(slots.map(s => s.date)).size };
}
export interface PacketSession { slot: Slot; fit: ActivityFit; copies: number; }
export interface GroupPacket { group: Group; tier: AcuityTier; sessions: PacketSession[]; pages: number; }
/* What a week's packets hold: per group, its sessions in order, each with
   one master page or a copy for every participant. Groups without a
   session that week are left out. */
export function weekPackets(wing: Wing, slots: readonly Slot[], weekStart: string, mode: "master" | "each", groups?: readonly string[]): GroupPacket[] {
  const days = weekOf(weekStart).days;
  return wing.groups.filter(g => !groups || groups.indexOf(g.id) >= 0).map(g => {
    const sessions = sortSlots(slots.filter(s => s.group === g.id && days.indexOf(s.date) >= 0) as Slot[])
      .map(s => ({ slot: s, fit: fitOf(s.activity)!, copies: mode === "each" ? g.size : 1 })).filter(x => x.fit);
    return { group: g, tier: acuityOf(g.acuity), sessions, pages: sessions.length ? 1 + sessions.reduce((n, x) => n + x.copies, 0) : 0 };   // a cover sheet, then the pages
  }).filter(p => p.sessions.length);
}

/* ---------- 8. Exports ---------- */
/* CSV (RFC 4180, CRLF). A cell that a spreadsheet would read as a formula
   (=, +, -, @, tab, return) is prefixed with an apostrophe. */
export function toCSV(rows: readonly (readonly (string | number)[])[]): string {
  const cell = (v: string | number): string => {
    let s = String(v == null ? "" : v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
export interface CalEvent { uid: string; date: string; time: string; minutes: number; summary: string; description: string; category: string; }
/* iCalendar (RFC 5545): floating local times (the facility's own clock),
   text escaped, lines folded at 75 octets. */
export function toICS(events: readonly CalEvent[], name: string, stamp: Date = new Date()): string {
  const esc = (s: string): string => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const dt = (date: string, time: string): string => date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
  const end = (date: string, time: string, minutes: number): string => {
    const [h, m] = time.split(":").map(Number), total = h * 60 + m + minutes;
    return dt(total >= 1440 ? addDays(date, 1) : date, pad(Math.floor(total / 60) % 24) + ":" + pad(total % 60));
  };
  const fold = (l: string): string => {
    const enc = new TextEncoder(); if (enc.encode(l).length <= 75) return l;
    const out: string[] = []; let cur = "", first = true;
    for (const ch of Array.from(l)){
      const lim = first ? 75 : 74;
      if (enc.encode(cur + ch).length > lim){ out.push(cur); cur = ch; first = false; } else cur += ch;
    }
    out.push(cur);
    return out.join("\r\n ");
  };
  const now = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cognicopia//Facility Portal//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + esc(name)];
  events.filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isTime(e.time)).forEach(e => {
    lines.push("BEGIN:VEVENT", "UID:" + esc(e.uid) + "@cognicopia.local", "DTSTAMP:" + now, "DTSTART:" + dt(e.date, e.time), "DTEND:" + end(e.date, e.time, Math.max(5, e.minutes)),
      "SUMMARY:" + esc(e.summary), "DESCRIPTION:" + esc(e.description), "CATEGORIES:" + esc(e.category), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
