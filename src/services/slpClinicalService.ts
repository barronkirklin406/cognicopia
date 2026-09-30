/* =====================================================================
   COGNICOPIA SLP CLINICAL SERVICE
   For speech-language pathologists and therapy staff who use Cognicopia
   activities in skilled sessions:

     1. Staging to tiers. A clinician's recorded Global Deterioration
        Scale (GDS, Reisberg 1982) and Functional Assessment Staging
        (FAST, Reisberg 1988) map to Cognicopia's support tiers:
            Tier 1  Full detail     GDS 3-4   FAST 3-4
            Tier 2  Guided          GDS 5     FAST 5
            Tier 3  Simplified      GDS 6     FAST 6a-6e
        GDS 7 / FAST 7 is past what printed pages serve well; the
        mapping says so and points to sensory and music approaches.
        Staging is never inferred from activity results: only a stage a
        clinician recorded is mapped, and the tier stays staff's choice.

     2. Session notes. A session log per resident (kept in the encrypted
        store under "cognicopia_clinical_<id>") and SOAP pages for the Full
        Administrative Binder. Every word in S, O, A and P is what staff
        typed. The service arranges it, adds the arithmetic of the numbers
        staff entered (4 of 5 trials is 80%), and leaves a section that was
        not recorded marked "Not recorded", with room to write by hand. It
        never writes a finding, an assessment or a plan.

     3. A procedure-code reference, with checks. Short plain-language
        summaries (not the AMA's descriptor text) of the codes therapy
        staff most often ask about, and checks on what was recorded:
            97129 / 97130  cognitive function intervention, direct one-on-
                           one, first 15 minutes / each additional 15 (add-on)
            92507 / 92508  speech, language, voice, communication or
                           auditory processing treatment, individual / group
            96125          standardized cognitive performance testing,
                           per hour, with interpretation and report
        97124 is often mentioned for cognitive work, but it is a massage
        code (therapeutic procedure: massage). The check flags it and
        points to 97129/97130. Codes are chosen by the treating clinician
        under current CPT and payer rules; this is a reference, not
        billing advice.

   Built into assets/services/slpClinicalService.js (globalThis.
   CogniClinical) by scripts/build-services.mjs. No network, no storage:
   it turns recorded data into structured blocks and printable pages.
   @global CogniClinical
   ===================================================================== */

export const VERSION = "1.0.0";
export type Tier = 1 | 2 | 3;
export const STORE_PREFIX = "cognicopia_clinical_";

