#!/usr/bin/env node
/* =====================================================================
   12-Month Life Planner checks.  Run: npm test
   Loads the planner engine straight out of builder.html (the lp-engine
   block) and checks the rules the planner promises:
     - dignity-first tone guardrails, on every page and on AI copy
     - personalization reaches the pages; avoided topics and care-only
       dates never reach the memory book
     - the resident / caregiver audience split and the three print scopes
     - two-page spread parity (left = visual, right = writing lines)
     - print standards: 0.75 in inner gutter, 14 pt text and 16 pt bold
       heading floors, writing lines 0.5 in apart at 2 pt, and every page
       set in the embedded Atkinson Hyperlegible (no network font)
     - season colors readable at WCAG AAA (7:1)
     - user text is escaped
   Node built-ins only. The real browser and PDF measurements were made
   with Playwright and PyMuPDF; see the pull request for the method.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
const block = (tag, id) => {
  const m = new RegExp(`<${tag} id="${id}">\\n([\\s\\S]*?)\\n</${tag}>`).exec(html);
  if (!m) throw new Error(`builder.html has no <${tag} id="${id}"> block`);
  return m[1];
};
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(block("script", "lp-engine"), sandbox, { filename: "lp-engine" });
const LP = sandbox.window.LifePlanner;
const css = block("style", "lp-css");

let passed = 0;
const failures = [];
function check(name, fn){
  try { const r = fn(); if (r === false) throw new Error("returned false"); passed++; }
  catch (e){ failures.push(name + ": " + e.message); }
}
function eq(a, b, what){ if (a !== b) throw new Error(`${what || "value"}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v, what){ if (!v) throw new Error(what || "expected true"); }

const EX = LP.EXAMPLE_PROFILE;
const OPTS = { year: 2027, startMonth: 0 };
const T1 = Object.assign({ tier: 1 }, OPTS);      // Tier 1 prints every invitation, sense cue and blurb
const text = pages => pages.map(p => LP.textRuns(p.body).join(" ")).join("\n");
const SCOPES = ["memory", "companion", "binder"];

/* A worst-case profile: every field at its length and count limit. */
const long = (s, n) => (s + " ").repeat(20).slice(0, n);
const MAX = {
  name: long("Maximiliana", 30), fullName: long("Maximiliana Wilhelmina", 50), birthYear: 1931, hometown: long("Wawatosa-on-the-Mississippi", 40),
  profession: long("Mechanical engineer and railroad signal maintainer", 50),
  songs: Array.from({ length: 12 }, (_, i) => long("When the moon hits your eye " + i, 60)),
  genres: Array.from({ length: 6 }, (_, i) => long("Western swing " + i, 40)), hobbies: Array.from({ length: 8 }, (_, i) => long("Restoring furniture " + i, 40)),
  scents: Array.from({ length: 8 }, (_, i) => long("Pine boughs " + i, 45)), textures: Array.from({ length: 8 }, (_, i) => long("Worn leather " + i, 45)),
  foods: Array.from({ length: 10 }, (_, i) => long("Cardamom rolls " + i, 50)), meals: Array.from({ length: 10 }, (_, i) => long("Swedish meatballs " + i, 50)),
  family: ["great-grandchild", "grandchild", "other-family", "daughter", "son", "pet-other", "spouse", "sibling", "friend", "neighbor", "partner", "other"]
    .map((rel, i) => ({ name: long("Bartholomew " + i, 30), rel, passed: i === 6 })),
  milestones: Array.from({ length: 8 }, (_, i) => ({ year: 1940 + i * 5, text: long("Moved across the country to start a new job " + i, 70) })),
  dates: Array.from({ length: 16 }, (_, i) => ({ label: long("Birthday party celebration " + i, 40), month: i % 12 + 1, day: 28, year: 1950, audience: i === 15 ? "caregiver" : "resident" })),
  avoid: LP.DATA.AVOID_TOPICS.map(t => t[0]), facility: long("Wawatosa Memorial Memory Care", 60)
};
const PROFILES = { example: EX, empty: {}, max: MAX };

