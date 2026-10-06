#!/usr/bin/env node
/* =====================================================================
   Checks for Clinical & Caregiver Alignment (resources/clinical-alignment/index.html): a four-tab console with the
   tripartite clinical framework, a CMS crosswalk and evidence sheet, a line-weight / type-size / contrast simulator, and
   an activity selector matrix with a three-page evidence packet. Node built-ins only.

     1. the tabs follow the ARIA tabs pattern, and every tab has its panel
     2. the page loads nothing from another site and makes no network call of its own
     3. the page's tables agree with the rulebook the print engine reads (src/engine/ClinicalMatrix.js): the stages
        every activity category is made for, the type and line floors, and the dignity filter on its sample text
     4. the rule text is word for word the text the Research Center quotes; four objectives, each with its evidence
     5. what the page keeps is sealed by the encrypted store
     6. the simulator's arithmetic: a heavier line never does worse, and the contrast ratios are right
     7. print: US Letter, the 0.65 in gutter, 0.5 in margins, nothing but the sheet prints, pure black
     8. the colour pairs meet 7:1; no claim the product cannot back
   (Whether each printed page fits its sheet is measured in a browser, not here.)
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const html = read("resources/clinical-alignment/index.html");
const main = html.slice(html.indexOf('<main class="container"'), html.indexOf("</main>"));
const css = (/<style>([\s\S]*?)<\/style>/.exec(html) || [])[1] || "";
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.sort((a, b) => b.length - a.length)[0] || "";
const jsNoWrap = js.replace(/\/\*[\s\S]*?\*\//g, "");
const between = (a, b) => { const i = js.indexOf(a), j = js.indexOf(b, i); return i >= 0 && j > i ? js.slice(i, j) : ""; };

/* 1. tabs */
const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(m => m[0]);
ok(/role="tablist"/.test(html), "there is a tablist");
ok(tabs.length === 4, "there are four tabs (" + tabs.length + ")");
["Tripartite Clinical Framework", "CMS Regulatory Crosswalk & Survey Engine", "Ergonomic & Vision Calibration Simulator", "Surveyor Evidence Packet Generator"]
  .forEach(n => ok(html.replace(/&amp;/g, "&").indexOf(n) >= 0, `the tab "${n}" is there`));
ok(tabs.filter(t => /aria-selected="true"/.test(t)).length === 1, "exactly one tab is selected");
ok(tabs.filter(t => /tabindex="0"/.test(t)).length === 1 && tabs.filter(t => /tabindex="-1"/.test(t)).length === 3, "one tab is in the tab order (roving tabindex)");
tabs.forEach(t => {
  const id = (/id="([^"]+)"/.exec(t) || [])[1], ctl = (/aria-controls="([^"]+)"/.exec(t) || [])[1];
  const panel = ctl && new RegExp(`<section[^>]*id="${ctl}"[^>]*>`).exec(html);
  ok(!!panel && /role="tabpanel"/.test(panel[0]) && new RegExp(`aria-labelledby="${id}"`).test(panel[0]), `tab ${id} controls a panel that names it`);
});
ok([...main.matchAll(/role="tabpanel"[^>]*\bhidden\b/g)].length === 3, "the three panels that are not showing are hidden");
ok(/ArrowRight/.test(js) && /ArrowLeft/.test(js) && /"Home"/.test(js) && /"End"/.test(js), "the arrow keys, Home and End move between tabs");
ok(/class="skip-link"/.test(html) && /<main /.test(html), "a skip link and a main landmark");
ok(/role="radiogroup"/.test(main) && (main.match(/<fieldset/g) || []).length >= 4, "the simulator's and the picker's controls are grouped in fieldsets");
ok(/role="status"/.test(main) && /aria-live="polite"/.test(main), "changes are announced in live regions");

