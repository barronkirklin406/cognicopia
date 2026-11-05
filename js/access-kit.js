/* Accessibility kit: color-blind-safe palettes, a dyslexia-friendly font choice, and six micro-tiers with a one-page rapid tier worksheet.

   Palettes. Deuteranopia, protanopia and tritanopia each get a set of four category fills (the conversation deck's Hometown, Career, Music and
   Family tags) and a pair for "went well" and "needs attention". Every palette is checked by simulating that kind of color vision (Machado, Oliveira
   and Fernandes 2009, full severity) and measuring how far apart each pair stays (CIE76 delta E), and every fill still carries black text at 7:1 or
   better. Color is never the only signal: tags also carry a shape, and messages carry a mark.

   Fonts. Atkinson Hyperlegible is the default (/fonts). OpenDyslexic (SIL Open Font License, saved in /fonts) is an option for the screen, and a
   separate option for printed pages, because it is wider and a printed page may fill sooner.

   Micro-tiers. The three support tiers are each split in two, so a resident whose needs sit between two tiers is not forced into the wrong one.
   The rapid tier worksheet is a staff observation guide: eight things staff may already have seen in the resident's ordinary day, each marked
   Not seen, Sometimes or Usually. It never asks the resident to do anything, and it is not an assessment: the person who knows the resident best
   chooses the tier. */

