#!/usr/bin/env node
/* =====================================================================
   Checks for the Quality Standards Hub (resources/quality-standards/index.html): a four-tab console with a
   survey-readiness checklist, a copier calibration sheet and the procurement tools. Node built-ins only.

     1. the tabs follow the ARIA tabs pattern, and every tab has its panel
     2. the page loads nothing from another site and makes no network call of its own
     3. the checklist has the six indicators, its answers persist in the encrypted store, and the store knows the name
     4. the printed sheets: US Letter, the 0.65 in gutter, the 0.5 in margins, a print block that hides the navigation
     5. the price on the page is the price in the tools; the colour pairs meet 7:1; no claim the product cannot back
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const html = read("resources/quality-standards/index.html");
const main = html.slice(html.indexOf('<main class="container"'), html.indexOf("</main>"));
const css = (/<style>([\s\S]*?)<\/style>/.exec(html) || [])[1] || "";
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.sort((a, b) => b.length - a.length)[0] || "";

/* 1. tabs */
const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(m => m[0]);
ok(/role="tablist"/.test(html), "there is a tablist");
ok(tabs.length === 4, "there are four tabs (" + tabs.length + ")");
const names = ["Governance & Clinical Pillars", "State Survey Audit Engine", "Copier Calibration & Margin Test", "Institutional Procurement & W-9"];
names.forEach(n => ok(html.replace(/&amp;/g, "&").indexOf(n) >= 0, `the tab "${n}" is there`));
ok(tabs.filter(t => /aria-selected="true"/.test(t)).length === 1, "exactly one tab is selected");
ok(tabs.filter(t => /tabindex="0"/.test(t)).length === 1 && tabs.filter(t => /tabindex="-1"/.test(t)).length === 3, "one tab is in the tab order (roving tabindex)");
tabs.forEach(t => {
  const id = (/id="([^"]+)"/.exec(t) || [])[1], ctl = (/aria-controls="([^"]+)"/.exec(t) || [])[1];
  const panel = ctl && new RegExp(`<section[^>]*id="${ctl}"[^>]*>`).exec(html);
  ok(!!panel && /role="tabpanel"/.test(panel[0]) && new RegExp(`aria-labelledby="${id}"`).test(panel[0]), `tab ${id} controls a panel that names it`);
});
ok([...main.matchAll(/role="tabpanel"[^>]*\bhidden\b/g)].length === 3, "the three panels that are not showing are hidden");
ok(/ArrowRight/.test(js) && /ArrowLeft/.test(js) && /Home/.test(js) && /End/.test(js), "the arrow keys, Home and End move between tabs");
ok(/class="skip-link"/.test(html) && /<main /.test(html), "a skip link and a main landmark");