/* ---------- 1. Staging ---------- */
export interface Stage { code: string; label: string; summary: string; }
export const GDS_STAGES: readonly Stage[] = [
  { code: "1", label: "GDS 1", summary: "No cognitive decline." },
  { code: "2", label: "GDS 2", summary: "Very mild decline: subjective complaints, such as misplacing things; no deficits on examination." },
  { code: "3", label: "GDS 3", summary: "Mild decline: the earliest clear deficits, noticed in demanding work or social settings." },
  { code: "4", label: "GDS 4", summary: "Moderate decline: clear deficits on careful interview, such as less knowledge of recent events or difficulty with finances or travel." },
  { code: "5", label: "GDS 5", summary: "Moderately severe decline: needs some help to get by, such as recalling an address or choosing clothing." },
  { code: "6", label: "GDS 6", summary: "Severe decline: largely unaware of recent events; needs help with daily living such as dressing and toileting." },
  { code: "7", label: "GDS 7", summary: "Very severe decline: verbal abilities lost over the stage; needs help with eating and toileting; basic motor skills lost." }
];
export const FAST_STAGES: readonly Stage[] = [
  { code: "1", label: "FAST 1", summary: "No difficulty, either subjectively or objectively." },
  { code: "2", label: "FAST 2", summary: "Subjective difficulty, such as finding words or remembering where things were put." },
  { code: "3", label: "FAST 3", summary: "Decreased functioning in demanding work or social settings, noticed by others." },
  { code: "4", label: "FAST 4", summary: "Decreased ability with complex tasks, such as planning a meal for guests, finances or shopping." },
  { code: "5", label: "FAST 5", summary: "Needs help choosing proper clothing for the day, season or occasion." },
  { code: "6a", label: "FAST 6a", summary: "Needs help putting on clothing properly." },
  { code: "6b", label: "FAST 6b", summary: "Needs help bathing properly, such as adjusting the water temperature." },
  { code: "6c", label: "FAST 6c", summary: "Needs help with the mechanics of toileting." },
  { code: "6d", label: "FAST 6d", summary: "Urinary incontinence." },
  { code: "6e", label: "FAST 6e", summary: "Fecal incontinence." },
  { code: "7a", label: "FAST 7a", summary: "Speech limited to about half a dozen words in an average day." },
  { code: "7b", label: "FAST 7b", summary: "Speech limited to a single intelligible word in an average day." },
  { code: "7c", label: "FAST 7c", summary: "Cannot walk without personal assistance." },
  { code: "7d", label: "FAST 7d", summary: "Cannot sit up without assistance." },
  { code: "7e", label: "FAST 7e", summary: "Cannot smile." },
  { code: "7f", label: "FAST 7f", summary: "Cannot hold the head up independently." }
];
export interface TierStages { tier: Tier; label: string; gds: readonly string[]; fast: readonly string[]; approach: string; }
export const TIER_STAGES: readonly TierStages[] = [
  { tier: 1, label: "Tier 1 · Full detail", gds: ["3", "4"], fast: ["3", "4"],
    approach: "Full-detail pages: multi-step tasks, open questions, fine lines and small areas; the person leads, staff support." },
  { tier: 2, label: "Tier 2 · Guided", gds: ["5"], fast: ["5"],
    approach: "Guided pages: fewer, larger elements, one step at a time, bold lines, cues offered before they are needed." },
  { tier: 3, label: "Tier 3 · Simplified", gds: ["6"], fast: ["6a", "6b", "6c", "6d", "6e"],
    approach: "Simplified pages: one focal subject, extra-bold lines, comments and either/or choices instead of questions, hand-under-hand support." }
];
export interface StagingRecord { date: string; gds: string; fast: string; recordedBy: string; note: string; }
export interface TierFromStage { tier: Tier | null; beyond: boolean; basis: string; agree: boolean; note: string; }
const gdsTier = (g: string): Tier | null => g === "1" || g === "2" || g === "3" || g === "4" ? 1 : g === "5" ? 2 : g === "6" || g === "7" ? 3 : null;
const fastTier = (f: string): Tier | null => /^[1-4]$/.test(f) ? 1 : f === "5" ? 2 : /^[67][a-f]$/.test(f) ? 3 : null;
export const isGds = (g: unknown): boolean => GDS_STAGES.some(s => s.code === g);
export const isFast = (f: unknown): boolean => FAST_STAGES.some(s => s.code === f);
/* The tier a recorded stage suggests. When GDS and FAST point to different
   tiers, the one with more support is suggested and the difference is
   flagged for the clinician. */
export function tierForStage(rec: { gds?: string; fast?: string }): TierFromStage {
  const g = isGds(rec.gds) ? String(rec.gds) : "", f = isFast(rec.fast) ? String(rec.fast) : "";
  const tg = g ? gdsTier(g) : null, tf = f ? fastTier(f) : null;
  if (!tg && !tf) return { tier: null, beyond: false, basis: "", agree: true, note: "No stage recorded." };
  const tier = Math.max(tg || 0, tf || 0) as Tier, agree = !tg || !tf || tg === tf;
  const beyond = g === "7" || /^7/.test(f);
  const basis = [g ? "GDS " + g : "", f ? "FAST " + f : ""].filter(Boolean).join(" · ");
  const low = (g && Number(g) <= 2) || (f && Number(f.charAt(0)) <= 2);
  let note = TIER_STAGES[tier - 1].approach;
  if (beyond) note = "Stage 7 is past what printed pages serve well: favor one-to-one sensory, music and touch-based engagement. Tier 3 pages only for brief, supported moments.";
  else if (low && tier === 1) note = "Little or no decline recorded: standard materials may suit better than any tier. " + note;
  if (!agree) note = "GDS and FAST suggest different tiers; the one with more support is shown. Review with the clinician. " + note;
  return { tier, beyond, basis, agree, note };
}
export function stagesForTier(tier: Tier): TierStages { return TIER_STAGES[tier - 1]; }

