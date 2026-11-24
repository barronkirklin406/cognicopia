#!/usr/bin/env node
/* =====================================================================
   The playbook's clinical content rules for the packet tool (packet.html), proved on real PDFs read back with PyMuPDF
   (made-up people only; .claude/skills/cognicopia-clinical-dignity):

     pronoun   the box starts blank; a man with it blank is never "her", "his" or "him" (the pages use his name); a control with "she"
               chosen does say "her", so the check can see a pronoun when there is one
     military  "Which branch did you serve in?" and "Where did the Army send you?" print only when "Military service is a welcome topic"
               is chosen; the default is silence
     faith     a blank faith prints no hymns; a Catholic resident gets only hymns that suit a Catholic; a Jewish resident gets none of
               the Christian hymns (the page keeps its songs); a Lutheran gets hymns
     thin      the Quick packet's headings say "Words to find" and "Things to talk about" for a person with fewer than 3 known facts, and
               "Topics inspired by your life & passions" only for a well-known one
     staff     the staff sheet says how many of 8 facts are known, and asks the family about work, hometown and one joy when it is under 3

   Needs Playwright and PyMuPDF (exit 2 where Playwright is missing). Run: node scripts/check-clinical-rules-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, agreed } from "./lib/browser.mjs";

const problems = [], errs = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-clin-"));

const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1])
print(json.dumps({"pages": [pg.get_text() for pg in doc]}))
`;
const readPdf = f => { const r = spawnSync("python3", ["-I", "-c", PY, f], { encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26 }); try { return JSON.parse(r.stdout); } catch (e) { return { missing: true }; } };

/* a packet for one made-up resident, made through the real form */
let n = 0;
async function packet(fields, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, serviceWorkers: "block" }); await agreed(ctx);
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "packet.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { window.print = () => {}; localStorage.clear(); localStorage.setItem("cognicopia_eula_accepted", "true"); });
  const start = await p.evaluate(() => ({ pronoun: document.getElementById("pronoun").value, milOk: document.getElementById("milOk").value }));
  for (const [id, v] of Object.entries(fields)) { if (id === "pronoun" || id === "milOk") await p.selectOption("#" + id, v); else await p.fill("#" + id, v); }
  await p.evaluate(() => document.querySelectorAll(".act").forEach(c => { c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); }));
  const stage = opts.stage || "middle";
  await p.evaluate(s => { const r = document.querySelector(`input[name=stage][value=${s}]`); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); } }, stage);
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click("#go")]);
  const f = path.join(tmp, `p${++n}.pdf`); await dl.saveAs(f);
  const r = readPdf(f); await ctx.close();
  return Object.assign({ start }, r);
}
const all = r => r.pages.join("\n").replace(/\s+/g, " ");
const HYMN_LEADS = ["Amazing grace", "What a friend we have", "Rock of ages", "Blessed assurance", "Nearer, my God", "Abide with me", "Shall we gather", "Onward, Christian", "Just as I am", "I come to the garden", "old rugged", "Sweet hour of", "roll is called"];
const CATHOLIC_OK = ["Amazing grace", "Rock of ages", "Nearer, my God", "Abide with me"];
const hymnsIn = text => HYMN_LEADS.filter(h => text.includes(h));