/* ---------- 1. Tone guardrails ---------- */
const audit = (s, audience) => LP.TONE.audit(s, { audience });
check("the built-in content library passes the dignity-first audit", () => {
  const bad = LP.libraryStrings().filter(s => audit(s, "resident").length);
  eq(bad.length, 0, "library strings breaking a rule: " + bad.join(" | "));
});
for (const [pname, prof] of Object.entries(PROFILES)) for (const copies of [1, 4]) for (const tier of [1, 2, 3]) {
  check(`every printed line passes the audit (${pname} profile, ${copies} log set${copies > 1 ? "s" : ""}, tier ${tier})`, () => {
    const v = LP.auditPages(LP.build(prof, Object.assign({ copies, tier }, OPTS), "binder").pages);
    eq(v.length, 0, "violations " + JSON.stringify(v.slice(0, 3)));
  });
}
const MUST_FLAG = {
  "baby-talk": ["Time to fill your tummy", "Yummy lunch today", "Let's go potty", "Night-night, see you soon", "Oopsie, let me help"],
  "pet-name": ["Good morning, sweetie", "Here you go, honey.", "Thank you, dear.", "Hello young lady", "Nice work, kiddo"],
  "patronizing-we": ["How are we feeling today?", "Are we ready for our bath?", "Let's get you cleaned up", "Did we eat our lunch?"],
  "praise": ["Good job!", "Good girl", "You did it", "I'm so proud of you", "Earn a gold star"],
  "preschool": ["It's circle time", "Snack time at 3", "After nap time", "Arts and crafts hour", "Story time with Ruth"],
  "quizzing": ["Do you remember your wedding?", "Try to remember her name", "You already told me that", "No, that's wrong"],
  "labels": ["She suffers from dementia", "The elderly residents", "Enjoy your golden years", "He is a wanderer", "A senile old man"],
  "sing-song": ["Yay! Music time", "Woo-hoo, cake", "Hooray for Friday"],
  "exclaim": ["What a lovely day!! Truly!"],
  "emoji": ["Lovely day \u{1F60A}"],
  "medical-claim": ["This activity slows dementia", "Clinically proven to help", "Reverses memory loss"],
  "clinical-leak": ["Dementia care starts here", "Ask the care team", "Medication at noon"]
};
for (const [rule, lines] of Object.entries(MUST_FLAG)) check(`the audit catches ${rule}`, () => {
  lines.forEach(s => ok(audit(s, "resident").some(h => h.rule === rule), `"${s}" was not flagged as ${rule}`));
});
check("the audit does not flag plain, respectful adult language", () => {
  const clean = ["Dear Margaret,", "Honey-glazed ham with carrots", "Retired after 41 years in the classroom", "Tell me about your daughter, Anna.",
    "What was harvest time like around Duluth?", "A warm cup of tea and a good book", "She played piano at the Good Shepherd church",
    "Which holiday song brings back the strongest feelings?", "Tea with honey and lemon", "Gardening and fresh air", "Remembering Walter with love"];
  clean.forEach(s => eq(audit(s, "resident").map(h => h.rule).join(), "", `"${s}"`));
});
check("caregiver pages may use care words that resident pages may not", () => {
  eq(audit("Share updates with the care team.", "caregiver").length, 0);
  ok(audit("Share updates with the care team.", "resident").length > 0);
});
check("the system prompt forbids infantilizing, patronizing and quizzing language", () => {
  const p = LP.TONE.SYSTEM_PROMPT;
  ["DIGNITY FIRST", "Infantilizing", "Pet names", "patronizing \"we\"", "Do you remember", "Never invent", "Return only the JSON"].forEach(k => ok(p.indexOf(k) >= 0, "missing: " + k));
  ok(LP.TONE.RULES.length >= 12, "at least 12 audit rules");
});
check("AI copy: failing lines are dropped, clean lines are kept", () => {
  const r = LP.acceptAiCopy({ months: [
    { index: 0, blurb: "A calm month for warm quilts and familiar music.", prompts: ["Tell me about a winter coat you loved.", "Do you remember your first snow day?", "Yay! Snow time!!"],
      sense: { music: "Nat King Cole", scent: "Sweetie, smell the cinnamon", texture: "A wool blanket", food: "Yummy soup" } },
    { index: 99, blurb: "ignored" }, { index: "3", blurb: 42, prompts: "not a list" }] });
  const m0 = r.copy.months[0];
  eq(m0.prompts.length, 1, "kept prompts"); eq(m0.prompts[0], "Tell me about a winter coat you loved.");
  eq(m0.sense.scent, undefined, "patronizing scent dropped"); eq(m0.sense.food, undefined, "baby-talk food dropped");
  eq(m0.sense.music, "Nat King Cole"); eq(r.copy.months[99], undefined, "out-of-range month ignored");
  ok(r.rejected.length >= 4, "rejected lines are reported");
});
check("AI copy that passed the audit reaches the month page, and only there", () => {
  const ai = LP.acceptAiCopy({ months: [{ index: 0, blurb: "Frosted windows, warm soup and old friends.", prompts: ["Tell me about sledding on your street."] }] }).copy;
  const res = LP.build(EX, Object.assign({ aiCopy: ai }, T1), "memory"), jan = res.pages.filter(p => p.title === "January");
  ok(text(jan).indexOf("Frosted windows, warm soup and old friends.") >= 0, "AI blurb printed");
  ok(text(jan).indexOf("Tell me about sledding on your street.") >= 0, "AI prompt printed");
});
check("the AI request never contains the resident's name", () => {
  const r = LP.buildAiRequest(Object.assign({}, EX, { foods: ["Margaret’s own apple pie"] }), OPTS), all = r.system + r.user;
  ok(!/Margaret|Hansen|Ellen/.test(all), "name leaked into the request");
  ok(r.user.indexOf("Duluth") >= 0, "other facts are included");
  eq(r.system, LP.TONE.SYSTEM_PROMPT, "system prompt");
});
check("the wording check advises on typed text without blocking the build", () => {
  const p = Object.assign({}, EX, { songs: ["Sweetie Pie song time"], hobbies: ["Circle time games"] });
  ok(LP.checkProfile(p).length >= 2, "advice given");
  ok(LP.build(p, OPTS, "memory").count === 32, "still builds");
});