/* ---------- 2. Procedure-code reference ---------- */
export interface CodeRef { code: string; summary: string; timed: boolean; minutes?: number; addOnTo?: string; cognitive: boolean; group?: boolean; note: string; }
export const CODES: readonly CodeRef[] = [
  { code: "97129", summary: "Cognitive function intervention (attention, memory, reasoning, executive function, problem solving, pragmatics) and compensatory strategies; direct one-on-one; first 15 minutes.", timed: true, minutes: 15, cognitive: true,
    note: "Timed; the time is direct, one-on-one contact. Replaced G0515 in 2020." },
  { code: "97130", summary: "Cognitive function intervention; each additional 15 minutes (add-on to 97129).", timed: true, minutes: 15, addOnTo: "97129", cognitive: true,
    note: "Add-on: reported only with 97129 on the same day." },
  { code: "92507", summary: "Treatment of speech, language, voice, communication and/or auditory processing disorder; individual.", timed: false, cognitive: true,
    note: "Untimed: one per session, whatever its length." },
  { code: "92508", summary: "Treatment of speech, language, voice, communication and/or auditory processing disorder; group, two or more individuals.", timed: false, cognitive: true, group: true,
    note: "Untimed; for group sessions." },
  { code: "96125", summary: "Standardized cognitive performance testing, per hour of the professional's time, including administering, interpreting and reporting.", timed: true, minutes: 60, cognitive: true,
    note: "For standardized testing (name the instrument in the objective section), not for treatment sessions." },
  { code: "97124", summary: "Therapeutic procedure: massage (effleurage, pétrissage, tapotement), each 15 minutes.", timed: true, minutes: 15, cognitive: false,
    note: "A massage code, not a cognitive one. Cognitive treatment is usually 97129/97130 (or 92507 for speech-language treatment)." }
];
export const codeRef = (c: string): CodeRef | null => CODES.filter(x => x.code === c)[0] || null;