try {
  /* ---------- pronoun ---------- */
  const A = await packet({ first: "Walter", born: "1936", town: "Minot", job: "farmer" });
  if (A.missing) { console.log("clinical rules check skipped: PyMuPDF is not installed for python3 (pip install pymupdf)"); process.exit(2); }
  ok(A.start.pronoun === "", `the pronoun box starts blank (it starts as "${A.start.pronoun}")`);
  ok(A.start.milOk === "", `"Military service is a welcome topic" starts off (it starts as "${A.start.milOk}")`);
  const staffA = A.pages.find(t => /For Staff/.test(t)) || "";
  ok(/Walter/.test(staffA), "the staff page uses his name when no words are chosen");
  ok(!/\b(her|hers|his|him|she|he)\b/i.test(staffA), `the staff page never says her, his, him, she or he for a blank pronoun: ${(staffA.match(/\b(her|hers|his|him|she|he)\b/gi) || []).join(",")}`);
  ok(!/\b(her|hers|his|him|she)\b/i.test(A.pages.find(t => /Engagement Notes/.test(t)) || ""), "the notes page never says her, his, him or she for a blank pronoun");
  ok(/Known so far: 2 of 8 facts/.test(staffA.replace(/\s+/g, " ")), `the staff page says how well he is known: ${(staffA.replace(/\s+/g, " ").match(/Known so far[^.]*\./) || [""])[0]}`);
  ok(/Ask the family about work, hometown, and one joy/.test(staffA.replace(/\s+/g, " ")), "a resident with 2 facts (under 3) gets the line asking the family about work, hometown and one joy");
  const B = await packet({ first: "Dorothy", born: "1938", pronoun: "she", town: "Velva", job: "teacher", hobbies: "gardening", favs: "Patsy Cline" });
  ok(/\b(her)\b/.test(all(B).slice(0, 1e6)), "control: with she chosen the packet does say her");
  ok(!/Ask the family about work, hometown, and one joy/.test(all(B)), "a resident with 4 facts is not asked the thin-data line");
  ok(/Known so far: 4 of 8 facts/.test(all(B)), "the staff page counts 4 of 8 facts for Dorothy");

  /* ---------- military ---------- */
  const C = await packet({ first: "Harold", born: "1930", mil: "Army" });
  ok(!/Which branch did you serve in/.test(all(C)) && !/Where did the Army send you/.test(all(C)), "military not welcome: no military question prints");
  ok(hymnsIn(all(C)).length === 0, `blank faith: no hymn prints (${hymnsIn(all(C)).join(", ")})`);
  const C2 = await packet({ first: "Harold", born: "1930", mil: "Army", milOk: "welcome" });
  ok(/Which branch did you serve in|Where did the Army send you/.test(all(C2)), "military welcome: a military question is allowed to print");

  /* ---------- faith ---------- */
  const D = await packet({ first: "Rosa", born: "1932", faith: "Catholic" });
  ok(/Finish the Line/.test(all(D)), "the Finish the Line page is made for a Catholic resident");
  const dh = hymnsIn(all(D));
  ok(dh.length >= 1 && dh.every(h => CATHOLIC_OK.includes(h)), `a Catholic resident gets only hymns that suit a Catholic: ${dh.join(", ") || "none"}`);
  const E = await packet({ first: "Samuel", born: "1931", faith: "Jewish" });
  ok(/Finish the Line/.test(all(E)) && hymnsIn(all(E)).length === 0, `a Jewish resident gets no Christian hymn and keeps the page (${hymnsIn(all(E)).join(", ")})`);
  ok(!/For God so loved the world/.test(all(E)), "a Jewish resident is not given John 3:16");
  const F = await packet({ first: "Edna", born: "1929", faith: "Lutheran" });
  ok(hymnsIn(all(F)).length >= 1, "a Lutheran resident gets hymns");

  /* ---------- the Quick packet's headings for a person who is hardly known ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" }); await agreed(ctx);
  const q = await ctx.newPage(); q.on("pageerror", e => errs.push(e.message));
  await q.goto(base + "packet.html"); await q.waitForTimeout(500);
  const heads = async rich => {
    await q.evaluate(rich => {
      window.getActiveResidentContext = () => ({ isGeneric: false, name: "Walter", stage: "middle", difficulty: { level: 3, label: "Moderate" },
        print: { vision: "large", readingLevel: "short", motorSkills: "", paper: "letter", ink: "bw", highContrast: true },
        avoid: { topics: [], words: [] }, decades: ["1940s", "1950s"], birthYear: 1936, occupation: rich ? "Farmer" : "", hometown: rich ? "Minot" : "",
        hobbies: rich ? ["fishing"] : [], people: [], music: { artists: [], genres: [], favoriteSong: "" }, screen: [], military: { okToMention: false } });
    }, rich);
    await q.click("#qpbGenerate"); await q.waitForTimeout(1500);
    return q.evaluate(() => document.querySelector("#qpbPreview").innerText.replace(/\s+/g, " "));
  };
  const thin = await heads(false), full = await heads(true);
  ok(/Words to find/.test(thin) && /Things to talk about/.test(thin), "a person with fewer than 3 known facts gets the neutral headings");
  ok(!/Topics inspired by your life|Chosen for you/.test(thin), "and never \"Topics inspired by your life\" or \"Chosen for you\"");
  ok(/Topics inspired by your life/.test(full) && /Chosen for you/.test(full), "a person with 3 known facts gets the personal headings");
  await ctx.close();

  /* ---------- the helpers, on made-up words ---------- */
  const fx = await (async () => {
    const c2 = await browser.newContext({ serviceWorkers: "block" }); await agreed(c2); const pg = await c2.newPage();
    await pg.goto(base + "packet.html"); await pg.waitForTimeout(400);
    const out = await pg.evaluate(() => ({
      kinds: ["Lutheran", "Roman Catholic", "catholic", "Jewish", "Muslim", "", "Buddhist", "Church of Christ"].map(x => faithKind(x)),
      trivia: [triviaPairs({ town: "", state: "", job: "", spouse: "", kids: [], pets: [], mil: "Army", milOk: false, school: "", mother: "", firstcar: "", firstjob: "", sibs: [], hobbies: [] }).length,
               triviaPairs({ town: "", state: "", job: "", spouse: "", kids: [], pets: [], mil: "Army", milOk: true, school: "", mother: "", firstcar: "", firstjob: "", sibs: [], hobbies: [] }).length],
      them: pronOf({ pronoun: "they", goes: "Sam" }).poss, blank: pronOf({ pronoun: "", goes: "James" }).poss
    }));
    await c2.close(); return out;
  })();
  ok(fx.kinds.join() === "protestant,catholic,catholic,jewish,muslim,,,protestant", `faithKind reads the faith box: ${fx.kinds.join("|")}`);
  ok(fx.trivia[1] === fx.trivia[0] + 1, `the military question is added only when welcome (${fx.trivia[0]} then ${fx.trivia[1]})`);
  ok(fx.them === "their" && fx.blank === "James'", `pronouns: "they" stays their, and a blank uses the name (${fx.them}, ${fx.blank})`);

  ok(errs.length === 0, "no page script fails: " + errs.slice(0, 3));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `clinical rules check FAILED: ${problems.length} problem(s)\n  - ` + problems.join("\n  - ") : `clinical rules check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