/* ---------- 2. Personalization ---------- */
const mem = LP.build(EX, T1, "memory"), memText = text(mem.pages);
check("the resident's details are woven into the memory book", () => {
  ["Margaret’s Life Planner", "Margaret Ellen Hansen", "Duluth, Minnesota", "Elementary school teacher", "1938", "“Moon River”",
    "Began teaching second grade at Lincoln School", "Tell me about your daughter, Anna.", "Anna’s birthday (turns 63)", "Wedding anniversary (66th)",
    "Lavender", "A soft wool shawl", "Her mother’s apple pie", "As an elementary school teacher"].forEach(s => ok(memText.indexOf(s) >= 0, "missing: " + s));
});
check("all twelve monthly modules are present, January Winter Warmth to December Holiday Glow", () => {
  const themes = LP.DATA.MONTH_THEMES.map(m => m.theme);
  eq(themes[0], "Winter Warmth"); eq(themes[11], "Holiday Glow"); eq(new Set(themes).size, 12, "distinct themes");
  themes.forEach(t => ok(memText.indexOf(t) >= 0, "missing theme " + t));
});
check("people who have passed away are never prompted or listed as current in the memory book, at any tier", () => {
  [1, 2, 3].forEach(tier => {
    const book = LP.build(EX, Object.assign({ tier }, OPTS), "memory"), all = text(book.pages);
    ok(!/Tell me about [^.]*Walter/.test(all), "Walter prompted at tier " + tier);
    ok(!/Tell me about your spouse/.test(all), "a passed spouse was prompted at tier " + tier);
    const story = book.pages.filter(p => p.spreadId === "story" && p.role === "visual")[0];
    const people = (/<ul class="lp-people">([\s\S]*?)<\/ul>/.exec(story.body) || [])[1] || "";
    ok(people.indexOf("Anna") >= 0, "living people listed at tier " + tier);
    ok(people.indexOf("Walter") < 0, "a person who has passed away is listed among current people at tier " + tier);
  });
});
check("care-team-only dates never print in the memory book, at any tier", () => {
  [1, 2, 3].forEach(tier => ok(text(LP.build(EX, Object.assign({ tier }, OPTS), "memory").pages).indexOf("memorial") < 0, "memorial date leaked at tier " + tier));
  ok(text(LP.build(EX, OPTS, "companion").pages).indexOf("Walter’s memorial day") >= 0, "memorial date missing from the companion");
});
check("topics to avoid remove their prompts", () => {
  const o = Object.assign({ promptCount: 4 }, T1), topics = ["swim or cool off", "thunderstorm", "hymn"];
  const book = avoid => text(LP.build({ name: "Ruth", avoid }, o, "memory").pages);
  const all = book([]), some = book(["water", "storms", "religion"]);
  topics.forEach(s => ok(all.indexOf(s) >= 0, "control prompt missing: " + s));
  topics.forEach(s => ok(some.indexOf(s) < 0, "avoided topic printed: " + s));
  ok(some.indexOf("road trip") >= 0, "the next prompt takes the freed place");
  ok(book(["water", "storms", "religion", "driving"]).indexOf("road trip") < 0, "avoided topic printed: road trip");
});
check("every month keeps a seasonal prompt, even for a detailed profile", () => {
  mem.pages.filter(p => p.tab === 2 && p.role === "visual").forEach(pg => {
    const theme = LP.DATA.MONTH_THEMES.filter(m => m.name === pg.title)[0];
    ok(theme, "month page " + pg.title);
    const asks = (/<ol class="lp-asks">([\s\S]*?)<\/ol>/.exec(pg.body) || [])[1] || "";
    ok(!/^(?:<li>(?:This month:|Tell me about your |Tell me about [A-Z]\w+, your |\d{4}: |As an? )[^<]*<\/li>)+$/.test(asks), pg.title + " has only personal prompts");
  });
});
check("an empty profile still builds complete, respectful pages", () => {
  const r = LP.build({}, OPTS, "binder");
  eq(r.count, 47); ok(text(r.pages).indexOf("Your Life Planner") >= 0, "generic title"); ok(text(r.pages).indexOf("undefined") < 0 && text(r.pages).indexOf("null") < 0, "no blanks leaked");
});
check("user text is escaped, never injected as markup", () => {
  const evil = "<img src=x onerror=alert(1)><script>alert(1)</script>";
  const r = LP.build({ name: evil, hometown: evil, songs: [evil], family: [{ name: evil, rel: "son" }], dates: [{ label: evil, month: 1, day: 1 }] }, OPTS, "binder");
  r.pages.forEach(p => ok(p.html.indexOf("<img") < 0 && p.html.indexOf("<script") < 0, "unescaped markup on page " + p.no));
});
check("builds are deterministic", () => eq(LP.build(EX, OPTS, "binder").pages.map(p => p.html).join(""), LP.build(EX, OPTS, "binder").pages.map(p => p.html).join("")));