/* ---------- 3. Sessions ---------- */
export type Cue = "independent" | "minimal" | "moderate" | "maximal" | "dependent" | "";
export const CUES: readonly { code: Cue; label: string }[] = [
  { code: "independent", label: "Independent" }, { code: "minimal", label: "Minimal cues" }, { code: "moderate", label: "Moderate cues" },
  { code: "maximal", label: "Maximal cues" }, { code: "dependent", label: "Dependent" }
];
export const DISCIPLINES: readonly string[] = ["SLP", "OT", "PT", "Activities", "Nursing", "Other"];
export interface Measure { task: string; trials: number | null; correct: number | null; cue: Cue; note: string; }
export interface CodeLine { code: string; units: number | null; }
export interface Session {
  id: string; date: string; minutes: number | null; format: "individual" | "group"; discipline: string; clinician: string; credentials: string;
  goals: string[]; activities: string[]; subjective: string; measures: Measure[]; assessment: string; plan: string; codes: CodeLine[]; cosign: string;
}
export interface ClinicalLog { v: 1; residentId: string; staging: StagingRecord[]; sessions: Session[]; }
const str = (v: unknown, max: number): string => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const line = (v: unknown, max: number): string => str(v, max).replace(/\s+/g, " ");
const int = (v: unknown, lo: number, hi: number): number | null => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) ? null : Math.max(lo, Math.min(hi, Math.round(n))); };
const dateOk = (d: unknown): string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z")) ? d : "";
const lines = (v: unknown, n: number, max: number): string[] => (Array.isArray(v) ? v : String(v == null ? "" : v).split("\n")).map(x => line(x, max)).filter(Boolean).slice(0, n);
/* A session exactly as staff recorded it, bounded and cleaned: nothing added. */
export function normalizeSession(raw: unknown): Session {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const measures = (Array.isArray(o.measures) ? o.measures : []).slice(0, 12).map(m => {
    const x = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const trials = int(x.trials, 0, 500), correct0 = int(x.correct, 0, 500);
    const cue = CUES.some(c => c.code === x.cue) ? x.cue as Cue : "";
    return { task: line(x.task, 120), trials, correct: correct0 != null && trials != null ? Math.min(correct0, trials) : correct0, cue, note: line(x.note, 200) };
  }).filter(m => m.task || m.trials != null || m.cue || m.note);
  const codes = (Array.isArray(o.codes) ? o.codes : []).slice(0, 6).map(c => {
    const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    return { code: line(x.code, 12).toUpperCase(), units: int(x.units, 0, 16) };
  }).filter(c => /^[0-9A-Z]{4,6}$/.test(c.code));
  return {
    id: typeof o.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(o.id) ? o.id : "s" + Math.random().toString(36).slice(2, 10),
    date: dateOk(o.date), minutes: int(o.minutes, 0, 480), format: o.format === "group" ? "group" : "individual",
    discipline: DISCIPLINES.indexOf(String(o.discipline)) >= 0 ? String(o.discipline) : "SLP",
    clinician: line(o.clinician, 60), credentials: line(o.credentials, 40),
    goals: lines(o.goals, 8, 300), activities: lines(o.activities, 12, 160),
    subjective: str(o.subjective, 4000), measures, assessment: str(o.assessment, 4000), plan: str(o.plan, 4000),
    codes, cosign: line(o.cosign, 80)
  };
}
export function normalizeLog(raw: unknown, residentId: string): ClinicalLog {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const staging = (Array.isArray(o.staging) ? o.staging : []).slice(-20).map(s => {
    const x = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    return { date: dateOk(x.date), gds: isGds(x.gds) ? String(x.gds) : "", fast: isFast(x.fast) ? String(x.fast) : "", recordedBy: line(x.recordedBy, 80), note: str(x.note, 400) };
  }).filter(s => s.gds || s.fast);
  const sessions = (Array.isArray(o.sessions) ? o.sessions : []).slice(-500).map(normalizeSession);
  return { v: 1, residentId: String(residentId), staging, sessions: sessions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0) };
}
export const latestStaging = (log: ClinicalLog): StagingRecord | null => log.staging.slice().sort((a, b) => a.date < b.date ? -1 : 1).pop() || null;
export const pct = (m: Measure): number | null => m.trials && m.correct != null ? Math.round(m.correct / m.trials * 100) : null;

/* Checks on what was recorded (never on the clinical content itself). */
export interface Check { level: "stop" | "warn" | "info"; text: string; }
export function checkSession(s: Session): Check[] {
  const out: Check[] = [], codes = s.codes.map(c => c.code);
  if (!s.date) out.push({ level: "stop", text: "Add the session date." });
  if (!s.clinician) out.push({ level: "warn", text: "Add who provided the session." });
  if (s.minutes == null) out.push({ level: codes.some(c => (codeRef(c) || { timed: false }).timed) ? "stop" : "warn", text: "Record the session minutes." });
  for (const c of s.codes){
    const ref = codeRef(c.code);
    if (!ref){ out.push({ level: "info", text: `${c.code} is not in this reference; check it against current CPT.` }); continue; }
    if (!ref.cognitive) out.push({ level: "stop", text: `${c.code}: ${ref.note}` });
    if (ref.addOnTo && codes.indexOf(ref.addOnTo) < 0) out.push({ level: "stop", text: `${c.code} is an add-on and is reported with ${ref.addOnTo}.` });
    if (ref.group && s.format !== "group") out.push({ level: "warn", text: `${c.code} is for group sessions; this session is recorded as individual.` });
    if (!ref.group && ref.code === "92507" && s.format === "group") out.push({ level: "warn", text: "92507 is individual; group treatment is 92508." });
    if ((ref.code === "97129" || ref.code === "97130") && s.format === "group") out.push({ level: "warn", text: `${ref.code} is direct one-on-one time; this session is recorded as group.` });
    if (ref.code === "96125" && !s.measures.some(m => /test|assessment|scale|inventory|exam|RIPA|SLUMS|MoCA|BCAT|CLQT|ABCD|SCATBI/i.test(m.task + " " + m.note)))
      out.push({ level: "warn", text: "96125 is standardized testing: name the instrument in the objective section." });
    if (!ref.timed && c.units != null && c.units > 1) out.push({ level: "warn", text: `${c.code} is untimed: one per session.` });
  }
  // units against recorded minutes: arithmetic only; payers set the rules
  const timedUnits = s.codes.reduce((n, c) => { const r = codeRef(c.code); return n + (r && r.timed && r.minutes === 15 ? (c.units == null ? 1 : c.units) : 0); }, 0);
  if (s.minutes != null && timedUnits && timedUnits * 15 - 7 > s.minutes)
    out.push({ level: "warn", text: `${timedUnits} timed 15-minute unit${timedUnits === 1 ? "" : "s"} recorded for ${s.minutes} minutes: check the units against the time.` });
  if (!s.subjective && !s.measures.length && !s.assessment && !s.plan) out.push({ level: "warn", text: "Nothing is recorded in S, O, A or P yet." });
  return out;
}