/* 2. no network */
ok(![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some(m => /^(https?:)?\/\//.test(m[1])), "no script comes from another site");
ok(![...html.matchAll(/<link[^>]+href="([^"]+)"/g)].some(m => /^(https?:)?\/\//.test(m[1])), "no stylesheet comes from another site");
ok(!/@import\s+url\(\s*['"]?https?:/.test(css), "no CSS import from another site");
ok(!/\bfetch\s*\(/.test(jsNoWrap.replace(/window\.fetch|var f = window\.fetch|f\.apply/g, "")) && !/new\s+XMLHttpRequest|sendBeacon\s*\(/.test(jsNoWrap), "the page's script makes no network call");
ok(/Net\s*=/.test(js) && /requests: function/.test(js), "the page counts its own network use for the badge");
ok(/ClinicalMatrix\.js/.test(html) && fs.existsSync(path.join(ROOT, "src/engine/ClinicalMatrix.js")) && /secureStore\.js/.test(html), "the rulebook and the encrypted store are loaded from this site");
ok(html.indexOf("ClinicalMatrix.js") < html.indexOf("var Net = "), "the rulebook loads before the page script");

/* 3. the page's tables against the rulebook */
const CM = (() => {
  const sb = { window: {}, self: {} }; sb.window = sb; sb.self = sb; vm.createContext(sb);
  vm.runInContext(read("src/engine/ClinicalMatrix.js"), sb, { filename: "ClinicalMatrix.js" });
  return sb.CognicopiaClinicalMatrix;
})();
const dataJs = between("var F679 = ", "  /* ───────── 2. tabs");
const D = (() => { const sb = {}; vm.createContext(sb); try { vm.runInContext(dataJs + "\n;this.__d = { F679, F744, OBJECTIVES, MATRIX, FLOORS, SIM_TEXT, STAGE_OF_FILTER, GOAL_NAME, FILTER_STAGE };", sb); } catch (e) { problems.push("the page's data does not run: " + e.message); } return sb.__d || {}; })();
ok(!!CM && !!D.MATRIX, "the rulebook and the page's data both load");
if (CM && D.MATRIX) {
  ok(D.MATRIX.length === 13, "the matrix lists 13 activity categories (" + D.MATRIX.length + ")");
  D.MATRIX.forEach(r => {
    ["early", "middle", "late"].forEach(k => {
      let any = false; r.ids.forEach(id => r.tools.forEach(t => { const e = CM.entry(t, id); if (e && e.stages[k]) any = true; }));
      ok(any === (r.st.indexOf(k) >= 0), `"${r.name}" at the ${k} stage: the page says ${r.st.indexOf(k) >= 0}, the rulebook says ${any}`);
    });
    r.ids.forEach(id => r.tools.forEach(t => ok(!!CM.entry(t, id), `the rulebook knows ${t}:${id}`)));
    ok(r.goals.length >= 1 && r.goals.every(g => D.GOAL_NAME[g]), `"${r.name}" names only the four clinical goals`);
    ok(r.name.length > 0 && r.use.length > 20, `"${r.name}" says what it is for`);
    ok(CM.dignity.lint(r.name).length === 0 && CM.dignity.lint(r.use).length === 0, `"${r.name}" passes the dignity filter`);
  });
  ["early", "middle", "late"].forEach(st => ["reminiscence", "motor", "temporal", "sensory"].forEach(g => {
    ok(D.MATRIX.some(r => r.st.indexOf(st) >= 0 && r.goals.indexOf(g) >= 0), `the filters never come up empty: ${st} + ${g}`);
  }));
  ok(D.STAGE_OF_FILTER.mci === "early", "MCI uses the early stage");
  Object.keys(D.FLOORS).forEach(k => {
    ok(CM.STAGES[k].type.floor === D.FLOORS[k].type, `the ${k} type floor is ${CM.STAGES[k].type.floor} pt in the rulebook`);
    ok(CM.STAGES[k].stroke.min === D.FLOORS[k].line, `the ${k} line floor is ${CM.STAGES[k].stroke.min} pt in the rulebook`);
    const cell = t => (new RegExp(`data-floor="${k}-${t}">([^<]*)<`).exec(main) || [])[1] || "";
    ok(parseFloat(cell("type")) === CM.STAGES[k].type.floor, `the stage table's ${k} type cell matches the rulebook (${cell("type")})`);
    ok(parseFloat(cell("line")) === CM.STAGES[k].stroke.min, `the stage table's ${k} line cell matches the rulebook (${cell("line")})`);
  });
  ok(/data-floor="late-type">24 pt, always bold/.test(main), "the late stage type is bold");
  (D.SIM_TEXT || []).forEach(t => ok(CM.dignity.lint(t).length === 0, `the simulator's sample line "${t}" passes the dignity filter`));
}

/* 4. the rule text, and the four objectives */
const rc = read("src/services/researchCenter.ts").replace(/\s+/g, " ");
const squash = s => String(s || "").replace(/\s+/g, " ").trim();
ok(!!D.F679 && rc.indexOf(squash(D.F679.text)) >= 0, "the Tag F679 quotation is word for word the Research Center's");
ok(!!D.F744 && rc.indexOf(squash(D.F744.text)) >= 0, "the Tag F744 quotation is word for word the Research Center's");
const f550 = "A facility must treat each resident with respect and dignity and care for each resident in a manner and in an environment that promotes maintenance or enhancement of his or her quality of life, recognizing each resident’s individuality.";
const decode = x => x.replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;|&rdquo;/g, "").replace(/&amp;/g, "&");
ok(rc.indexOf(f550) >= 0 && decode(main).replace(/<[^>]+>/g, "").indexOf(f550) >= 0, "the Tag F550 quotation is word for word the Research Center's");
const OBJ = D.OBJECTIVES || [];
ok(OBJ.length === 4 && new Set(OBJ.map(o => o.id)).size === 4, "there are four objectives");
["Individualized Life History Cues", "Sundowning Anxiety Reduction", "Fine-Motor Tremor Engagement", "MDS 3.0 Person-Centered Choice"].forEach(t => ok(OBJ.some(o => o.title === t), `the objective "${t}" is there`));
OBJ.forEach(o => {
  ok(o.evidence.length === 4, `${o.id} has four evidence items`);
  ok(o.quotes.length >= 1 && o.quotes.every(q => /Tag F\d{3}/.test(q.ref) && /483\./.test(q.ref)), `${o.id} cites its rule`);
  ok(o.asks && o.looks && o.module && o.team && o.links.length >= 1, `${o.id} has the plain-words, surveyor, module, team and link fields`);
  o.links.forEach(l => { const href = l[1].split("#")[0]; ok(fs.existsSync(path.join(ROOT, "resources/clinical-alignment", href)), `${o.id}'s link ${l[1]} resolves`); });
  ok(["life", "sundown", "motor", "choice"].some(i => i === o.id) && new RegExp(`id="ca-obj-${o.id}"`).test(main), `${o.id} has its radio button`);
  [o.asks, o.looks, o.module, ...o.evidence, o.team].forEach(t => { if (CM && CM.dignity.lint(t).length) problems.push(`${o.id}: "${t.slice(0, 40)}…" fails the dignity filter: ${CM.dignity.lint(t).join(", ")}`); else passed++; });
});

/* 5. what the page keeps */
const KEY = (/var KEY = "([^"]+)"/.exec(js) || [])[1] || "";
const store = read("assets/services/secureStore.js"), storeTs = read("src/services/secureStore.ts");
ok(!!KEY && /"cognicopia_alignment"/.test(store) && /"cognicopia_alignment"/.test(storeTs) && KEY.indexOf("cognicopia_alignment") === 0, `the page's storage name (${KEY}) is sealed by the encrypted store`);
ok(/CogniSecureStore/.test(js) && /promptUnlock/.test(js), "the page uses the encrypted store and can ask for the passphrase");
ok(read("docs/privacy-and-storage.md").indexOf(KEY) >= 0, "the privacy document lists what this page keeps");
ok(/Do not type resident names here/.test(main) && !/type="text"[^>]*id="ca(Resident|Name)"/.test(main), "the page asks for no resident name");
ok(/never a resident|nothing about a resident/i.test(read("docs/privacy-and-storage.md").split("\n").filter(l => l.indexOf(KEY) >= 0).join(" ")), "the privacy document says the page keeps nothing about a resident");

/* 6. the simulator's arithmetic */
const mathJs = between("    var lum = function", "    var BODY = ");
const wobJs = between("    var wobble = ", "    function penPath");
const M = (() => { const sb = {}; vm.createContext(sb); try { vm.runInContext("var TIP = 3;\n" + mathJs + "\n" + wobJs + "\n;this.__m = { ratio: ratio, onLine: onLine, SAMPLES: SAMPLES };", sb); } catch (e) { problems.push("the simulator's arithmetic does not run: " + e.message); } return sb.__m || {}; })();
if (M.ratio) {
  ok(Math.abs(M.ratio("#000000", "#ffffff") - 21) < 0.01, "pure black on white is 21:1");
  ok(M.ratio("#767676", "#ffffff") >= 4.5 && M.ratio("#767676", "#ffffff") < 4.6, "the faded copy is the 4.5:1 minimum");
  for (let a = 0; a <= 6; a += 0.25) ok(M.onLine(2.5, a) >= M.onLine(0.75, a), `at a tremor of ${a} pt a 2.5 pt line is never worse than a 0.75 pt line`);
  ok(M.onLine(0.75, 0) === 100 && M.onLine(2.5, 0) === 100, "a steady hand stays on either line");
  ok(M.onLine(2.5, 3) - M.onLine(0.75, 3) >= 15, "at the default tremor (3 pt) the reinforced line holds the pen on the line for at least 15 points more of the path");
  ok(M.onLine(0.75, 6) < M.onLine(0.75, 1), "more tremor means less of the path on the line");
}
ok(/value="0\.75"/.test(main) && /value="2\.5"/.test(main) && /value="12"/.test(main) && /value="18"/.test(main) && /value="24"/.test(main), "the simulator offers 0.75 and 2.5 pt lines and 12, 18 and 24 pt type");
ok(/Standard \(faded copy\)/.test(main) && /Pure black #000000/.test(main), "the simulator offers standard and pure black contrast");
ok(/Math\.random/.test(jsNoWrap.replace(/"cognicopia-selftest-" \+ Math\.random\(\)\.toString\(36\)\.slice\(2\)/, "")) === false, "the simulator draws no random number (the same setting always draws the same path)");

/* 7. print */
ok(/@page\s*\{[^}]*size:\s*8\.5in 11in/.test(css), "the page is US Letter");
ok(/--gutter:\s*0\.65in/.test(css) && /padding:\s*\.5in \.5in \.5in var\(--gutter\)/.test(css), "printed sheets keep a 0.65 in gutter and 0.5 in margins");
const pr = css.slice(css.indexOf("@media print"));
ok(/\.cg-sidebar[\s\S]*display:\s*none\s*!important/.test(pr) && /\.ca-tabs/.test(pr) && /\.ca-btn/.test(pr) && /\.cg-topbar/.test(pr) && /\.cg-crumbs/.test(pr) && /\.ca-cover/.test(pr) && /\.ca-seg/.test(pr), "printing hides the sidebar, top bar, breadcrumbs, tabs, buttons and controls");
ok(/body\[data-print="sheet"\]\s*>\s*\*:not\(#caPrintRoot\)/.test(pr), "printing a sheet prints only the sheet");
ok(/size: 8\.5in 11in; margin: 0;/.test(js), "a sheet prints edge to edge so it can keep its own gutter");
ok(/\.ca-doc\.is-page\s*\{[^}]*height:\s*11in/.test(css) && /\.d-body\s*\{[^}]*overflow:\s*hidden/.test(css), "a printed page is exactly one US Letter sheet and its body is held inside it");
ok(/border: 2pt solid #000/.test(css) && !/border:\s*[0-9.]*(0\.[0-9]+|1)pt solid #000[^}]*\.ca-doc/.test(css), "a printed page's rules are 2 pt and heavier");
ok(/viewBox="0 0 612 792"/.test(js) && /A. A standard line \(0\.75 pt\)/.test(js) && /\(2\.5 pt\)/.test(js), "the comparison handout is drawn in points, with the 0.75 pt and 2.5 pt pages side by side");
ok(/\.ca-doc \.d-small, \.ca-doc \.d-small \*\s*\{[^}]*font-size:\s*10pt/.test(css) && /\.d-foot\s*\{[^}]*font-size:\s*10pt/.test(css), "staff text on a printed page is 10 pt and above");
ok(/Page " \+ n \+ " of " \+ total/.test(js), "every printed page says \"Page X of Y\"");
ok(/Print\.sheets\(pages\(\)/.test(js) && /Print\.sheets\(\[sheet\(\)\]/.test(js) && /Print\.sheets\(\[compareSheet\(\)\]/.test(js), "the evidence sheet, the packet and the handout each have a print button");
ok(/Generate Surveyor Evidence Sheet/.test(main) && /Generate Surveyor Evidence Packet/.test(main), "the two generator buttons are named as the tools call them");
ok(/id="caStageSel"/.test(main) && /id="caGoalSel"/.test(main) && ["MCI", "Early-Stage", "Mid-Stage", "Late-Stage / Sensory", "Reminiscence", "Fine Motor", "Temporal Grounding", "Sensory Calming"].every(t => main.indexOf(t) >= 0), "the matrix filters by the four stages and the four goals");

/* 8. colours and claims */
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const v = n => (new RegExp("--" + n + ":\\s*(#[0-9a-f]{6})", "i").exec(css) || [])[1];
ok(/--primary-green:\s*#1b382b/i.test(css) && /--parchment-bg:\s*#f4efe6/i.test(css) && /--gold-accent:\s*#c5a059/i.test(css) && /--charcoal:\s*#1a202c/i.test(css), "the four brand colours are custom properties");
[["charcoal", "parchment-bg"], ["primary-green", "parchment-bg"], ["muted", "parchment-bg"], ["warn", "parchment-bg"]].forEach(([a, b]) => ok(cr(v(a), v(b)) >= 7, `${a} on ${b} is ${cr(v(a), v(b)).toFixed(1)}:1 (7:1 needed)`));
ok(cr("#ffffff", v("primary-green")) >= 7, "white on the green banner is 7:1 or better");
const text = main.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");
[[/\bcompliant\b/i, "compliant"], [/(?<!or )\bcertified\b(?! Therapeutic)/i, "certified"], [/directly satisf/i, "directly satisfies"], [/regulatory compliance/i, "regulatory compliance"], [/guarantee/i, "a guarantee"],
  [/(?<!not )\b(cures?|reverses?|prevents? sundowning|eliminates? sundowning|stops? tremors?)\b/i, "a cure or a prevention"], [/clinically proven|proven to/i, "proof"]]
  .forEach(([re, n]) => ok(!re.test(text + js), `the page does not claim "${n}"`));
ok(/not (a )?(survey finding|legal advice)|no agency has endorsed/i.test(text), "the page says what it is not (a survey finding, legal advice, an endorsement)");
ok(/visual boundary, not a physical barrier/.test(text), "the page says a printed line is a visual boundary, not a physical barrier");
ok(/not a diagnosis|not a clinical test|not a measurement/.test(text), "the page says the pillars are not a diagnosis and the simulation is not a measurement");
ok(/F679/.test(main) && /483\.24\(c\)\(1\)/.test(main + js) && /F744/.test(js) && /483\.40\(b\)\(3\)/.test(js) && /F550/.test(main) && /F656/.test(js) && /Section F/.test(js) && /Section Q/.test(js), "F679, §483.24(c)(1), F744, §483.40(b)(3), F550, F656 and MDS Sections F and Q are cited");
ok(/Kirk Barron/.test(main) && /Minot, North Dakota/.test(main), "the publisher is named, with Minot, North Dakota");
ok(/100% Client-Side/.test(main) && /Clinical Validation Active/.test(js) && /data-state/.test(main) && /Network use detected/.test(js), "the badge says 100% Client-Side / Clinical Validation Active, and changes when a check fails");
ok(/Woods et al\., 2018/.test(main) && /Rubin &amp; Legge, 1989/.test(main) && /1900s through the 1980s/.test(main), "the evidence notes name their sources, and the cues span the 1900s through the 1980s");
ok(/reminiscence bump/.test(main) && /not as a treatment/.test(main), "the reminiscence copy says what the evidence supports and that it is not a treatment");
ok(/Offer, never insist/.test(js) && /Do not type resident names here/.test(main), "the staff cue is on the packet and the cover details ask for no resident name");
ok(read("docs/clinical-alignment-console.md").length > 800, "the console is documented");
try { new vm.Script(js); ok(true, ""); } catch (e) { ok(false, "the page script does not parse: " + e.message); }

console.log(problems.length ? `clinical alignment check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `clinical alignment check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