/* ---------- 3. Audience split and print scopes ---------- */
for (const copies of [1, 4, 12]) check(`print scopes split the audiences cleanly (${copies} log set${copies > 1 ? "s" : ""})`, () => {
  const o = Object.assign({ copies }, OPTS), c = LP.countPages(o);
  const m = LP.build(EX, o, "memory"), cg = LP.build(EX, o, "companion"), b = LP.build(EX, o, "binder");
  eq(m.count, c.memory, "memory count"); eq(cg.count, c.companion, "companion count"); eq(b.count, c.binder, "binder count");
  eq(b.count, m.count + cg.count, "binder = memory + companion");
  ok(m.pages.every(p => p.audience === "resident" && p.tab <= 2), "memory book holds only resident pages");
  ok(cg.pages.every(p => p.audience === "caregiver" && p.tab >= 3), "companion holds only caregiver pages");
  ok(cg.pages.every(p => /Confidential/.test(p.html)), "every caregiver page says Confidential");
  ok(m.pages.every(p => !/Caregiver Companion|Confidential/.test(p.html)), "no caregiver furniture in the memory book");
});
check("the resident memory book has no clinical language", () => {
  mem.pages.forEach(p => LP.textRuns(p.body).forEach(t => eq(audit(t, "resident").filter(h => h.rule === "clinical-leak").length, 0, `page ${p.no}: "${t}"`)));
});
check("all four tabs are covered", () => {
  const tabs = new Set(LP.build(EX, OPTS, "binder").pages.map(p => p.tab));
  [1, 2, 3, 4].forEach(t => ok(tabs.has(t), "tab " + t));
});