/* 2. no network */
ok(![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some(m => /^(https?:)?\/\//.test(m[1])), "no script comes from another site");
ok(![...html.matchAll(/<link[^>]+href="([^"]+)"/g)].some(m => /^(https?:)?\/\//.test(m[1])), "no stylesheet comes from another site");
ok(!/@import\s+url\(\s*['"]?https?:/.test(css), "no CSS import from another site");
const jsNoWrap = js.replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/\bfetch\s*\(/.test(jsNoWrap) && !/new\s+XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon\s*\(/.test(jsNoWrap.replace(/navigator\.sendBeacon\s*=|var b = navigator\.sendBeacon;/g, "")), "the page's script makes no network call");
ok(/Net\s*=/.test(js) && /requests: function/.test(js), "the page counts its own network use for the live check");

/* 3. the checklist */
const itemsBlock = (/var ITEMS = \[([\s\S]*?)\n    \];/.exec(js) || [])[1] || "";
const ids = [...itemsBlock.matchAll(/\{ id: "([a-z]+)"/g)].map(m => m[1]);
ok(ids.length === 6 && new Set(ids).size === 6, "the checklist has six indicators (" + ids.join(", ") + ")");
[["Individualized Life History", "life"], ["Non-Infantilizing Adult Line-Art", "dignity"], ["Dated Physical Activity Artifacts", "binder"], ["Sundowning", "evening"], ["Fine-Motor Tremor", "motor"], ["Offline Local Data Privacy", "privacy"]]
  .forEach(([t]) => ok(itemsBlock.indexOf(t) >= 0, `the indicator "${t}" is there`));
ok(/role="meter"/.test(main) && /aria-valuenow/.test(main) && /Audit Readiness Score/.test(main), "the score is a labelled meter");
ok(/Math\.round\(100 \* count\(\) \/ ITEMS\.length\)/.test(js), "the score is the share of indicators ticked");
const KEY = (/var KEY = "([^"]+)"/.exec(js) || [])[1] || "";
const store = read("assets/services/secureStore.js"), storeTs = read("src/services/secureStore.ts");
ok(!!KEY && /"cognicopia_quality"/.test(store) && /"cognicopia_quality"/.test(storeTs) && KEY.indexOf("cognicopia_quality") === 0, `the checklist's storage name (${KEY}) is sealed by the encrypted store`);
ok(/secureStore\.js/.test(html) && /CogniSecureStore/.test(js) && /promptUnlock/.test(js), "the page uses the encrypted store and can ask for the passphrase");
ok(/docs\/privacy-and-storage\.md/.test("docs/privacy-and-storage.md") && read("docs/privacy-and-storage.md").indexOf(KEY) >= 0, "the privacy document lists what this page keeps");

/* 4. print */
ok(/@page\s*\{[^}]*size:\s*8\.5in 11in/.test(css), "the page is US Letter");
ok(/--gutter:\s*0\.65in/.test(css) && /padding:\s*\.5in \.5in \.5in var\(--gutter\)/.test(css), "printed sheets keep a 0.65 in gutter and 0.5 in margins");
const pr = css.slice(css.indexOf("@media print"));
ok(/\.cg-sidebar[\s\S]*display:\s*none\s*!important/.test(pr) && /\.qs-tabs/.test(pr) && /\.qs-btn/.test(pr) && /\.cg-topbar/.test(pr) && /\.cg-crumbs/.test(pr), "printing hides the sidebar, top bar, breadcrumbs, tabs and buttons");
ok(/body\[data-print="sheet"\]\s*>\s*\*:not\(#qsPrintRoot\)/.test(pr), "printing a sheet prints only the sheet");
ok(/size: 8\.5in 11in; margin: 0;/.test(js), "a sheet prints edge to edge so it can keep its own gutter");
ok(/viewBox="0 0 612 792"/.test(js) && /stroke-width="' \+ w \+ '"/.test(js), "the calibration sheet is drawn in points, so a 2.5 stroke prints as 2.5 pt");
[0.5, 1, 1.5, 2.5, 3].forEach(w => ok(new RegExp("WEIGHTS = \\[[^\\]]*\\b" + String(w).replace(".", "\\.") + "\\b").test(js), `the line-weight ladder has ${w} pt`));
ok(/Run Copier Test Print/.test(main) && /window\.print\(\)/.test(js), "the calibration sheet has its print button");
ok(/--primary-green:\s*#1b382b/i.test(css) && /--parchment-bg:\s*#f4efe6/i.test(css) && /--gold-accent:\s*#c5a059/i.test(css) && /--charcoal:\s*#1a202c/i.test(css), "the four brand colours are custom properties");

/* 5. the price, the colours and the claims */
const builder = read("builder.html");
const price = (/PRICE = "\$([\d.]+) a year"/.exec(builder) || [])[1];
ok(price === "129.99" && /UNIT_CENTS = 12999/.test(js), "the calculator uses the license price in the tools (" + price + ")");
ok(/Net 30/.test(main + js) && /W-9/.test(main + js), "Net 30 and the W-9 are on the page");
ok(!/\b\d{2}-\d{7}\b/.test(html), "no taxpayer identification number is invented");
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const v = n => (new RegExp("--" + n + ":\\s*(#[0-9a-f]{6})", "i").exec(css) || [])[1];
[["charcoal", "parchment-bg"], ["primary-green", "parchment-bg"], ["muted", "parchment-bg"], ["warn", "parchment-bg"]].forEach(([a, b]) => ok(cr(v(a), v(b)) >= 7, `${a} on ${b} is ${cr(v(a), v(b)).toFixed(1)}:1 (7:1 needed)`));
ok(cr("#ffffff", v("primary-green")) >= 7, "white on the green banner is 7:1 or better");
const text = main.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
[[/\bHIPAA[- ]compliant\b/i, "HIPAA compliant"], [/(?<!or )\bcertified\b/i, "certified"], [/directly satisf/i, "directly satisfies"], [/regulatory compliance/i, "regulatory compliance"], [/guaranteed (to )?(pass|survey)/i, "a survey guarantee"], [/100% (HIPAA|compliant)/i, "100% compliant"]]
  .forEach(([re, n]) => ok(!re.test(text + js), `the page does not claim "${n}"`));
ok(/not (a )?(survey finding|legal advice)|no agency has endorsed/i.test(text + js), "the page says what it is not (a survey finding, legal advice, an endorsement)");
ok(/F679/.test(main) && /483\.24\(c\)/.test(main) && /Section F/.test(main) && /Section Q/.test(main) && /F656/.test(main), "F679, §483.24(c), MDS Section F and Q, and F656 are cited");
ok(/Kirk Barron/.test(main) && /Minot, North Dakota/.test(main), "the publisher is named, with Minot, North Dakota");
ok(/Local Encryption Active/.test(js) && /100% Offline/.test(main + js), "the badge reports the local encryption state and offline use");
ok(/data-state/.test(main) && /Network use detected/.test(js), "the badge changes when the check fails");
try { new vm.Script(js); ok(true, ""); } catch (e) { ok(false, "the page script does not parse: " + e.message); }

console.log(problems.length ? `quality hub check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `quality hub check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
