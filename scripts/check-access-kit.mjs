#!/usr/bin/env node
/* js/access-kit.js: the color-blind palettes are checked by simulating each kind of color vision (pairs stay apart, black text stays at 7:1, the
   message marks stay readable on the page color), the saved choices and their effect on the page, the OpenDyslexic files and license, the six
   micro-tiers, the rapid tier worksheet's scoring, and what is written to a profile. */
import fs from "node:fs";
import * as K from "../js/access-kit.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const css = fs.readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
for (const id of ["deuteranopia", "protanopia", "tritanopia"]) {
  const P = K.PALETTES[id], fills = K.CATEGORIES.map((c) => P.cats[c]), sep = K.minSeparation(fills, P.kind), std = K.minSeparation(K.CATEGORIES.map((c) => K.PALETTES.standard.cats[c]), P.kind);
  ok(sep >= 25, id + ": the four category fills stay apart for that color vision (smallest difference " + sep.toFixed(1) + ", where about 20 is clearly different)");
  ok(sep > std + 10, id + ": that is a real improvement on the standard fills (" + sep.toFixed(1) + " against " + std.toFixed(1) + ")");
  ok(fills.every((f) => K.contrast(f, "#000000") >= 7), id + ": black text on every fill is 7:1 or better (lowest " + Math.min(...fills.map((f) => K.contrast(f, "#000000"))).toFixed(1) + ")");
  ok(K.contrast(P.ok, K.PAPER) >= 7 && K.contrast(P.bad, K.PAPER) >= 7, id + ": the two message colors are 7:1 or better on the page (" + K.contrast(P.ok, K.PAPER).toFixed(1) + ", " + K.contrast(P.bad, K.PAPER).toFixed(1) + ")");
  ok(K.deltaE(P.ok, P.bad, P.kind) >= 20, id + ": the two message colors are told apart (" + K.deltaE(P.ok, P.bad, P.kind).toFixed(1) + ")");
}
const S = K.PALETTES.standard; ok(K.CATEGORIES.every((c) => K.contrast(S.cats[c], "#000000") >= 7) && K.contrast(S.ok, K.PAPER) >= 7 && K.contrast(S.bad, K.PAPER) >= 7, "the standard palette also keeps black text and its message colors at 7:1");
ok(K.deltaE("#000000", "#ffffff") > 99 && K.deltaE("#336699", "#336699") === 0 && Math.abs(K.contrast("#000000", "#ffffff") - 21) < 0.01, "the color arithmetic is right (black and white are 21:1, delta E about 100)");
const sd = K.simulate("#ff0000", "deuteranopia"), sp = K.simulate("#00ff00", "protanopia"); ok(sd[0] < 0.6 && sd[1] > 0.1 && K.simulate("#808080", "tritanopia").every((v) => Math.abs(v - 0.2159) < 0.02), "the simulation darkens red for deuteranopia and leaves grey alone");
/* choices */
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)) }; };
const st = mem(); ok(JSON.stringify(K.readPrefs(st)) === JSON.stringify(K.DEFAULT_PREFS), "with nothing saved the defaults apply");
ok(K.savePrefs(st, { palette: "tritanopia", font: "opendyslexic", printFont: true }).printFont === true && K.readPrefs(st).palette === "tritanopia", "choices are saved and read back");
ok(K.normalizePrefs({ palette: "x", font: "comic", printFont: true }).palette === "standard" && K.normalizePrefs({ palette: "x", font: "atkinson", printFont: true }).printFont === false && K.readPrefs({ getItem: () => "{bad" }).font === "atkinson", "unknown choices fall back, and the print font needs the OpenDyslexic choice");
const doc = { documentElement: { attrs: {}, style: { p: {}, setProperty(k, v) { this.p[k] = v; } }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } } };
K.apply(doc, { palette: "protanopia", font: "opendyslexic", printFont: true }); const el = doc.documentElement;
ok(el.attrs["data-cg-cb"] === "protanopia" && el.attrs["data-cg-font"] === "opendyslexic" && el.attrs["data-cg-font-print"] === "1" && el.style.p["--cg-cat-career"] === "#F0E442" && el.style.p["--cg-cb-ok"], "the choices become attributes and color variables on the page");
K.apply(doc, null); ok(!("data-cg-cb" in el.attrs) && !("data-cg-font" in el.attrs) && el.style.p["--cg-cat-career"] === "#f6cdb4", "choosing standard removes them again");
/* the font files and the style rules that use them */
ok(fs.existsSync("fonts/OpenDyslexic-Regular.woff2") && fs.existsSync("fonts/OpenDyslexic-Bold.woff2") && /SIL OPEN FONT LICENSE/.test(fs.readFileSync("fonts/OFL-OpenDyslexic.txt", "utf8")), "the OpenDyslexic files are saved in the repository with their license");
ok(/@font-face\s*\{[^}]*OpenDyslexic[^}]*OpenDyslexic-Regular\.woff2/.test(css) && /data-cg-font="opendyslexic"/.test(css) && /var\(--cg-cat-hometown/.test(css) && /data-cg-cb\] \.msg-ok::before/.test(css), "the stylesheet loads the font from this site and uses the palette variables and message marks");
ok(!/https?:\/\/[^"')\s]*(fonts\.googleapis|cdn)/i.test(css), "no outside font address is in the stylesheet");
/* micro-tiers */
ok(K.MICRO_ORDER.length === 6 && K.MICRO_ORDER.every(K.isMicro) && !K.isMicro("4a") && K.settingsFor("zz").tier === 2, "there are six micro-tiers, and an unknown one falls back to 2a");
const T = K.MICRO_ORDER.map((m) => K.MICRO_TIERS[m]); ok(T.every((t, i) => i === 0 || (t.itemShare < T[i - 1].itemShare && t.fontScale >= T[i - 1].fontScale && t.cues >= T[i - 1].cues && t.tier >= T[i - 1].tier)), "each micro-tier asks for fewer items, the same or larger print and the same or more cues than the one before");
ok(T.map((t) => t.tier).join() === "1,1,2,2,3,3" && T.every((t) => [1, 1.15, 1.3].includes(t.fontScale) && [2, 3, 4].includes(t.lineThicknessPt)), "each tier is split in two, and the print values are ones the print engine accepts");
const covered = Array.from({ length: K.SCORE_MAX + 1 }, (_, n) => K.BANDS.filter((b) => n >= b[1] && n <= b[2]).length); ok(covered.every((c) => c === 1) && K.SCORE_MAX === 16, "every possible total from 0 to 16 falls in exactly one micro-tier");
const ans = (v) => Object.fromEntries(K.OBSERVATIONS.map((o) => [o.id, v]));
ok(K.suggestMicro(ans(2)).micro === "1a" && K.suggestMicro(ans(0)).micro === "3b" && K.suggestMicro(ans(1)).micro === "2a" && K.suggestMicro(ans(1)).score === 8 && K.suggestMicro(ans(1)).complete, "all Usually gives 1a, all Sometimes gives 2a, all Not seen gives 3b");
const mix = K.suggestMicro({ "two-step": 2, reads: 2, stays: 2, sorts: 2, marks: 1, sings: 1, knows: 1, busy: 0 }); ok(mix.score === 11 && mix.micro === "1b", "a mixed set of answers is added up (" + mix.score + " gives " + mix.micro + ")");
const part = K.suggestMicro({ "two-step": 2 }); ok(part.score === 2 && !part.complete && part.answered === 1 && K.suggestMicro(null).micro === "3b" && K.suggestMicro({ "two-step": 9, reads: -1 }).score === 0, "unanswered or impossible answers count as Not seen, and the result says it is not complete");
const prof = { id: "r1", tier1_core: { preferredName: "Peg", cognitiveTier: 1, visualNeeds: { contrastMode: "standard", fontSizeScale: 1, lineThicknessPt: 2 } }, secret: { keep: true } }, out = K.applyMicroToProfile(prof, "3b", new Date("2026-11-10T12:00:00Z"));
ok(out.tier1_core.microTier === "3b" && out.tier1_core.cognitiveTier === 3 && out.tier1_core.visualNeeds.fontSizeScale === 1.3 && out.tier1_core.visualNeeds.lineThicknessPt === 4 && out.tier1_core.visualNeeds.contrastMode === "standard" && out.secret.keep && out.tier1_core.preferredName === "Peg", "choosing 3b sets the tier and print values and leaves the rest of the profile alone");
ok(prof.tier1_core.cognitiveTier === 1 && K.applyMicroToProfile(null, "1a").tier1_core.microTier === "1a" && K.applyMicroToProfile({}, "nope").tier1_core.microTier === "2a", "the original is not changed, and a missing profile or unknown tier is handled");
const page = K.worksheetPage({ who: "Resident 204", facility: "Maple Grove" });
ok((page.match(/class="sheet /g) || []).length === 1 && K.OBSERVATIONS.every((o) => page.includes(o.text.slice(0, 30).replace(/&/g, "&amp;").replace(/“/g, "“"))) && (page.match(/rt-box/g) || []).length === 24 && K.MICRO_ORDER.every((m) => page.includes(K.MICRO_TIERS[m].label)) && /not an assessment/.test(page) && /never asked to do anything/.test(page) && /Page 1 of 1/.test(page), "the worksheet is one page with eight lines of three boxes, the scoring table and its caution");
ok(!/<script/i.test(K.worksheetPage({ who: "<script>x</script>" })), "markup in a name is escaped");
if (problems.length) { console.error("access kit check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("access kit check passed: " + passed + " checks (simulated color vision, contrast, choices, font files, six micro-tiers, rapid worksheet)");