/* ---------- 4. Two-page spread logic and gutters ---------- */
for (const scope of SCOPES) for (const binding of ["book", "binder"]) for (const copies of [1, 12]) {
  check(`spreads: left pages even and visual, right pages odd with writing lines (${scope}, ${binding}, ${copies})`, () => {
    const r = LP.build(MAX, Object.assign({ binding, copies }, OPTS), scope);
    eq(r.pages.filter(p => p.filler).length, 0, "filler pages");
    r.pages.forEach((p, i) => eq(p.no, i + 1, "page numbering"));
    r.spreads.forEach(sp => {
      if (sp.left != null && sp.right != null){
        const L = r.pages[sp.left], R = r.pages[sp.right];
        eq(L.no % 2, 0, sp.id + " left page even"); eq(R.no, L.no + 1, sp.id + " right page follows");
        eq(L.role, "visual", sp.id + " left role"); eq(R.role, "lines", sp.id + " right role");
      }
    });
    r.pages.forEach(p => {
      const recto = binding === "binder" || p.no % 2 === 1;
      ok(p.html.indexOf(recto ? "lp-recto" : "lp-verso") >= 0, `page ${p.no} gutter side (${recto ? "recto" : "verso"})`);
    });
  });
}
check("the inner gutter is 0.75 in and mirrors correctly", () => {
  eq(LP.STANDARDS.GUTTER_IN, 0.75);
  ok(/\.lp-sheet\{[^}]*--gut:\.75in/.test(css), "--gut:.75in");
  ok(/\.lp-sheet\.lp-recto\{padding-left:var\(--gut\)\}/.test(css), "recto gutter on the left");
  ok(/\.lp-sheet\.lp-verso\{padding-right:var\(--gut\)\}/.test(css), "verso gutter on the right");
  ok(/\.lp-sheet\{[^}]*width:8\.5in; height:11in/.test(css), "US Letter sheet");
});