/* ---- color science -------------------------------------------------------------------------------------------------------------------------- */
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const MACHADO = Object.freeze({
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
});
/* linear RGB (0..1) of a #rrggbb color as a person with the given color vision sees it; null or "normal" is ordinary vision */
export function simulate(hex, kind) {
  const l = hex3(hex).map(lin), m = MACHADO[kind]; if (!m) return l;
  return m.map((r) => Math.min(1, Math.max(0, r[0] * l[0] + r[1] * l[1] + r[2] * l[2])));
}
const toLab = ([r, g, b]) => {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116), fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
export function deltaE(a, b, kind) { const A = toLab(simulate(a, kind)), B = toLab(simulate(b, kind)); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
export const luminance = (hex) => { const [r, g, b] = hex3(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/* the smallest delta E between any two of the colors, as seen with the given color vision */
export function minSeparation(colors, kind) { let m = Infinity; for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) m = Math.min(m, deltaE(colors[i], colors[j], kind)); return m; }

/* ---- palettes ------------------------------------------------------------------------------------------------------------------------------- */
export const CATEGORIES = Object.freeze(["hometown", "career", "music", "family"]);
export const PAPER = "#f7f4ec";   // the page color the message marks sit on
export const PALETTES = Object.freeze({
  standard: { label: "Standard", kind: null, cats: { hometown: "#cfe8e5", career: "#f6cdb4", music: "#dfe0f7", family: "#f3e6b3" }, ok: "#0b4f48", bad: "#8a3300" },
  deuteranopia: { label: "Deuteranopia (red-green, no green cones)", kind: "deuteranopia", cats: { hometown: "#56B4E9", career: "#E69F00", music: "#F4A582", family: "#FFFFFF" }, ok: "#0b4f8a", bad: "#8a3300" },
  protanopia: { label: "Protanopia (red-green, no red cones)", kind: "protanopia", cats: { hometown: "#56B4E9", career: "#F0E442", music: "#FFFFFF", family: "#B2DF8A" }, ok: "#0b4f8a", bad: "#8a3300" },
  tritanopia: { label: "Tritanopia (blue-yellow)", kind: "tritanopia", cats: { hometown: "#56B4E9", career: "#E69F00", music: "#B8E186", family: "#FFD966" }, ok: "#005a51", bad: "#8a1c1c" }
});
export const paletteOf = (id) => PALETTES[id] || PALETTES.standard;

/* ---- fonts ---------------------------------------------------------------------------------------------------------------------------------- */
export const FONTS = Object.freeze({ atkinson: { label: "Atkinson Hyperlegible (default)" }, opendyslexic: { label: "OpenDyslexic", file: "fonts/OpenDyslexic-Regular.woff2", license: "fonts/OFL-OpenDyslexic.txt" } });

/* ---- saved choices -------------------------------------------------------------------------------------------------------------------------- */
export const PREFS_KEY = "cognicopia_access_prefs";
export const DEFAULT_PREFS = Object.freeze({ palette: "standard", font: "atkinson", printFont: false });
export function normalizePrefs(raw) { const r = raw && typeof raw === "object" ? raw : {}; return { palette: PALETTES[r.palette] ? r.palette : "standard", font: FONTS[r.font] ? r.font : "atkinson", printFont: r.printFont === true && r.font === "opendyslexic" }; }
export function readPrefs(store) { try { const t = store.getItem(PREFS_KEY); return normalizePrefs(t ? JSON.parse(t) : null); } catch (e) { return normalizePrefs(null); } }
export function savePrefs(store, prefs) { const p = normalizePrefs(prefs); try { store.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { return null; } return p; }
/* put the choices on the page: attributes and custom properties on <html>, which css/styles.css uses */
export function apply(doc, prefs) {
  const p = normalizePrefs(prefs), el = doc && doc.documentElement; if (!el) return p; const pal = paletteOf(p.palette);
  if (p.palette === "standard") el.removeAttribute("data-cg-cb"); else el.setAttribute("data-cg-cb", p.palette);
  for (const c of CATEGORIES) el.style.setProperty("--cg-cat-" + c, pal.cats[c]); el.style.setProperty("--cg-cb-ok", pal.ok); el.style.setProperty("--cg-cb-bad", pal.bad);
  if (p.font === "atkinson") { el.removeAttribute("data-cg-font"); el.removeAttribute("data-cg-font-print"); } else { el.setAttribute("data-cg-font", p.font); if (p.printFont) el.setAttribute("data-cg-font-print", "1"); else el.removeAttribute("data-cg-font-print"); }
  return p;
}

/* ---- micro-tiers ---------------------------------------------------------------------------------------------------------------------------- */
/* tier: the existing support tier (1 full detail, 2 guided, 3 simplified). The other fields are what a page can use to adjust itself:
   fontScale and lineThicknessPt are the values the print engine already reads from a profile (visualNeeds); itemShare is the share of a full
   page's items to include; choices is how many options an item offers; cues is how many prompts or reminders to print on the page. */
export const MICRO_TIERS = Object.freeze({
  "1a": { tier: 1, label: "1a Full detail, independent", fontScale: 1, lineThicknessPt: 2, itemShare: 1, choices: 4, cues: 0, summary: "Works through a full page with little help." },
  "1b": { tier: 1, label: "1b Full detail, with light support", fontScale: 1, lineThicknessPt: 2, itemShare: 0.8, choices: 4, cues: 1, summary: "Does well with a full page and an occasional reminder." },
  "2a": { tier: 2, label: "2a Guided, upper", fontScale: 1.15, lineThicknessPt: 3, itemShare: 0.65, choices: 3, cues: 1, summary: "Enjoys a guided page with larger print and fewer items." },
  "2b": { tier: 2, label: "2b Guided, lower", fontScale: 1.15, lineThicknessPt: 3, itemShare: 0.5, choices: 3, cues: 2, summary: "Needs fewer items, more space and a cue on the page." },
  "3a": { tier: 3, label: "3a Simplified, upper", fontScale: 1.3, lineThicknessPt: 3, itemShare: 0.35, choices: 2, cues: 2, summary: "Does best with one clear thing to do, in very large print." },
  "3b": { tier: 3, label: "3b Simplified, sensory", fontScale: 1.3, lineThicknessPt: 4, itemShare: 0.2, choices: 2, cues: 3, summary: "Does best with a single large focus, thick lines and company." }
});
export const MICRO_ORDER = Object.freeze(["1a", "1b", "2a", "2b", "3a", "3b"]);
export const isMicro = (m) => Object.prototype.hasOwnProperty.call(MICRO_TIERS, m);
export const settingsFor = (m) => MICRO_TIERS[isMicro(m) ? m : "2a"];
/* the eight things staff may have seen; each is marked 0 Not seen, 1 Sometimes, 2 Usually */
export const OBSERVATIONS = Object.freeze([
  { id: "two-step", text: "Follows a two-step spoken request, such as “pick up the cup and bring it here”." },
  { id: "reads", text: "Reads a short line of large print, or follows it with a finger." },
  { id: "stays", text: "Stays with a table activity for about ten minutes." },
  { id: "sorts", text: "Matches or sorts pictures or objects by one thing, such as color." },
  { id: "marks", text: "Holds a pencil or crayon and makes marks inside a shape." },
  { id: "sings", text: "Joins in a familiar song or saying." },
  { id: "knows", text: "Responds to their own name and to familiar faces." },
  { id: "busy", text: "Takes part in a busy or noisy room for about fifteen minutes." }
]);
export const SCORE_MAX = OBSERVATIONS.length * 2;
export const BANDS = Object.freeze([["1a", 14, 16], ["1b", 11, 13], ["2a", 8, 10], ["2b", 5, 7], ["3a", 2, 4], ["3b", 0, 1]]);
/* answers: { observationId: 0 | 1 | 2 } -> { score, answered, micro, complete }. An unanswered line counts as Not seen and is reported. */
export function suggestMicro(answers) {
  const a = answers && typeof answers === "object" ? answers : {}; let score = 0, answered = 0;
  for (const o of OBSERVATIONS) { const v = a[o.id]; if (v === 0 || v === 1 || v === 2) { score += v; answered++; } }
  const band = BANDS.find((b) => score >= b[1] && score <= b[2]);
  return { score, answered, complete: answered === OBSERVATIONS.length, micro: band ? band[0] : "3b" };
}
/* write the choice onto a saved resident profile (tier1_core): the micro-tier, the tier it belongs to, and the print values the engine reads. Returns a new object. */
export function applyMicroToProfile(profile, micro, now = new Date()) {
  const s = settingsFor(micro), p = JSON.parse(JSON.stringify(profile || {})); const t1 = p.tier1_core && typeof p.tier1_core === "object" ? p.tier1_core : (p.tier1_core = {});
  t1.microTier = isMicro(micro) ? micro : "2a"; t1.cognitiveTier = s.tier;
  const v = t1.visualNeeds && typeof t1.visualNeeds === "object" ? t1.visualNeeds : (t1.visualNeeds = {}); v.fontSizeScale = s.fontScale; v.lineThicknessPt = s.lineThicknessPt; if (!v.contrastMode) v.contrastMode = s.tier === 3 ? "high_contrast" : "standard";
  p.updatedAt = now.toISOString(); return p;
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* The one-page worksheet, US Letter, pure black on white, with boxes to tick by hand. ctx: { who, facility } */
export function worksheetPage(ctx = {}) {
  const c = ctx || {}, box = '<span class="rt-box" aria-hidden="true"></span>';
  return `<div class="sheet rt-sheet"><header class="tr-head"><p class="tr-kicker">Rapid tier worksheet</p><h1>${esc(c.who || "Resident")}</h1><p>${esc(c.facility || "")}${c.facility ? " &middot; " : ""}Date: ____________ &nbsp; Completed by: ____________</p></header>
    <p class="rt-intro">Think about what you have already seen in this person&rsquo;s ordinary days. Tick one box for each line. Nothing needs to be tried or tested, and the person is never asked to do anything.</p>
    <table class="tr-table rt-table"><thead><tr><th scope="col">What you may have seen</th><th scope="col">Not seen<br><small>0</small></th><th scope="col">Sometimes<br><small>1</small></th><th scope="col">Usually<br><small>2</small></th></tr></thead><tbody>${OBSERVATIONS.map((o) => `<tr><td>${esc(o.text)}</td><td>${box}</td><td>${box}</td><td>${box}</td></tr>`).join("")}</tbody></table>
    <p class="rt-total"><b>Total:</b> ______ of ${SCORE_MAX}</p>
    <table class="tr-table rt-table"><thead><tr><th scope="col">Total</th><th scope="col">Micro-tier</th><th scope="col">What it means for the pages</th></tr></thead><tbody>${BANDS.map(([m, lo, hi]) => `<tr><td>${lo === hi ? lo : lo + " to " + hi}</td><td><b>${esc(MICRO_TIERS[m].label)}</b></td><td>${esc(MICRO_TIERS[m].summary)}</td></tr>`).join("")}</tbody></table>
    <p class="tr-note">A guide for staff, not an assessment. The person who knows the resident best chooses the tier, and can move it up or down at any time.</p>
    <footer class="tr-foot"><span>${esc(c.facility || "Cognicopia")} &middot; Rapid tier worksheet</span><b>Page 1 of 1</b></footer></div>`;
}