/* ---------- 4. SOAP blocks: only what was recorded ---------- */
export interface Block { key: "session" | "staging" | "goals" | "S" | "O" | "A" | "P" | "codes" | "checks"; heading: string; paragraphs: string[]; recorded: boolean; }
const NOT = "Not recorded.";
const cueLabel = (c: Cue): string => (CUES.filter(x => x.code === c)[0] || { label: "" }).label;
export function measureLine(m: Measure): string {
  const parts: string[] = [];
  if (m.trials != null) parts.push(m.correct != null ? `${m.correct} of ${m.trials} trials (${pct(m)}%)` : `${m.trials} trials`);
  if (m.cue) parts.push(cueLabel(m.cue).toLowerCase());
  if (m.note) parts.push(m.note);
  return (m.task ? m.task + ": " : "") + (parts.join(", ") || "recorded without numbers") + ".";
}
export interface SoapContext { residentName: string; unit: string; facility: string; staging: StagingRecord | null; profileTier: Tier | null; }
export function soapBlocks(s: Session, ctx: SoapContext): Block[] {
  const who = [s.clinician, s.credentials].filter(Boolean).join(", ");
  const st = ctx.staging, map = st ? tierForStage(st) : null;
  const staging: string[] = st ? [`${map!.basis}${st.date ? ", recorded " + st.date : ""}${st.recordedBy ? " by " + st.recordedBy : ""}.`,
    map!.tier ? `Suggested Cognicopia support: Tier ${map!.tier}${ctx.profileTier ? `; profile uses Tier ${ctx.profileTier}` : ""}.` : ""].filter(Boolean) : [];
  const codeLines = s.codes.map(c => { const r = codeRef(c.code); return `${c.code}${c.units != null ? " × " + c.units : ""}${r ? ": " + r.summary : ""}`; });
  return [
    { key: "session", heading: "Session", recorded: true, paragraphs: [
      [s.date || "Date not recorded", s.minutes != null ? s.minutes + " minutes" : "minutes not recorded", s.format === "group" ? "group" : "individual", s.discipline].join(" · ") + ".",
      who ? "Provided by " + who + "." : "Provider not recorded.",
      s.activities.length ? "Cognicopia materials used: " + s.activities.join("; ") + "." : ""].filter(Boolean) },
    { key: "staging", heading: "Staging on file", recorded: !!st, paragraphs: staging.length ? staging : [NOT] },
    { key: "goals", heading: "Goals addressed", recorded: s.goals.length > 0, paragraphs: s.goals.length ? s.goals.map((g, i) => `${i + 1}. ${g}`) : [NOT] },
    { key: "S", heading: "S · Subjective", recorded: !!s.subjective, paragraphs: s.subjective ? s.subjective.split("\n").filter(Boolean) : [NOT] },
    { key: "O", heading: "O · Objective", recorded: s.measures.length > 0, paragraphs: s.measures.length ? s.measures.map(measureLine) : [NOT] },
    { key: "A", heading: "A · Assessment", recorded: !!s.assessment, paragraphs: s.assessment ? s.assessment.split("\n").filter(Boolean) : [NOT] },
    { key: "P", heading: "P · Plan", recorded: !!s.plan, paragraphs: s.plan ? s.plan.split("\n").filter(Boolean) : [NOT] },
    { key: "codes", heading: "Procedure codes recorded", recorded: s.codes.length > 0, paragraphs: s.codes.length ? codeLines : [NOT] }
  ];
}