check("every printed page is set in the embedded Atkinson Hyperlegible", () => {
  eq(LP.STANDARDS.PRINT_FONT, "Atkinson Hyperlegible");
  const face = block("style", "print-font");
  const faces = [...face.matchAll(/@font-face\{font-family:"Atkinson Hyperlegible";font-style:(normal|italic);font-weight:(400|700);[^}]*src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{2000,}\)/g)];
  eq(faces.map(m => m[1] + " " + m[2]).sort().join(), "italic 400,italic 700,normal 400,normal 700", "four embedded faces");
  ok(!/url\((?!data:)/.test(face), "no font file is fetched from anywhere");
  ok(html.indexOf('<style id="print-font">') < html.indexOf('<style id="lp-css">'), "the faces load before the page styles");
  ok(/\.lp-sheet\{[^}]*font:14pt\/1\.3 "Atkinson Hyperlegible",/.test(css), ".lp-sheet uses it first");
  ok(!/Georgia/.test(css), "no other face overrides it on a page");
  ok(fs.existsSync(path.join(ROOT, "fonts", "OFL.txt")), "the font's license ships with it");
});

/* ---------- 4b. Support tiers ---------- */
check("support tiers: each resident page carries its tier, staff pages never do, and line weight follows visual needs", () => {
  eq(LP.build(EX, OPTS, "memory").tier, 2, "Tier 2 is the default");
  for (const tier of [1, 2, 3]){
    const b = LP.build(EX, Object.assign({ tier, lineW: tier + 1 }, OPTS), "binder");
    b.pages.forEach(p => ok(p.audience === "caregiver" ? !/\blp-t\d\b/.test(p.html) : new RegExp("\\blp-t" + tier + "\\b").test(p.html), `page ${p.no} tier class`));
    ok(b.pages.filter(p => p.audience !== "caregiver").every(p => (tier + 1 > 2) === /\blp-lw\d\b/.test(p.html)), "line weight class at tier " + tier);
  }
  eq(LP.build(EX, Object.assign({ tier: 9 }, OPTS), "memory").tier, 2, "an unknown tier falls back to Tier 2");
});
check("support tiers: Tier 1 plans in steps, Tier 2 offers starters and choices, Tier 3 anchors and orients", () => {
  const book = tier => LP.build(EX, Object.assign({ tier }, OPTS), "memory").pages;
  const jan = (pages, side) => pages.filter(p => p.title === "January" && p.role === (side === "left" ? "visual" : "lines"))[0].body;
  const now = (pages, side) => pages.filter(p => p.spreadId === "now" && p.role === (side === "left" ? "visual" : "lines"))[0].body;
  const t1 = book(1), t2 = book(2), t3 = book(3);
  ok(/lp-plansteps/.test(jan(t1, "right")) && /lp-plansteps/.test(now(t1, "right")), "Tier 1 multi-step planners");
  ok(/class="lp-asks"/.test(jan(t1, "left")) && /class="lp-prompt"/.test(jan(t1, "right")), "Tier 1 open prompts");
  ok(/class="lp-choices"/.test(jan(t2, "left")) && (jan(t2, "right").match(/class="lp-starter"/g) || []).length === 3, "Tier 2 choice grid and three starters");
  ok(t2.some(p => p.tab === 2 && /“Moon River”/.test(p.body)), "Tier 2 choices lead with the resident's own favorites");
  ok(/class="lp-anchor/.test(jan(t3, "left")) && /lp-starter-xl/.test(jan(t3, "right")), "Tier 3 anchor and one large starter");
  ok(/class="lp-orient"/.test(now(t3, "left")), "Tier 3 large orientation boxes");
  ok(!/Milestones/.test(t3.filter(p => p.spreadId === "story" && p.role === "visual")[0].body), "Tier 3 story page keeps to the facts and people");
});
check("support tiers: type and line art at the sizes each tier promises, held against the fit pass", () => {
  const tierCss = css.split("/* ---------- 12-Month Life Planner screen")[0];
  const size = sel => { const m = new RegExp(sel.replace(/[.*]/g, "\\$&") + "[^{}]*\\{[^}]*?font-size:([\\d.]+)pt").exec(tierCss); return m ? +m[1] : NaN; };
  eq(size(".lp-t1.lp-sheet .lp-h1"), 22); eq(size(".lp-t2.lp-sheet .lp-h1"), 28); eq(size(".lp-t3.lp-sheet .lp-h1"), 34);
  const b1 = size(".lp-t1 .lp-prompt"), b2 = size(".lp-t2 .lp-prompt"), b3 = size(".lp-t3 .lp-prompt");
  ok(b1 >= 14 && b1 <= 16, "Tier 1 body " + b1); ok(b2 >= 18 && b2 <= 20, "Tier 2 body " + b2); ok(b3 >= 24, "Tier 3 body " + b3);
  ok(/\.lp-t3 \.lp-sub,[^{]*\{font-size:24pt;font-weight:700\}/.test(tierCss), "Tier 3 body is bold");
  const art = t => +((new RegExp("\\.lp-t" + t + " \\.lp-art \\*[^{]*\\{[^}]*stroke-width:([\\d.]+)pt").exec(tierCss) || [])[1]);
  ok(art(2) >= 3 && art(2) <= 5, "Tier 2 line art " + art(2)); ok(art(3) >= 5, "Tier 3 line art " + art(3));
  ok(tierCss.indexOf(".lp-t2.lp-sheet .lp-h1") > tierCss.indexOf(".lp-fit2 .lp-opt"), "tier sizes come after the fit rules");
  ok(/\.lp-lw3 \.lp-rule[^{]*\{border-bottom-width:4px\}/.test(tierCss) && /\.lp-lw4 \.lp-rule[^{]*\{border-bottom-width:6px\}/.test(tierCss), "heavier writing lines: 3 pt (4px) and 4.5 pt (6px)");
});

/* ---------- 5. Type floors, line pitch, color ---------- */
const printCss = css.split("/* ---------- 12-Month Life Planner screen")[0];
check("no printed text is set below 14 pt", () => {
  const sizes = [...printCss.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?([\d.]+)pt/g)].map(m => +m[1]);
  ok(sizes.length > 40, "font sizes found"); eq(Math.min(...sizes) >= LP.STANDARDS.MIN_TEXT_PT, true, "min " + Math.min(...sizes));
});
check("headings are 16 pt or larger, and bold", () => {
  const heads = ["lp-h1", "lp-h2", "lp-h3", "lp-mtitle", "lp-mtheme", "lp-cover-h"];
  heads.forEach(h => {
    const rules = [...printCss.matchAll(new RegExp(`\\.${h}(?![\\w-])[^{]*\\{([^}]*)\\}`, "g"))].map(m => m[1]);
    ok(rules.length, "rules for ." + h);
    rules.forEach(r => { const m = /font-size:([\d.]+)pt/.exec(r); if (m) ok(+m[1] >= LP.STANDARDS.MIN_HEAD_PT, `.${h} at ${m[1]}pt`); });
  });
  ok(/\.lp-h1\{[^}]*font-weight:700/.test(printCss) && /\.lp-h2\{[^}]*font-weight:700/.test(printCss) && /\.lp-h3\{[^}]*font-weight:700/.test(printCss), "bold headings");
});
check("writing lines are 0.5 in apart with a 2 pt stroke, table rows at least 0.5 in tall", () => {
  eq(LP.STANDARDS.MIN_RULE_IN, 0.5); eq(LP.STANDARDS.RULE_PT, 2);
  // Borders print in whole CSS pixels (1px = 0.75pt, rounded down), so every width is judged as it prints.
  const printedPt = (n, unit) => unit === "px" ? Math.floor(+n) * .75 : Math.floor(+n / .75) * .75;
  const rule = /\.lp-rule\{height:([\d.]+)in;border-bottom:([\d.]+)(px|pt)/.exec(printCss);
  ok(rule && +rule[1] >= LP.STANDARDS.MIN_RULE_IN, "ruled line pitch " + (rule && rule[1]));
  ok(rule && printedPt(rule[2], rule[3]) >= LP.STANDARDS.RULE_PT, "ruled line stroke prints at " + (rule && printedPt(rule[2], rule[3])) + "pt");
  // no rule elsewhere shrinks a writing line below the standard
  [...printCss.matchAll(/\.lp-rule[^{]*\{[^}]*height:([\d.]+)in/g)].forEach(m => ok(+m[1] >= LP.STANDARDS.MIN_RULE_IN, "a writing line at " + m[1] + "in"));
  [...printCss.matchAll(/\.lp-(?:fill|val-blank|step-line)\{[^}]*border-bottom:([\d.]+)(px|pt)/g)].forEach(m => ok(printedPt(m[1], m[2]) >= LP.STANDARDS.RULE_PT, "a write-in line prints at " + printedPt(m[1], m[2]) + "pt"));
  [...printCss.matchAll(/\.lp-tbl[^{]*\b(?:td|th)[^{]*\{[^}]*height:([\d.]+)in/g)].forEach(m => ok(+m[1] >= LP.STANDARDS.MIN_RULE_IN, "table row " + m[1] + "in"));
  [...printCss.matchAll(/\.lp-tbl (?:td|th)\{[^}]*border:([\d.]+)(px|pt)/g)].forEach(m => ok(printedPt(m[1], m[2]) >= LP.STANDARDS.RULE_PT, "table rule prints at " + printedPt(m[1], m[2]) + "pt"));
  const wheelMin = /\.lp-wheel-box\{[^}]*min-height:([\d.]+)in/.exec(printCss);
  const svgSizes = [...LP.build(MAX, OPTS, "memory").pages[1].html.matchAll(/font-size="([\d.]+)"/g)].map(m => +m[1]);
  ok(wheelMin && Math.min(...svgSizes) / 560 * +wheelMin[1] * 72 >= 14, "year wheel labels stay at 14 pt or more at the smallest wheel size");
});
check("season colors are fixed and readable at WCAG AAA (7:1)", () => {
  const S = LP.DATA.SEASONS;
  eq([S.spring.color, S.summer.color, S.autumn.color, S.winter.color].join(), "Green,Yellow,Orange,Blue");
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for (const k of Object.keys(S)){
    ok(ratio(S[k].ink, S[k].tint) >= 7, `${k} ink on tint ${ratio(S[k].ink, S[k].tint).toFixed(2)}`);
    ok(ratio(S[k].ink, "#FFFFFF") >= 7, `${k} ink on white`);
    const m = new RegExp(`\\.lp-s-${k}\\{--ink:(#[0-9A-Fa-f]{6});--tint:(#[0-9A-Fa-f]{6})`).exec(printCss);
    ok(m && m[1].toUpperCase() === S[k].ink.toUpperCase() && m[2].toUpperCase() === S[k].tint.toUpperCase(), `${k} CSS matches the engine`);
  }
  for (let m = 0; m < 12; m++) eq(LP.DATA.SEASONS[LP.DATA.seasonOfMonth(m)].key, ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"][m], "month " + m);
});
check("High Contrast Mode forces pure black and white, pseudo-elements included", () => {
  ok(/#printRoot\.pure-bw \.lp-sheet,#printRoot\.pure-bw \.lp-sheet \*\{color:#000!important;background:#fff!important;border-color:#000!important/.test(printCss), "base rule");
  ok(/#printRoot\.pure-bw \.lp-sheet \*::before,#printRoot\.pure-bw \.lp-sheet \*::after\{[^}]*border-color:#000!important/.test(printCss), "pseudo-elements");
  ok(/\[fill\]\[data-bw="white"\]:not\(\[fill="none"\]\)\{fill:#fff!important\}/.test(printCss), "white shapes stay white");
});

/* ---------- report ---------- */
const total = passed + failures.length;
if (failures.length){
  console.error(`Life Planner checks: ${failures.length} of ${total} FAILED`);
  failures.forEach(f => console.error("  ✗ " + f));
  process.exit(1);
}
console.log(`Life Planner checks: all ${total} passed.`);