/* ---------- 5. Printable pages (US Letter, 0.75 in gutter) ----------
   The notes are laid out by an estimate of their height (Atkinson
   Hyperlegible 11.5 pt on a 7.25 in line holds about 88 characters), and
   a note too long for one page continues on the next. */
const esc = (t: string): string => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
/* Measured in Chromium: the note body is 9.0 in tall; a section heading takes
   about 0.22 in, a line 0.2 in, the gap between sections 0.12 in. The
   estimate keeps 0.6 in to spare. */
export const LAYOUT = { CHARS_PER_LINE: 88, LINE_IN: 0.2, PAGE_BODY_IN: 8.4, HEAD_IN: 0.24, GAP_IN: 0.12, SIGN_IN: 0.8, BOX_IN: 0.15, EMPTY_IN: 0.5 } as const;
const { CHARS_PER_LINE, LINE_IN, PAGE_BODY_IN, HEAD_IN, GAP_IN, SIGN_IN, BOX_IN, EMPTY_IN } = LAYOUT;
function wrap(text: string, n: number): string[] {
  const out: string[] = []; let cur = "";
  for (const w of text.split(" ")){
    if (w.length > n){ if (cur) out.push(cur); for (let i = 0; i < w.length; i += n) out.push(w.slice(i, i + n)); cur = ""; continue; }
    if (cur && (cur + " " + w).length > n){ out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
interface Piece { heading: string; text: string[]; cont: boolean; empty: boolean; }
/* Blocks into pages, split between pages at line boundaries; reserveLast
   keeps room at the end of the last page (the signature lines). */
export function paginate(blocks: Block[], reserveLast = 0): Piece[][] {
  const pages: Piece[][] = [[]]; let used = 0;
  for (const b of blocks){
    const ls = b.paragraphs.flatMap(p => wrap(p, CHARS_PER_LINE));
    const room = (b.recorded ? 0 : EMPTY_IN) + (b.key === "checks" ? BOX_IN : 0);   // room to write by hand under "Not recorded"; the checks' box
    let i = 0, first = true;
    while (i < ls.length){
      const free = PAGE_BODY_IN - used - HEAD_IN - GAP_IN;
      const fit = Math.floor(free / LINE_IN);
      if (fit < 2 && pages[pages.length - 1].length){ pages.push([]); used = 0; continue; }
      const take = Math.max(1, Math.min(ls.length - i, fit));
      pages[pages.length - 1].push({ heading: b.heading, text: ls.slice(i, i + take), cont: !first, empty: !b.recorded });
      used += HEAD_IN + GAP_IN + take * LINE_IN + (i + take >= ls.length ? room : 0);
      i += take; first = false;
      if (i < ls.length){ pages.push([]); used = 0; }
    }
  }
  if (reserveLast && used + reserveLast > PAGE_BODY_IN) pages.push([]);   // the signature lines go on a page of their own
  return pages;
}
export function soapPages(s: Session, ctx: SoapContext): string[] {
  const checks = checkSession(s).filter(c => c.level !== "info");
  const blocks = soapBlocks(s, ctx).concat(checks.length ? [{ key: "checks", heading: "Before signing", recorded: true, paragraphs: checks.map(c => c.text) } as Block] : []);
  const pages = paginate(blocks, SIGN_IN), n = pages.length;
  return pages.map((pieces, k) => `<div class="sheet slp-sheet">
    <div class="slp-head"><div><b>Skilled Session Note (SOAP)</b><span>Confidential: staff and care team only</span></div>
      <div class="slp-who"><b>${esc(ctx.residentName || "Resident")}</b>${ctx.unit ? `<span>Unit ${esc(ctx.unit)}</span>` : ""}<span>${esc(s.date || "")}</span></div></div>
    <div class="slp-body">${pieces.map(p => `<section class="slp-block${p.empty ? " slp-empty" : ""}${p.heading === "Before signing" ? " slp-checks" : ""}"><h3>${esc(p.heading)}${p.cont ? " (continued)" : ""}</h3>${p.text.map(t => `<p>${esc(t)}</p>`).join("")}</section>`).join("")}
    ${k === n - 1 ? `<div class="slp-sign"><span>Signature</span><span>Date</span><span>${s.cosign ? "Co-signed: " + esc(s.cosign) : "Co-signature, if required"}</span></div>` : ""}</div>
    <div class="slp-foot"><span>${esc(ctx.facility || "Cognicopia")} · Every entry was recorded by staff; Cognicopia adds no findings.</span><span>Page ${k + 1} of ${n}</span></div>
  </div>`);
}
/* A summary page for the binder: staging, the tier it suggests, and the sessions in the period. */
export function summaryPage(log: ClinicalLog, ctx: SoapContext, from: string, to: string): string {
  const inRange = log.sessions.filter(s => (!from || s.date >= from) && (!to || s.date <= to));
  const st = latestStaging(log), map = st ? tierForStage(st) : null;
  const mins = inRange.reduce((n, s) => n + (s.minutes || 0), 0);
  const rows = inRange.slice(-24).map(s => `<tr><td>${esc(s.date)}</td><td>${s.minutes != null ? s.minutes : ""}</td><td>${esc(s.discipline)}${s.format === "group" ? " (group)" : ""}</td><td>${esc(s.codes.map(c => c.code + (c.units != null && c.units > 1 ? "×" + c.units : "")).join(", "))}</td><td>${esc(s.measures.map(m => pct(m) != null ? pct(m) + "%" : cueLabel(m.cue)).filter(Boolean).join(", "))}</td></tr>`).join("");
  return `<div class="sheet slp-sheet">
    <div class="slp-head"><div><b>Clinical Summary</b><span>Confidential: staff and care team only</span></div>
      <div class="slp-who"><b>${esc(ctx.residentName || "Resident")}</b>${ctx.unit ? `<span>Unit ${esc(ctx.unit)}</span>` : ""}<span>${esc([from, to].filter(Boolean).join(" to "))}</span></div></div>
    <div class="slp-body">
      <section class="slp-block"><h3>Staging and support tier</h3>${st && map ? `<p>${esc(map.basis)}${st.date ? ", recorded " + esc(st.date) : ""}${st.recordedBy ? " by " + esc(st.recordedBy) : ""}.</p>
        <p>Suggested: ${map.tier ? "Tier " + map.tier : "no tier"}${ctx.profileTier ? `; the profile uses Tier ${ctx.profileTier}` : ""}. ${esc(map.note)}</p>` : `<p>No GDS or FAST stage recorded.</p>`}
        <p class="slp-small">Tier 1: GDS 3-4, FAST 3-4 · Tier 2: GDS 5, FAST 5 · Tier 3: GDS 6, FAST 6a-6e. Stages are recorded by a clinician; Cognicopia never infers them.</p></section>
      <section class="slp-block"><h3>Sessions in this period</h3><p>${inRange.length} session${inRange.length === 1 ? "" : "s"}, ${mins} minutes recorded.</p>
        ${rows ? `<table class="slp-table"><thead><tr><th>Date</th><th>Min</th><th>By</th><th>Codes</th><th>Results recorded</th></tr></thead><tbody>${rows}</tbody></table>` : ""}</section>
    </div>
    <div class="slp-foot"><span>${esc(ctx.facility || "Cognicopia")} · Every entry was recorded by staff; Cognicopia adds no findings.</span><span>Summary</span></div>
  </div>`;
}
